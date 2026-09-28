// Registration-court options on a proposal: Abu Dhabi, Dubai, DIFC.
//
// The Just Wills fee is the same whichever court registers the will; only the
// government fee differs. So the team can offer the client more than one court
// and let the client pick on the accept page. Settled with the client:
//
//  - Fees are typed per proposal. There are no fixed or default amounts.
//  - One court offered -> the proposal is exactly what it was before this
//    existed: an ordinary fee line, no choice to make.
//  - Two or three offered -> they are shown as "choose one" alternatives and are
//    NOT added into the total, because the client only ever pays one of them.
//  - The client's choice is final once accepted; only the team can change it.
//  - DIFC is a payment option only — the team does not draft DIFC wills.
//
// Storage, deliberately minimal:
//  - `proposals.court_options` (jsonb) holds what was OFFERED.
//  - The CHOSEN court is not a column. It is the line item carrying `court`.
//    Every renderer, the payment link and the invoice already read line_items,
//    so putting the chosen fee there means none of them needs to know this
//    feature exists — and there is no second copy of the choice to go stale.
//
// Pure and dependency-free apart from the line-item model and the (equally
// pure) money calculator, so the dialog, the routes, the PDFs and the public
// accept page can all share it.

import {
  canonicalLineItems,
  lineItemsSubtotal,
  normalizeLineItems,
  type CourtId,
  type InvoiceLineItem,
} from "@/lib/pdf/invoiceLineItems";
import {
  computeInvoiceAmounts,
  type InvoiceAmounts,
  type VatSource,
} from "@/lib/finance/invoiceAmounts";

export type { CourtId };

/** Display order everywhere: the order the client's own proposal lists them. */
export const COURT_IDS: readonly CourtId[] = ["abu_dhabi", "dubai", "difc"];

export const COURT_LABELS: Record<CourtId, string> = {
  abu_dhabi: "Abu Dhabi",
  dubai: "Dubai",
  difc: "DIFC",
};

/**
 * One court the team is offering. `amount` is the LINE TOTAL, already extended
 * by quantity — the same convention as InvoiceLineItem, never multiplied again.
 */
export type CourtOption = {
  court: CourtId;
  description: string;
  amount: number;
  quantity: number;
};

export function isCourtId(value: unknown): value is CourtId {
  return value === "abu_dhabi" || value === "dubai" || value === "difc";
}

/** Pre-filled, editable description — the wording the team already types. */
export function defaultCourtDescription(court: CourtId): string {
  return `${COURT_LABELS[court]} Court Fee`;
}

/**
 * Clean whatever came out of jsonb or a request body: unknown courts dropped,
 * one entry per court (first wins), fixed display order. Never throws.
 */
export function normalizeCourtOptions(raw: unknown): CourtOption[] {
  if (!Array.isArray(raw)) return [];
  const byCourt = new Map<CourtId, CourtOption>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (!isCourtId(e.court) || byCourt.has(e.court)) continue;
    const qty = Math.round(Number(e.quantity));
    const description =
      typeof e.description === "string" && e.description.trim()
        ? e.description.trim()
        : defaultCourtDescription(e.court);
    byCourt.set(e.court, {
      court: e.court,
      description,
      amount: Number(e.amount) || 0,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
    });
  }
  return COURT_IDS.filter((c) => byCourt.has(c)).map((c) => byCourt.get(c)!);
}

/** Order-insensitive equality on everything the client reads. */
export function sameCourtOptions(a: unknown, b: unknown): boolean {
  const x = normalizeCourtOptions(a);
  const y = normalizeCourtOptions(b);
  if (x.length !== y.length) return false;
  return x.every((o, i) => {
    const p = y[i];
    return (
      o.court === p.court &&
      o.description === p.description &&
      Math.abs(o.amount - p.amount) < 0.005 &&
      o.quantity === p.quantity
    );
  });
}

/**
 * The fee line for a chosen court. Always "later": court fees are paid at the
 * court appointment, and "later" is exactly what an unticked row already gets
 * from parseLineItemRows, so an unstaged proposal stays unstaged.
 */
export function courtLineItem(option: CourtOption): InvoiceLineItem {
  return {
    description: option.description,
    amount: option.amount,
    quantity: option.quantity,
    stage: "later",
    court: option.court,
  };
}

