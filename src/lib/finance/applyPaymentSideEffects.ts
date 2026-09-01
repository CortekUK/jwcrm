// Everything that must happen after money lands against an invoice, in one
// place, so a card payment and a bank transfer recorded by hand behave
// identically.
//
// Before this existed the two paths disagreed badly: the Stripe webhook settled
// the invoice, moved the lead to 'won' and created the portal account, while
// the manual payments route only flipped the proposal's status — so a client
// who paid by transfer got no portal and their lead never moved.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invoiceAmountsFor } from "@/lib/finance/outstandingBalance";
import { resolvePaymentStage, sumPayments, type StageState } from "@/lib/finance/invoiceAmounts";
import {
  provisionClientPortalAccount,
  type ProvisionOutcome,
} from "@/lib/clients/provisionClientPortalAccount";

/**
 * Pipeline stages a lead may be automatically advanced OUT OF.
 *
 * Anything else — 'won', 'lost', a deliberate 'hold' — is a decision someone
 * made, and a payment should not silently undo it.
 */
const ADVANCEABLE_STATUSES = new Set([
  "not_started",
  "contacted",
  "consultation",
  "consultation_completed",
  "meeting",
  "qualified",
  "negotiation",
  "pending",
  "unreachable",
]);

export type PaymentSideEffects = {
  stageState: StageState;
  proposalStatus: string;
  leadStatus: string | null;
  provisioned: ProvisionOutcome;
  currency: string;
};

type LeadRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
};

export async function applyPaymentSideEffects(
  supabaseAdmin: SupabaseClient,
  proposalId: string,
  opts: {
    trigger: "stripe" | "manual";
    leadEmailFallback?: string | null;
    leadNameFallback?: string | null;
  }
): Promise<
  { ok: false; status: number; error: string } | ({ ok: true } & PaymentSideEffects)
> {
  const { data: proposal, error: proposalError } = await supabaseAdmin
    .from("proposals")
    // vat_rate/vat_amount are mandatory here — computing the total without them
    // would settle (or fail to settle) the invoice against the wrong figure.
    .select(
      "id, lead_id, amount, currency, line_items, status, paid_at, vat_rate, vat_amount, lead:leads(id, full_name, email, status)"
    )
    .eq("id", proposalId)
    .single();

  if (proposalError || !proposal) {
    return { ok: false, status: 404, error: "Proposal not found" };
  }

  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from("proposal_payments")
    .select("amount")
    .eq("proposal_id", proposalId);

  if (paymentsError) {
    // Never guess: guessing high double-charges the client, guessing low
    // settles an invoice that still has money owing on it.
    return { ok: false, status: 500, error: "Could not read payment history" };
  }

  const amounts = invoiceAmountsFor({
    id: proposal.id,
    amount: proposal.amount,
    currency: proposal.currency,
    line_items: proposal.line_items,
    status: proposal.status,
    vat_rate: proposal.vat_rate,
    vat_amount: proposal.vat_amount,
  });
  const stageState = resolvePaymentStage(amounts, sumPayments(payments));

  // Supabase types the embed as an array or an object depending on the shape of
  // the relationship; normalise before use.
  const rawLead = (proposal as unknown as { lead: LeadRow | LeadRow[] | null }).lead;
  const lead: LeadRow | null = Array.isArray(rawLead) ? (rawLead[0] ?? null) : rawLead;

  const currency = proposal.currency || "AED";
  const nowIso = new Date().toISOString();
  let proposalStatus = proposal.status as string;
  let leadStatus = lead?.status ?? null;

  if (stageState.fullySettled) {
    const { error: settleError } = await supabaseAdmin
      .from("proposals")
      .update({
        status: "paid",
        // Preserve the original settlement time across webhook retries.
        paid_at: proposal.paid_at || nowIso,
        updated_at: nowIso,
      })
      .eq("id", proposalId);
    if (settleError) {
      console.error("Error marking proposal paid:", settleError);
      return { ok: false, status: 500, error: "Could not settle the invoice" };
    }
    proposalStatus = "paid";

    if (lead?.id) {
      const { error: leadError } = await supabaseAdmin
        .from("leads")
        .update({
          status: "won",
          is_paid: true,
          paid_at: nowIso,
          // Everything collected against this invoice, not just this payment —
          // a settled invoice may have been paid across several.
          paid_amount: stageState.totalPaid,
          paid_currency: currency,
          updated_at: nowIso,
        })
        .eq("id", lead.id);
      if (leadError) console.error("Error updating lead on settlement:", leadError);
      else leadStatus = "won";
    }
  } else if (stageState.upfrontCovered && lead?.id) {
    // The drafting fee is covered but the court fees are not. Work starts, so
    // the lead moves to 'drafting' — but the invoice stays open and `is_paid`
    // stays false: setting it with money outstanding would corrupt the
    // collected-revenue figures and the ledger-derived "part paid" badges.
    const advance = leadStatus ? ADVANCEABLE_STATUSES.has(leadStatus) : false;
    const { error: leadError } = await supabaseAdmin
      .from("leads")
      .update({
        ...(advance ? { status: "drafting" } : {}),
        paid_amount: stageState.totalPaid,
        paid_currency: currency,
        updated_at: nowIso,
      })
      .eq("id", lead.id);
    if (leadError) console.error("Error advancing lead to drafting:", leadError);
    else if (advance) leadStatus = "drafting";
  }

  // Self-gating: returns "skipped" unless the upfront items are covered, and
  // "already_provisioned" if this lead already has a portal account.
  const provisioned = await provisionClientPortalAccount(supabaseAdmin, {
    leadId: lead?.id ?? (proposal.lead_id as string | null),
    proposalId,
    // Prefer the lead row: Stripe metadata can arrive blank, and the old code
    // skipped account creation entirely when it did.
    email: lead?.email || opts.leadEmailFallback || null,
    fullName: lead?.full_name || opts.leadNameFallback || null,
    stageState,
    currency,
  });

  if (provisioned.status === "failed") {
    // Loud, but not fatal: the payment is recorded and the invoice state is
    // correct. Callers surface this so it is not silently swallowed the way the
    // webhook used to swallow it.
    console.error(
      `Portal provisioning failed for proposal ${proposalId} (${opts.trigger}):`,
      provisioned.error
    );
  }

  return {
    ok: true,
    stageState,
    proposalStatus,
    leadStatus,
    provisioned,
    currency,
  };
}
