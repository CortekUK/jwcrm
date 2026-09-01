// POST /api/lead-management/proposals/[id]/request-payment
//
// Emails the client a fresh request for whatever is payable RIGHT NOW.
//
// Staged invoices are collected weeks apart — the drafting fee to start work,
// the court fees at the court appointment. Until this existed the only way to
// ask for the second instalment was to tell the client to find the original
// invoice email and press its button again, which is not something you can
// reasonably ask of someone paying you thousands of dirhams.
//
// The email links to /api/pay/[proposalId], which prices at click time, so the
// amount can never go stale between sending and paying.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCanManageLeadDeal } from "@/lib/lead-management/proposalInvoice";
import { outstandingBalanceForProposal } from "@/lib/finance/balanceCheckout";
import { paymentResolverUrl } from "@/lib/finance/paymentLink";
import { sendUserEmail } from "@/lib/integrations/sendUserEmail";
import {
  buildPaymentRequestEmailHTML,
  buildPaymentRequestSubject,
} from "@/lib/email/paymentRequestEmail";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await context.params;

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: userInfo, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userInfo?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const callerId = userInfo.user.id;

    const body = await request.json().catch(() => ({}));
    const message: string | null = body.message ? String(body.message).slice(0, 2000) : null;

    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from("proposals")
      .select("id, invoice_number, invoiced_at, currency, lead:leads(id, full_name, email, assigned_to)")
      .eq("id", proposalId)
      .single();
    if (proposalError || !proposal) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const rawLead = (proposal as unknown as {
      lead: { id: string; full_name: string | null; email: string | null; assigned_to: string | null } | null;
    }).lead;
    const lead = Array.isArray(rawLead) ? rawLead[0] : rawLead;

    const auth = await assertCanManageLeadDeal(supabaseAdmin, callerId, lead ?? {});
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Nothing has been issued yet, so there is nothing to chase.
    if (!proposal.invoiced_at) {
      return NextResponse.json(
        { error: "Send the invoice before requesting payment" },
        { status: 409 }
      );
    }
    if (!lead?.email) {
      return NextResponse.json({ error: "This lead has no email address" }, { status: 409 });
    }

    const balance = await outstandingBalanceForProposal(supabaseAdmin, proposalId);
    if (!balance.ok) {
      return NextResponse.json({ error: balance.error }, { status: balance.status });
    }
    const { stageState } = balance;

    // Never email someone asking for money they do not owe.
    if (stageState.fullySettled || stageState.amountDue <= 0) {
      return NextResponse.json(
        { error: "This invoice is already settled — nothing to request" },
        { status: 409 }
      );
    }

    const currency = (proposal.currency as string) || "AED";
    const emailData = {
      clientName: lead.full_name || "",
      invoiceNumber: (proposal.invoice_number as string | null) ?? null,
      currency,
      stageState,
      paymentUrl: paymentResolverUrl(proposalId),
      message,
    };

    // Sent as the caller (their Outlook when connected), matching how proposals
    // and invoices already go out, so the client sees a familiar sender.
    const result = await sendUserEmail(callerId, {
      to: lead.email,
      subject: buildPaymentRequestSubject(emailData),
      html: buildPaymentRequestEmailHTML(emailData),
      refId: `payment-request-${proposalId}-${Date.now()}`,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Could not send the payment request" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      sentTo: lead.email,
      provider: result.provider,
      stage: stageState.stage,
      amountRequested: stageState.amountDue,
      currency,
    });
  } catch (error) {
    console.error("Error sending payment request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
