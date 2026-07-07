// Shared invoice line-item model used by all four invoice renderings
// (English PDF, Arabic PDF, HTML email, and the in-app React preview) so they
// stay consistent. Supports the client's ask to itemise court fees, drafting,
// and additional charges (e.g. POA / MOFA & MOJ).

export type InvoiceLineItem = {
  description: string;
  amount: number;
};

// Suggested default items shown when a new invoice is created. Amounts are 0
// so staff fill them in; empty rows are dropped before rendering.
export const DEFAULT_INVOICE_ITEMS: InvoiceLineItem[] = [
  { description: "Will Drafting (UAE)", amount: 0 },
  { description: "Court Fee", amount: 0 },
];

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
    return cleaned.map((i) => ({
      description: i.description.trim(),
      amount: Number(i.amount) || 0,
    }));
  }
  return [{ description: "Will (UAE)", amount: Number(fallbackAmount) || 0 }];
}

export function lineItemsSubtotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}
