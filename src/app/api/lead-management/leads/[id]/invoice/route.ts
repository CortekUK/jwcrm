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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_ROLES = new Set(["admin", "superadmin", "lead_management", "finance", "salesperson"]);

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

    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    if (roleErr) {
      console.error("user_roles fetch failed:", roleErr);
      return NextResponse.json({ error: "Role lookup failed" }, { status: 500 });
    }
    const callerRoles = new Set((roleRows || []).map((r) => r.role));
    const hasAllowedRole = [...callerRoles].some((r) => ALLOWED_ROLES.has(r));
    if (!hasAllowedRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount);
    const currency = (body.currency || "AED").toString().toUpperCase();
    const description = (body.description || "Legal services").toString();
    const sendEmail = body.sendEmail !== false; // default true

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

    // If the caller is *only* a salesperson, they must own the lead.
    const isOnlySalesperson =
      callerRoles.has("salesperson") &&
      !callerRoles.has("admin") &&
      !callerRoles.has("superadmin") &&
      !callerRoles.has("lead_management") &&
      !callerRoles.has("finance");
    if (isOnlySalesperson && lead.assigned_to !== callerId) {
      return NextResponse.json({ error: "This lead is not assigned to you" }, { status: 403 });
    }

    // 1. Create the proposal/invoice row. invoice_number is filled by the
    //    proposals trigger.
    const { data: proposal, error: proposalErr } = await supabaseAdmin
      .from("proposals")
      .insert({
        lead_id: leadId,
        amount,
        currency,
        proposal_content: `<p>${escapeHtml(description)}</p>`,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (proposalErr || !proposal) {
      console.error("proposal insert failed:", proposalErr);
      return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
    }

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
              unit_amount: Math.round(amount * 100),
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
    });

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
