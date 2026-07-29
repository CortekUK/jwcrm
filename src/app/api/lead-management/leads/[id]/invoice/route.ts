// POST /api/lead-management/leads/[id]/invoice
//
// Generates an invoice for a lead and (optionally) emails it with a Stripe
// payment link. Intended to be called from the lead detail page by the
// salesperson who owns the lead, or by admin / lead_management / finance.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/integrations/stripe/server";
import { generateInvoicePDF } from "@/lib/pdf/generateInvoicePDF";
import { sendUserEmail } from "@/lib/integrations/sendUserEmail";
import { companyDetails } from "@/config/company";
import { buildInvoiceEmailHTML } from "@/lib/email/invoiceEmailTemplate";
import { normalizeLineItems, lineItemsSubtotal } from "@/lib/pdf/invoiceLineItems";
import { upsertLeadDeal, assertCanManageLeadDeal } from "@/lib/lead-management/proposalInvoice";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the caller from the JWT.
    const { data: userInfo, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userInfo?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const callerId = userInfo.user.id;

    const body = await request.json().catch(() => ({}));
    const rawAmount = Number(body.amount);
    const currency = (body.currency || "AED").toString().toUpperCase();
    const description = (body.description || "Legal services").toString();
    const sendEmail = body.sendEmail !== false; // default true

    // Itemised charges → subtotal is their sum (falls back to the flat amount).
    const items = normalizeLineItems(body.line_items, rawAmount);
    const amount = lineItemsSubtotal(items);

    if (!leadId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Lead id and a positive amount are required" },
        { status: 400 }
      );
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, full_name, email, phone, company_name, assigned_to")
      .eq("id", leadId)
      .single();
    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const auth = await assertCanManageLeadDeal(supabaseAdmin, callerId, lead);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 1. Create or update this lead's active proposal record — if a proposal
    //    was already sent for this lead, this turns that SAME record into a
    //    real, payable invoice instead of creating a disconnected new one.
    //    proposal_content is intentionally left untouched here so this never
    //    overwrites a real proposal a client already received.
    const { proposal } = await upsertLeadDeal(supabaseAdmin, {
      leadId,
      mode: "invoice",
      amount,
      currency,
      lineItems: items,
    });

    // 2. Stripe checkout session (best effort).
    let paymentUrl: string | null = null;
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: lead.email,
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `${companyDetails.legalName} - Legal Services`,
                description: `Invoice ${proposal.invoice_number} for ${lead.full_name}`,
              },
              // VAT included — must match the invoice PDF and the balance
              // tracking, or the payment link collects the fees but drops
              // the VAT and the invoice can never be settled in full.
              unit_amount: Math.round(
                (amount + amount * (companyDetails.vatRate / 100)) * 100
              ),
            },
            quantity: 1,
          },
        ],
        metadata: {
          proposalId: proposal.id,
          leadEmail: lead.email,
          leadName: lead.full_name,
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/cancelled`,
      });
      paymentUrl = session.url || null;
      await supabaseAdmin
        .from("proposals")
        .update({
          stripe_checkout_session_id: session.id,
          stripe_payment_link: paymentUrl,
        })
        .eq("id", proposal.id);
    } catch (stripeErr) {
      console.error("stripe checkout creation failed:", stripeErr);
      // Continue without Stripe — the invoice is still recorded.
    }

    // 3. Generate the invoice PDF.
    const now = new Date();
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const pdfBase64 = generateInvoicePDF({
      invoiceNumber: proposal.invoice_number,
      invoiceDate: now,
      dueDate,
      clientName: lead.full_name,
      clientEmail: lead.email,
      clientPhone: lead.phone,
      clientCompany: lead.company_name,
      amount,
      currency,
      description,
      lineItems: items,
    });

    // Persist the PDF so the existing View/Download PDF menu in the admin UI
    // (ViewProposalDialog) actually has something to open.
    try {
      const invoicePdfPath = `${leadId}/invoice_${proposal.id}_${Date.now()}.pdf`;
      const { error: storageError } = await supabaseAdmin.storage
        .from("proposals")
        .upload(invoicePdfPath, Buffer.from(pdfBase64, "base64"), {
          contentType: "application/pdf",
          upsert: true,
        });
      if (!storageError) {
        await supabaseAdmin
          .from("proposals")
          .update({ invoice_pdf_path: invoicePdfPath })
          .eq("id", proposal.id);
      } else {
        console.error("Error uploading invoice PDF:", storageError);
      }
    } catch (storageErr) {
      console.error("Error uploading invoice PDF:", storageErr);
    }

    // 4. Send email (best effort). Goes via the caller's Outlook if they
    //    have it connected; otherwise Resend.
    let emailProvider: string | null = null;
    if (sendEmail) {
      const formattedAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(amount);
      const emailResult = await sendUserEmail(callerId, {
        to: lead.email,
        subject: `Invoice ${proposal.invoice_number} - ${formattedAmount}`,
        refId: proposal.id,
        html: buildInvoiceEmailHTML({
          invoiceNumber: proposal.invoice_number,
          invoiceDate: now,
          clientName: lead.full_name,
          clientEmail: lead.email,
          clientPhone: lead.phone,
          clientCompany: lead.company_name,
          amount,
          lineItems: items,
          paymentUrl,
        }),
        attachments: [
          { content: pdfBase64, filename: `Invoice-${proposal.invoice_number}.pdf` },
        ],
      });
      emailProvider = emailResult.provider;
      if (!emailResult.ok) {
        console.error("invoice email failed:", emailResult.error);
        // Non-fatal — the invoice row and Stripe link still exist.
      }
    }

    return NextResponse.json({
      success: true,
      proposalId: proposal.id,
      invoiceNumber: proposal.invoice_number,
      paymentUrl,
      pdfBase64,
      emailProvider,
    });
  } catch (error) {
    console.error("invoice route crashed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
