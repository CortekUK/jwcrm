// "Has this lead paid?" — answered from the payment ledger rather than the
// leads.is_paid flag.
//
// leads.is_paid is a one-way switch: the first invoice that settles sets it to
// true and nothing ever sets it back. So a lead who paid an old invoice in full
// and now has a second invoice half paid still showed a green "Paid" badge,
// which reads as "nothing owing" when money is in fact outstanding.
//
// This derives the badge from proposal_payments instead, so a lead with any
// open balance is visibly distinct from one who is genuinely settled.

import { invoiceTotalFor, type ProposalLike, type PaymentLike } from "./outstandingBalance";

export type LeadPaymentState = "unpaid" | "partially_paid" | "paid";

export type LeadPaymentSummary = {
  state: LeadPaymentState;
  /** Sum of everything received across this lead's invoices. */
  totalPaid: number;
  /** Sum of what is still owed across this lead's open invoices. */
  balanceDue: number;
  currency: string;
};

type LeadScopedProposal = ProposalLike & { lead_id: string };

/**
 * Payment state per lead id.
 *
 * - `paid` — every payable invoice is settled and at least one exists.
 * - `partially_paid` — money has come in but a balance remains anywhere.
 * - `unpaid` — nothing received (or nothing invoiced yet).
 *
 * Cancelled proposals and un-invoiced proposals are ignored: nobody owes
 * anything on those.
 */
export function computeLeadPaymentStates(
  proposals: LeadScopedProposal[],
  payments: PaymentLike[]
): Map<string, LeadPaymentSummary> {
  const paidByProposal = new Map<string, number>();
  for (const payment of payments) {
    const amount = Number(payment.amount) || 0;
    paidByProposal.set(
      payment.proposal_id,
      (paidByProposal.get(payment.proposal_id) || 0) + amount
    );
  }

  const byLead = new Map<string, LeadPaymentSummary & { invoiceCount: number }>();

  for (const proposal of proposals) {
    if (!proposal.invoiced_at) continue;
    if (proposal.status === "cancelled") continue;

    const invoiceTotal = invoiceTotalFor(proposal);
    const totalPaid = paidByProposal.get(proposal.id) || 0;

    // A legacy invoice marked paid before the ledger existed has no payment
    // rows; trust its status rather than reporting the whole amount as owing.
    const settled = proposal.status === "paid" || invoiceTotal - totalPaid < 0.01;
    const balanceDue = settled ? 0 : invoiceTotal - totalPaid;
    const received = proposal.status === "paid" && totalPaid === 0 ? invoiceTotal : totalPaid;

    const entry = byLead.get(proposal.lead_id) ?? {
      state: "unpaid" as LeadPaymentState,
      totalPaid: 0,
      balanceDue: 0,
      currency: proposal.currency || "AED",
      invoiceCount: 0,
    };
    entry.totalPaid += received;
    entry.balanceDue += balanceDue;
    entry.invoiceCount += 1;
    byLead.set(proposal.lead_id, entry);
  }

  const result = new Map<string, LeadPaymentSummary>();
  for (const [leadId, entry] of byLead) {
    let state: LeadPaymentState = "unpaid";
    if (entry.invoiceCount > 0 && entry.balanceDue < 0.01) {
      state = entry.totalPaid > 0 ? "paid" : "unpaid";
    } else if (entry.totalPaid > 0) {
      state = "partially_paid";
    }
    result.set(leadId, {
      state,
      totalPaid: entry.totalPaid,
      balanceDue: entry.balanceDue,
      currency: entry.currency,
    });
  }

  return result;
}
