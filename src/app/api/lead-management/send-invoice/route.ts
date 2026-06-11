import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/integrations/stripe/server";
import { generateInvoicePDFArabic } from "@/lib/pdf/generateInvoicePDFArabic";
import { sendUserEmail } from "@/lib/integrations/sendUserEmail";
import { buildInvoiceEmailHTML } from "@/lib/email/invoiceEmailTemplate";

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
    const { leadId, amount, currency = "AED", description } = body;

    if (!leadId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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

    const effectiveEmail = lead.email;
    const effectiveName = lead.full_name;

    const now = new Date();
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // 2. Create proposal record (invoice_number is auto-generated)
    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from("proposals")
      .insert({
        lead_id: leadId,
        amount,
        currency,
        proposal_content: null,
        status: "draft",
      })
      .select()
      .single();

    if (proposalError || !proposal) {
      console.error("Error creating proposal:", proposalError);
      return NextResponse.json(
        { error: "Failed to create invoice record" },
        { status: 500 }
      );
    }

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
            unit_amount: Math.round(amount * 100),
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
      amount: amount,
      currency: currency,
      description: description || "خدمات صياغة الوصايا الاحترافية",
    });

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
        amount: amount,
        paymentUrl: session.url,
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
