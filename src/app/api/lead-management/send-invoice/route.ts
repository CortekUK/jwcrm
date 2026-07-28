import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/integrations/stripe/server";
import { generateInvoicePDFArabic } from "@/lib/pdf/generateInvoicePDFArabic";
import { sendUserEmail } from "@/lib/integrations/sendUserEmail";
import { buildInvoiceEmailHTML } from "@/lib/email/invoiceEmailTemplate";
import { normalizeLineItems, lineItemsSubtotal } from "@/lib/pdf/invoiceLineItems";
import { upsertLeadDeal, assertCanManageLeadDeal } from "@/lib/lead-management/proposalInvoice";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Resolve caller from JWT so we can route through their Outlook when connected.
    let callerId: string | null = null;
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (accessToken) {
      const { data: userInfo } = await supabaseAdmin.auth.getUser(accessToken);
      callerId = userInfo?.user?.id ?? null;
    }

    const body = await request.json();
    const { leadId, amount, currency = "AED", description, line_items } = body;

    if (!leadId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Itemised charges (court fee / drafting / POA etc.). The subtotal is their
    // sum; falls back to the flat amount when no items are supplied.
    const items = normalizeLineItems(line_items, amount);
    const subtotalAmount = lineItemsSubtotal(items);

    // 1. Get lead details
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    const auth = await assertCanManageLeadDeal(supabaseAdmin, callerId, lead);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const effectiveEmail = lead.email;
    const effectiveName = lead.full_name;

    const now = new Date();
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // 2. Create or update this lead's active proposal record — if a proposal
    //    was already sent for this lead, this turns that SAME record into a
    //    real, payable invoice instead of creating a disconnected new one.
    const { proposal } = await upsertLeadDeal(supabaseAdmin, {
      leadId,
      mode: "invoice",
      amount: subtotalAmount,
      currency,
      lineItems: items,
    });

    // 3. Create Stripe Checkout Session
    const invoiceDescription = description || "Professional Will Drafting Services";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: effectiveEmail,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: "Just Wills - Legal Services",
              description: `Invoice ${proposal.invoice_number} for ${effectiveName}`,
            },
            unit_amount: Math.round(subtotalAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        proposalId: proposal.id,
        leadEmail: effectiveEmail,
        leadName: effectiveName,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/cancelled`,
    });

    // 4. Update proposal with Stripe info
    const { error: updateError } = await supabaseAdmin
      .from("proposals")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_link: session.url,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", proposal.id);

    if (updateError) {
      console.error("Error updating proposal:", updateError);
    }

    // NOTE: Does NOT update lead status — invoice-only shouldn't change pipeline status

    // 5. Generate Invoice PDF
    const invoicePDFBase64 = await generateInvoicePDFArabic({
      invoiceNumber: proposal.invoice_number,
      invoiceDate: now,
      dueDate: dueDate,
      clientName: effectiveName,
      clientEmail: effectiveEmail,
      clientPhone: lead.phone,
      clientCompany: lead.company_name,
      amount: subtotalAmount,
      currency: currency,
      description: description || "خدمات صياغة الوصايا الاحترافية",
      lineItems: items,
    });

    // Persist the PDF so the existing View/Download PDF menu in the admin UI
    // (ViewProposalDialog) actually has something to open.
    let invoicePdfPath: string | null = null;
    try {
      invoicePdfPath = `${leadId}/invoice_${proposal.id}_${Date.now()}.pdf`;
      const { error: storageError } = await supabaseAdmin.storage
        .from("proposals")
        .upload(invoicePdfPath, Buffer.from(invoicePDFBase64, "base64"), {
          contentType: "application/pdf",
          upsert: true,
        });
      if (storageError) {
        console.error("Error uploading invoice PDF:", storageError);
        invoicePdfPath = null;
      }
    } catch (storageErr) {
      console.error("Error uploading invoice PDF:", storageErr);
    }
    if (invoicePdfPath) {
      await supabaseAdmin
        .from("proposals")
        .update({ invoice_pdf_path: invoicePdfPath })
        .eq("id", proposal.id);
    }

    // 6. Send email with invoice PDF attachment. Routed via caller's Outlook
    //    when connected, else falls back to Resend (with the existing
    //    test-mode behavior).
    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);

    const emailResult = await sendUserEmail(callerId, {
      to: effectiveEmail,
      subject: `Your Invoice - ${proposal.invoice_number}`,
      refId: proposal.id,
      attachments: [
        { content: invoicePDFBase64, filename: `Invoice-${proposal.invoice_number}.pdf` },
      ],
      html: buildInvoiceEmailHTML({
        invoiceNumber: proposal.invoice_number,
        invoiceDate: now,
        clientName: effectiveName,
        clientEmail: effectiveEmail,
        clientPhone: lead.phone,
        clientCompany: lead.company_name,
        amount: subtotalAmount,
        paymentUrl: session.url,
        lineItems: items,
      }),
    });
    if (!emailResult.ok) {
      console.error("Error sending invoice email:", emailResult.error);
    }

    // 7. Log invoice_sent activity
    try {
      await supabaseAdmin.from("lead_activities").insert({
        type: "invoice_sent",
        title: "Invoice Sent",
        description: `Invoice ${proposal.invoice_number} sent to ${effectiveName} for ${formattedAmount}`,
        lead_id: leadId,
        metadata: {
          proposal_id: proposal.id,
          invoice_number: proposal.invoice_number,
          amount: amount,
          currency: currency,
          description: invoiceDescription,
          recipient_email: effectiveEmail,
          email_provider: emailResult.provider,
        },
      });
    } catch (activityError) {
      console.error("Error logging activity:", activityError);
    }

    return NextResponse.json({
      success: true,
      proposalId: proposal.id,
      invoiceNumber: proposal.invoice_number,
      paymentUrl: session.url,
      emailProvider: emailResult.provider,
    });
  } catch (error) {
    console.error("Error in send-invoice:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
