// Shared invoice line-item model used by all four invoice renderings
// (English PDF, Arabic PDF, HTML email, and the in-app React preview) so they
// stay consistent. Supports the client's ask to itemise court fees, drafting,
// and additional charges (e.g. POA / MOFA & MOJ).

/**
 * Which payment stage a line covers.
 *
 * Clients often pay the will-drafting fee up front so work can begin, then the
 * court/notarization fees at the court-appointment stage. Marking a row
 * "upfront" is how the team decides what the payment link charges first — the
 * client never picks an amount.
 *
 * Absent on a row means the invoice is not staged at all (every legacy row),
 * which collapses to today's single full-balance payment.
 */
export type LineItemStage = "upfront" | "later";

export type InvoiceLineItem = {
  /** May contain newlines; renderers must honour hard line breaks. */
  description: string;
  /** The LINE TOTAL, already extended. Never multiplied by `quantity`. */
  amount: number;
  /** Display-only multiplier shown in the invoice COST column ("X2"). */
  quantity?: number;
  stage?: LineItemStage;
};

// Suggested default items shown when a new invoice is created. Amounts are 0
// so staff fill them in; empty rows are dropped before rendering.
export const DEFAULT_INVOICE_ITEMS: InvoiceLineItem[] = [
  { description: "Will Drafting (UAE)", amount: 0 },
  { description: "Court Fee", amount: 0 },
];

function normalizeQuantity(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function normalizeStage(value: unknown): LineItemStage | undefined {
  return value === "upfront" || value === "later" ? value : undefined;
}

// Returns the items to render. Falls back to a single "Will (UAE)" row using
// the flat amount so older invoices (no line items) still render correctly.
export function normalizeLineItems(
  items: InvoiceLineItem[] | undefined | null,
  fallbackAmount: number
): InvoiceLineItem[] {
  const cleaned = (items || []).filter(
    (i) => i && i.description && i.description.trim().length > 0
  );
  if (cleaned.length > 0) {
    return cleaned.map((i) => {
      const stage = normalizeStage(i.stage);
      return {
        // trim() only strips the ends, so interior newlines survive.
        description: i.description.trim(),
        amount: Number(i.amount) || 0,
        quantity: normalizeQuantity(i.quantity),
        ...(stage ? { stage } : {}),
      };
    });
  }
  // The synthetic fallback is deliberately unstaged: a legacy invoice must keep
  // behaving as a single full-balance payment.
  return [
    {
      description: "Will (UAE)",
      amount: Number(fallbackAmount) || 0,
      quantity: 1,
    },
  ];
}

export function lineItemsSubtotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

/** COST column text, matching the client's invoice ("X2", or "X" for one). */
export function lineItemCostLabel(item: InvoiceLineItem): string {
  const qty = normalizeQuantity(item.quantity);
  return qty > 1 ? `X${qty}` : "X";
}
