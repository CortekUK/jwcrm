// The team changing (or setting, or clearing) the registration court on a
// proposal — the only way a court changes once the client has chosen, since
// the client's choice is final on their side.
//
// Pure, so every rule can be tested without a database; the route
// (api/lead-management/proposals/[id]/court) only loads, authorises and writes.

import { lineItemsSubtotal, type InvoiceLineItem } from "@/lib/pdf/invoiceLineItems";
import {
  isCourtId,
  normalizeCourtOptions,
  withChosenCourt,
  type CourtId,
} from "@/lib/lead-management/courtOptions";

export type CourtChangeInput = {
  status: string | null;
  invoiced_at: string | null;
  line_items: unknown;
  court_options: unknown;
};

export type CourtChangeDecision =
  | { ok: true; lineItems: InvoiceLineItem[]; amount: number; court: CourtId | null }
  | { ok: false; status: 400 | 409; error: string };

/**
 * Decide the new line items for a court change, or why it is refused.
 *
 * `requested` is the raw body value: a court id, or null to clear the choice.
 * Clearing only makes sense with two or more offered — with one, that court IS
 * the proposal and there is nothing for the client to choose instead.
 */
export function planCourtChange(
  proposal: CourtChangeInput,
  requested: unknown
): CourtChangeDecision {
  // Once invoiced the fee lives on the invoice, which may already have been
  // paid against; rewriting the proposal's lines underneath it would make the
  // two disagree. Paid and cancelled proposals are closed outright.
  if (proposal.status === "cancelled") {
    return {
      ok: false,
      status: 409,
      error: "This proposal has been cancelled, so its court can no longer be changed.",
    };
  }
  if (proposal.status === "paid" || proposal.invoiced_at) {
    return {
      ok: false,
      status: 409,
      error:
        "The invoice has been raised for this proposal — change the court fee on the invoice instead.",
    };
  }

  const options = normalizeCourtOptions(proposal.court_options);
  const items = Array.isArray(proposal.line_items)
    ? (proposal.line_items as InvoiceLineItem[])
    : [];

  let court: CourtId | null;
  if (requested === null) {
    if (options.length < 2) {
      return {
        ok: false,
        status: 400,
        error: "This proposal does not offer a choice of courts, so there is nothing to clear.",
      };
    }
    court = null;
  } else if (isCourtId(requested) && options.some((o) => o.court === requested)) {
    court = requested;
  } else {
    return { ok: false, status: 400, error: "That court was not offered on this proposal." };
  }

  const lineItems = withChosenCourt(items, options, court);
  return { ok: true, lineItems, amount: lineItemsSubtotal(lineItems), court };
}
