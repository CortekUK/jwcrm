// One definition of "how much does this client still owe".
//
// A client may pay the drafting fee now and the court fees + VAT later, so an
// invoice stays open until the balance clears. The figure has to include VAT,
// because that is the amount the client actually sees on the invoice PDF —
// comparing payments against the bare subtotal would mark an invoice settled
// while VAT was still outstanding.
//
// Shared by the payments API, the finance dashboard panel and the weekly
// digest so all three can never disagree about who owes what.

import { companyDetails } from "@/config/company";
import {
  normalizeLineItems,
  lineItemsSubtotal,
  type InvoiceLineItem,
} from "@/lib/pdf/invoiceLineItems";

export type ProposalLike = {
  id: string;
  amount: number | null;
  currency: string | null;
  // Stored as JSON in the database, so it arrives loosely typed.
  line_items?: InvoiceLineItem[] | null;
  status: string;
  invoiced_at?: string | null;
  invoice_number?: string | null;
  created_at?: string;
  lead?: { full_name?: string | null; email?: string | null } | null;
};

export type PaymentLike = {
  proposal_id: string;
  amount: number | string | null;
};

export type OutstandingInvoice = {
  proposalId: string;
  invoiceNumber: string | null;
  clientName: string;
  clientEmail: string | null;
  currency: string;
  invoiceTotal: number;
  totalPaid: number;
  balanceDue: number;
  /** True once some — but not all — of the invoice has been paid. */
  partiallyPaid: boolean;
};

/** Invoice total including VAT, matching what the invoice PDF shows. */
export function invoiceTotalFor(proposal: ProposalLike): number {
  const items = normalizeLineItems(proposal.line_items, Number(proposal.amount) || 0);
  const subtotal = lineItemsSubtotal(items);
  return subtotal + subtotal * (companyDetails.vatRate / 100);
}

/**
 * Invoices with money still owed.
 *
 * Only rows that are genuinely payable count: `invoiced_at` must be set (a
 * proposal alone is informational and nobody owes anything yet) and the status
 * must not be paid or cancelled.
 */
export function computeOutstandingInvoices(
  proposals: ProposalLike[],
  payments: PaymentLike[]
): OutstandingInvoice[] {
  const paidByProposal = new Map<string, number>();
  for (const p of payments) {
    const amount = Number(p.amount) || 0;
    paidByProposal.set(p.proposal_id, (paidByProposal.get(p.proposal_id) || 0) + amount);
  }

  const results: OutstandingInvoice[] = [];

  for (const proposal of proposals) {
    if (!proposal.invoiced_at) continue;
    if (proposal.status === "paid" || proposal.status === "cancelled") continue;

    const invoiceTotal = invoiceTotalFor(proposal);
    const totalPaid = paidByProposal.get(proposal.id) || 0;
    const balanceDue = invoiceTotal - totalPaid;

    // Sub-cent remainders are rounding noise, not a debt.
    if (balanceDue < 0.01) continue;

    results.push({
      proposalId: proposal.id,
      invoiceNumber: proposal.invoice_number ?? null,
      clientName: proposal.lead?.full_name || "Unknown client",
      clientEmail: proposal.lead?.email ?? null,
      currency: proposal.currency || "AED",
      invoiceTotal,
      totalPaid,
      balanceDue,
      partiallyPaid: totalPaid > 0,
    });
  }

  // Largest debts first — that is what someone chasing payments wants to see.
  return results.sort((a, b) => b.balanceDue - a.balanceDue);
}

export function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