/** Everything except the chosen court's fee line — the part that never varies. */
export function baseLineItems(items: InvoiceLineItem[] | null | undefined): InvoiceLineItem[] {
  return (items || []).filter((i) => !isCourtId(i?.court));
}

/** The court the client (or the team) has chosen, read off the line items. */
export function chosenCourt(items: InvoiceLineItem[] | null | undefined): CourtId | null {
  const line = (items || []).find((i) => isCourtId(i?.court));
  return line ? (line.court as CourtId) : null;
}

/**
 * Line items with `court` as the chosen option: any previous court line is
 * replaced, and the new one goes last (where the team's "Court Fee" row always
 * sat). `null` removes the choice.
 */
export function withChosenCourt(
  items: InvoiceLineItem[] | null | undefined,
  options: CourtOption[],
  court: CourtId | null
): InvoiceLineItem[] {
  const base = baseLineItems(items);
  if (!court) return base;
  const option = options.find((o) => o.court === court);
  if (!option) throw new Error(`Court "${court}" was not offered on this proposal`);
  return [...base, courtLineItem(option)];
}

/**
 * True while the client still has a choice to make: more than one court was
 * offered and none has been chosen yet.
 */
export function awaitingCourtChoice(
  items: InvoiceLineItem[] | null | undefined,
  rawOptions: unknown
): boolean {
  return normalizeCourtOptions(rawOptions).length > 1 && chosenCourt(items) === null;
}

// --- Stage 5 wording -------------------------------------------------------

/**
 * Placeholder in the proposal body for the court the schedule is finalised
 * with. Resolved at render time (like FEE_TABLE_TOKEN) rather than when saved,
 * so the wording follows the client's choice after they make it. Proposals
 * saved before this existed carry the literal "Abu Dhabi judge" and are
 * untouched.
 */
export const COURT_TOKEN = "{{COURT}}";

const COURT_PHRASES: Record<CourtId, string> = {
  abu_dhabi: "Abu Dhabi judge",
  dubai: "Dubai judge",
  difc: "DIFC Courts",
};

/**
 * The chosen court if there is one, else the only court offered, else the
 * general wording the client agreed to for when it is not yet known.
 */
export function courtPhrase(
  items: InvoiceLineItem[] | null | undefined,
  rawOptions: unknown
): string {
  const chosen = chosenCourt(items);
  if (chosen) return COURT_PHRASES[chosen];
  const options = normalizeCourtOptions(rawOptions);
  if (options.length === 1) return COURT_PHRASES[options[0].court];
  return "the relevant court";
}

export function resolveCourtToken(
  content: string,
  items: InvoiceLineItem[] | null | undefined,
  rawOptions: unknown
): string {
  if (!content.includes(COURT_TOKEN)) return content;
  return content.split(COURT_TOKEN).join(courtPhrase(items, rawOptions));
}

// --- What the client sees before choosing -----------------------------------

/**
 * For each offered court, the complete line items the proposal would have if
 * the client chose it. Callers run these through computeInvoiceAmounts to show
 * "Total if you choose Dubai", so the per-option totals and the figure charged
 * after choosing come from the same calculation.
 */
export function optionLineItems(
  items: InvoiceLineItem[] | null | undefined,
  rawOptions: unknown
): { option: CourtOption; items: InvoiceLineItem[] }[] {
  const options = normalizeCourtOptions(rawOptions);
  const rawBase = baseLineItems(items);
  // normalizeLineItems invents a "Will (UAE)" row for an empty list; a proposal
  // whose only charge is the court fee must not gain one.
  const base = rawBase.length > 0 ? normalizeLineItems(rawBase, 0) : [];
  return options.map((option) => ({ option, items: [...base, courtLineItem(option)] }));
}

/**
 * Everything a renderer needs to show a proposal that is still awaiting the
 * client's court choice: the part that never varies, and each option's full
 * figures. There is no single total yet, so callers must not show one — this
 * is what they show instead.
 *
 * Every figure comes from computeInvoiceAmounts over optionLineItems, so the
 * "total if chosen" on the email, both PDFs and (later) the accept page is the
 * exact figure the invoice will carry once the client picks that court.
 */
