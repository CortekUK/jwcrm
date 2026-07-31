// "How much money have we actually collected from this lead?" — reconciled
// across the two places the answer has ever been recorded.
//
// Revenue on the sales pages used to be summed straight off leads.paid_amount.
// That column is written once, by the Stripe webhook, for the first invoice
// that settles; nothing updates it afterwards and nothing writes it for a
// payment recorded by hand. So the cards both over-state (a refunded or
// superseded first invoice keeps its amount) and under-state (every payment
// taken through the ledger since is invisible).
//
// The proposal_payments ledger is the real record now, but it is *new*: the
// payments taken before it existed were never backfilled into it. Switching
// the pages to the ledger alone therefore deletes most of the recorded
// revenue — the six leads flagged is_paid with no ledger rows at all, four of
// which have no invoiced proposal for computeLeadPaymentStates to even see.
//
// So this reconciles the two per lead: the ledger wins wherever it has
// anything to say, and leads.paid_amount is the fallback for the legacy tail.
// A lead is counted from exactly one of the two, never both. The `source` on
// each entry makes the shrinking legacy tail visible, so that once the ledger
// is backfilled the fallback can be dropped and this file deleted.
//
// Note this deliberately does NOT reuse computeLeadPaymentStates for the
// ledger half. That helper answers "does this lead owe anything", so it skips
// un-invoiced proposals and reports a paid-status invoice's full total as
// received even when no payment rows exist — both correct for a badge, both
// wrong for "cash collected". Summing proposal_payments directly is the
// narrower, literal answer this needs.

/** Which record the figure came from. `legacy` rows are the backfill backlog. */
export type CollectedRevenueSource = "ledger" | "legacy";

export type LeadCollectedRevenue = {
  /** Money actually received for this lead, in `currency`. */
  collected: number;
  currency: string;
  source: CollectedRevenueSource;
};

export type RevenueLeadLike = {
  id: string;
  is_paid?: boolean | null;
  // PostgREST returns numeric columns as strings.
  paid_amount?: number | string | null;
  paid_currency?: string | null;
};

export type RevenueProposalLike = {
  id: string;
  lead_id: string;
  currency?: string | null;
};

export type RevenuePaymentLike = {
  proposal_id: string;
  amount?: number | string | null;
};

const DEFAULT_CURRENCY = "AED";

/**
 * Collected revenue per lead id.
 *
 * - Any proposal_payments rows for the lead ⇒ the ledger sum, `source: "ledger"`.
 * - Otherwise `is_paid` with a `paid_amount` ⇒ that amount, `source: "legacy"`.
 * - Neither ⇒ the lead is absent from the map (treat as zero).
 *
 * Leads that only the ledger knows about are included even if they are missing
 * from `leads` — that under-reporting (money collected while is_paid stayed
 * false) is half the bug this exists to fix.
 *
 * Amounts are not currency-converted. Everything in this system is AED in
 * practice; a lead whose ledger rows are in another currency is reported in
 * that currency and left for the caller to notice.
 */
export function computeCollectedRevenue(
  leads: RevenueLeadLike[],
  proposals: RevenueProposalLike[],
  payments: RevenuePaymentLike[]
): Map<string, LeadCollectedRevenue> {
  const leadByProposal = new Map<string, { leadId: string; currency: string }>();
  for (const proposal of proposals) {
    if (!proposal.lead_id) continue;
    leadByProposal.set(proposal.id, {
      leadId: proposal.lead_id,
      currency: proposal.currency || DEFAULT_CURRENCY,
    });
  }

  // Ledger half: sum the payment rows per lead, via their proposal.
  const ledgerByLead = new Map<string, { collected: number; currency: string }>();
  for (const payment of payments) {
    const proposal = leadByProposal.get(payment.proposal_id);
    if (!proposal) continue; // payment for a proposal outside this batch
    const entry = ledgerByLead.get(proposal.leadId) ?? {
      collected: 0,
      currency: proposal.currency,
    };
    entry.collected += Number(payment.amount) || 0;
    ledgerByLead.set(proposal.leadId, entry);
  }

  const result = new Map<string, LeadCollectedRevenue>();

  for (const [leadId, entry] of ledgerByLead) {
    result.set(leadId, {
      collected: entry.collected,
      currency: entry.currency,
      source: "ledger",
    });
  }

  // Legacy half: only for leads the ledger says nothing about, so no lead is
  // ever counted twice.
  for (const lead of leads) {
    if (result.has(lead.id)) continue;
    if (!lead.is_paid) continue;
    const amount = Number(lead.paid_amount) || 0;
    if (amount === 0) continue;
    result.set(lead.id, {
      collected: amount,
      currency: lead.paid_currency || DEFAULT_CURRENCY,
      source: "legacy",
    });
  }

  return result;
}

/** Collected revenue for one lead, zero when neither source knows it. */
export function collectedFor(
  revenue: Map<string, LeadCollectedRevenue>,
  leadId: string
): number {
  return revenue.get(leadId)?.collected ?? 0;
}

/**
 * Total collected across the given leads (or every lead in the map when
 * `leadIds` is omitted). Currencies are summed as-is — see the note above.
 */
export function sumCollectedRevenue(
  revenue: Map<string, LeadCollectedRevenue>,
  leadIds?: Iterable<string>
): number {
  if (!leadIds) {
    let total = 0;
    for (const entry of revenue.values()) total += entry.collected;
    return total;
  }
  let total = 0;
  for (const leadId of leadIds) total += revenue.get(leadId)?.collected ?? 0;
  return total;
}

/** The currency to label a total with: the one most of the money is in. */
export function dominantCurrency(
  revenue: Map<string, LeadCollectedRevenue>
): string {
  const byCurrency = new Map<string, number>();
  for (const entry of revenue.values()) {
    byCurrency.set(entry.currency, (byCurrency.get(entry.currency) || 0) + entry.collected);
  }
  let best = DEFAULT_CURRENCY;
  let bestTotal = -1;
  for (const [currency, total] of byCurrency) {
    if (total > bestTotal) {
      best = currency;
      bestTotal = total;
    }
  }
  return best;
}
