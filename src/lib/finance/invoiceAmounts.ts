// One definition of the money on an invoice: what it totals, how VAT is
// resolved, how it splits into payment stages, and what should be charged next.
//
// Two things forced this into a single module:
//
//  1. VAT is now editable per invoice. It used to be a fixed 5% read from
//     config at seven different render sites; if the stored override reached
//     only some of them, the client's invoice PDF and the balance the payment
//     link charges would disagree about what is owed.
//
//  2. Clients pay the will-drafting fee up front so work can begin, and the
//     court/notarization fees at the court-appointment stage. The amount due
//     "right now" is therefore not the invoice total and not the whole
//     remaining balance — it is whatever the current stage costs.
//
// Deliberately pure and dependency-free (no Supabase, no config import) so it
// can be used from server routes, client components, and mirrored into the Deno
// edge function that cannot import from src/. See
// supabase/functions/_shared/invoiceAmounts.ts — keep the two in step.

import {
  normalizeLineItems,
  lineItemsSubtotal,
  type InvoiceLineItem,
} from "@/lib/pdf/invoiceLineItems";

/** Sub-cent remainders are rounding noise, not a debt. */
export const BALANCE_EPSILON = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * PostgREST returns numerics as strings, and 0 is a legitimate VAT rate, so
 * this must distinguish "absent" from "zero" — a truthiness check would
 * silently turn a zero-rated invoice back into 5%.
 */
function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type VatSource = {
  vat_rate?: number | string | null;
  vat_amount?: number | string | null;
};

export type InvoiceAmountsInput = VatSource & {
  amount?: number | string | null;
  line_items?: InvoiceLineItem[] | null;
};

export type InvoiceAmounts = {
  items: InvoiceLineItem[];
  subtotal: number;
  vatAmount: number;
  /** null when an absolute vat_amount override is in force. */
  vatRate: number | null;
  /** Row label for the renderers: "5% VAT", or plain "VAT" for an override. */
  vatLabel: string;
  invoiceTotal: number;
  /** True once at least one line is marked "upfront". */
  staged: boolean;
  upfrontSubtotal: number;
  upfrontVat: number;
  upfrontTotal: number;
  laterSubtotal: number;
  laterVat: number;
  laterTotal: number;
};

/**
 * Resolve every figure on an invoice.
 *
 * VAT precedence: an absolute `vat_amount` wins, then `vat_rate`, then the
 * caller's default (companyDetails.vatRate for the app, a constant in the edge
 * function).
 */
export function computeInvoiceAmounts(
  proposal: InvoiceAmountsInput,
  defaultVatRate: number
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
  const vatLabel = vatRate === null ? "VAT" : `${vatRate}% VAT`;

  const staged = items.some((i) => i.stage === "upfront");
  const upfrontSubtotal = staged
    ? round2(
        items
          .filter((i) => i.stage === "upfront")
          .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
      )
    : subtotal;

  // Apportion VAT pro-rata and round ONCE, deriving the later half by
  // subtraction. Rounding both halves independently can leave a stray fils that
  // makes the invoice permanently unsettleable.
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
    vatLabel,
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

export type PaymentStage = "upfront" | "remainder" | "settled";

export type StageState = {
  stage: PaymentStage;
  /** Exactly what the next checkout must charge. Never negative. */
  amountDue: number;
  /** Whole invoice total minus everything received. May go negative. */
  balanceDue: number;
  totalPaid: number;
  /**
   * The gate for portal provisioning and the `drafting` pipeline stage.
   *
   * On an UNSTAGED invoice upfrontTotal === invoiceTotal, so this means the
   * same thing as fullySettled — which is what keeps every legacy invoice
   * behaving exactly as it does today, with no branching anywhere else.
   */
  upfrontCovered: boolean;
  fullySettled: boolean;
  amounts: InvoiceAmounts;
};

export function resolvePaymentStage(
  amounts: InvoiceAmounts,
  totalPaid: number
): StageState {
  const paid = Number(totalPaid) || 0;
  const balanceDue = round2(amounts.invoiceTotal - paid);
  const fullySettled = balanceDue <= BALANCE_EPSILON;
  const upfrontCovered = paid >= amounts.upfrontTotal - BALANCE_EPSILON;

  let stage: PaymentStage;
  let amountDue: number;
  if (fullySettled) {
    stage = "settled";
    amountDue = 0;
  } else if (amounts.staged && !upfrontCovered) {
    stage = "upfront";
    amountDue = round2(amounts.upfrontTotal - paid);
  } else {
    stage = "remainder";
    // Clamped: two stale checkout sessions completing can push paid past the
    // total, and a negative unit_amount would be rejected by Stripe anyway.
    amountDue = Math.max(0, balanceDue);
  }

  return {
    stage,
    amountDue,
    balanceDue,
    totalPaid: paid,
    upfrontCovered,
    fullySettled,
    amounts,
  };
}

export function sumPayments(
  payments: { amount: number | string | null }[] | null | undefined
): number {
  return round2(
    (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );
}
