// MIRROR of src/lib/finance/invoiceAmounts.ts (plus the parts of
// src/lib/pdf/invoiceLineItems.ts it depends on).
//
// Edge functions run on Deno and cannot import from src/, so this math exists
// twice. It is the one place in the codebase that can silently drift: if the
// app and this file ever disagree, the weekly chase email will quote clients a
// different balance from the one the payment link charges.
//
// KEEP THE TWO IN STEP — change one, change the other in the same commit.

export const BALANCE_EPSILON = 0.01;

/** The configured default when a proposal carries no VAT override. */
export const DEFAULT_VAT_RATE = 5;

export type InvoiceLineItem = {
  description: string;
  amount: number;
  quantity?: number;
  stage?: "upfront" | "later";
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// 0 is a legitimate VAT rate and PostgREST returns numerics as strings, so
// "absent" and "zero" must be distinguished — a truthiness check would silently
// turn a zero-rated invoice back into 5%.
function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeLineItems(
  items: InvoiceLineItem[] | null | undefined,
  fallbackAmount: number
): InvoiceLineItem[] {
  const cleaned = (items || []).filter(
    (i) => i && i.description && i.description.trim().length > 0
  );
  if (cleaned.length > 0) {
    return cleaned.map((i) => ({
      description: i.description.trim(),
      amount: Number(i.amount) || 0,
      quantity: Number(i.quantity) > 0 ? Math.round(Number(i.quantity)) : 1,
      ...(i.stage === "upfront" || i.stage === "later" ? { stage: i.stage } : {}),
    }));
  }
  // Deliberately unstaged, so a legacy invoice stays a single full payment.
  return [
    { description: "Will (UAE)", amount: Number(fallbackAmount) || 0, quantity: 1 },
  ];
}

export function lineItemsSubtotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

export type InvoiceAmounts = {
  items: InvoiceLineItem[];
  subtotal: number;
  vatAmount: number;
  vatRate: number | null;
  vatLabel: string;
  invoiceTotal: number;
  staged: boolean;
  upfrontSubtotal: number;
  upfrontVat: number;
  upfrontTotal: number;
  laterSubtotal: number;
  laterVat: number;
  laterTotal: number;
};

export function computeInvoiceAmounts(
  proposal: {
    amount?: number | string | null;
    line_items?: InvoiceLineItem[] | null;
    vat_rate?: number | string | null;
    vat_amount?: number | string | null;
  },
  defaultVatRate: number = DEFAULT_VAT_RATE
): InvoiceAmounts {
  const items = normalizeLineItems(
    proposal.line_items,
    Number(proposal.amount) || 0
  );
  const subtotal = lineItemsSubtotal(items);

  const overrideAmount = optionalNumber(proposal.vat_amount);
  const overrideRate = optionalNumber(proposal.vat_rate);

  let vatAmount: number;
  let vatRate: number | null;
  if (overrideAmount !== null) {
    vatAmount = overrideAmount;
    vatRate = null;
  } else {
    vatRate = overrideRate !== null ? overrideRate : defaultVatRate;
    vatAmount = subtotal * (vatRate / 100);
  }
  vatAmount = round2(vatAmount);

  const invoiceTotal = round2(subtotal + vatAmount);
  const staged = items.some((i) => i.stage === "upfront");
  const upfrontSubtotal = staged
    ? round2(
        items
          .filter((i) => i.stage === "upfront")
          .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
      )
    : subtotal;

  // Round the upfront half once and derive the later half by subtraction, so a
  // stray fils can never leave the invoice unsettleable.
  const upfrontVat =
    staged && subtotal > 0
      ? round2(vatAmount * (upfrontSubtotal / subtotal))
      : vatAmount;
  const upfrontTotal = round2(upfrontSubtotal + upfrontVat);

  return {
    items,
    subtotal,
    vatAmount,
    vatRate,
    vatLabel: vatRate === null ? "VAT" : `${vatRate}% VAT`,
    invoiceTotal,
    staged,
    upfrontSubtotal,
    upfrontVat,
    upfrontTotal,
    laterSubtotal: round2(subtotal - upfrontSubtotal),
    laterVat: round2(vatAmount - upfrontVat),
    laterTotal: round2(invoiceTotal - upfrontTotal),
  };
}