export type CourtChoiceSummary = {
  /** Base items only — no court line, and no invented "Will (UAE)" row. */
  baseItems: InvoiceLineItem[];
  /** Before any government fee and before VAT. */
  baseSubtotal: number;
  options: { option: CourtOption; items: InvoiceLineItem[]; amounts: InvoiceAmounts }[];
  /** Cheapest option's total incl. VAT — the "from" figure. */
  lowestTotal: number;
  /**
   * Taken from the first option. The court line is always "later", so at a VAT
   * rate every option has the same upfront figure; only an absolute VAT
   * override could make them differ, and the team does not use one on
   * proposals.
   */
  staged: boolean;
  upfrontTotal: number;
};

export function courtChoiceSummary(
  items: InvoiceLineItem[] | null | undefined,
  rawOptions: unknown,
  vat: VatSource,
  defaultVatRate: number
): CourtChoiceSummary {
  const rawBase = baseLineItems(items);
  // Same reason as optionLineItems: an empty base must stay empty.
  const baseItems = rawBase.length > 0 ? normalizeLineItems(rawBase, 0) : [];
  const options = optionLineItems(items, rawOptions).map(({ option, items: optItems }) => ({
    option,
    items: optItems,
    amounts: computeInvoiceAmounts(
      { amount: 0, line_items: optItems, vat_rate: vat.vat_rate, vat_amount: vat.vat_amount },
      defaultVatRate
    ),
  }));
  const first = options[0]?.amounts;
  return {
    baseItems,
    baseSubtotal: lineItemsSubtotal(baseItems),
    options,
    lowestTotal: options.length
      ? Math.min(...options.map((o) => o.amounts.invoiceTotal))
      : 0,
    staged: first ? first.staged : false,
    upfrontTotal: first ? first.upfrontTotal : 0,
  };
}

// --- Deciding what a (re-)sent proposal stores ------------------------------

/** The fields of an already-saved proposal row the planner reads. */
export type ExistingProposalCourts = {
  line_items?: unknown;
  court_options?: unknown;
  proposal_content?: unknown;
};

/**
 * Given the base items the team typed and the courts they ticked, decide the
 * line items and court_options to store. Shared by the send route (via
 * upsertLeadDeal) and the dialog's Save Draft, so a draft and a sent proposal
 * can never disagree about whether a court fee is in the total.
 *
 *  - 0 courts  -> the base items; court_options null (picker not used).
 *  - 1 court   -> base + that court's fee line: an ordinary proposal.
 *  - 2-3 courts -> base only; the client chooses later. EXCEPT that a re-send
 *    of exactly what the client already saw (a reminder) keeps the court they
 *    chose — wiping it would ask them to choose again for no reason. If the
 *    offered courts, the base items or the body changed, the choice belonged
 *    to an offer that no longer exists and is dropped.
 *
 * "Changed" is decided with canonicalLineItems, the same comparison the
 * acceptance reset in proposalInvoice.ts uses, so the choice and the acceptance
 * always survive or fall together.
 */
export function planProposalCourts({
  baseItems,
  options: rawOptions,
  existing,
  proposalContent,
}: {
  baseItems: InvoiceLineItem[];
  options: unknown;
  existing?: ExistingProposalCourts | null;
  /** Undefined = the body is not being rewritten, so it cannot have changed. */
  proposalContent?: string | null;
}): { lineItems: InvoiceLineItem[]; courtOptions: CourtOption[] | null } {
  // Any court line in the input is the planner's to decide, not the caller's.
  const base = baseLineItems(baseItems);
  const options = normalizeCourtOptions(rawOptions);

  if (options.length === 0) return { lineItems: base, courtOptions: null };
  if (options.length === 1) {
    return { lineItems: withChosenCourt(base, options, options[0].court), courtOptions: options };
  }

  const existingItems = Array.isArray(existing?.line_items)
    ? (existing!.line_items as InvoiceLineItem[])
    : [];
  const previous = existing ? chosenCourt(existingItems) : null;
  const keepChoice =
    previous !== null &&
    options.some((o) => o.court === previous) &&
    sameCourtOptions(existing!.court_options, options) &&
    canonicalLineItems(baseLineItems(existingItems)) === canonicalLineItems(base) &&
    (proposalContent === undefined ||
      (existing!.proposal_content ?? null) === (proposalContent ?? null));

  return {
    lineItems: keepChoice ? withChosenCourt(base, options, previous) : base,
    courtOptions: options,
  };
}
