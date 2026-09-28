import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canonicalLineItems,
  lineItemsSubtotal,
  type InvoiceLineItem,
} from "@/lib/pdf/invoiceLineItems";
import {
  planProposalCourts,
  sameCourtOptions,
  type CourtOption,
} from "@/lib/lead-management/courtOptions";

/**
 * Shared by all three lead-invoicing entry points (Send Proposal, Send
 * Invoice, salesperson Generate Invoice) so a lead's deal lives in ONE
 * `proposals` row instead of three disconnected ones. A proposal and its
 * later invoice are the same row — `mode: 'invoice'` just adds payment
 * capability (`invoiced_at`) to whatever's already there.
 */

export type LeadDealMode = "proposal" | "invoice";

export type UpsertLeadDealParams = {
  leadId: string;
  mode: LeadDealMode;
  amount: number;
  currency: string;
  lineItems?: InvoiceLineItem[];
  proposalContent?: string | null;
  /**
   * Per-invoice VAT override (percent). Left undefined the column stays NULL
   * and every reader falls back to companyDetails.vatRate, so legacy rows and
   * callers that do not collect a rate keep behaving exactly as before.
   */
  vatRate?: number | null;
  /** Absolute VAT override; wins over vatRate wherever the money is computed. */
  vatAmount?: number | null;
  /**
   * Registration courts offered (proposal mode only). Undefined leaves
   * court_options and the court line exactly as they are — which is how the
   * invoice paths, which never offer a choice, keep behaving unchanged.
   * When supplied, `lineItems` are the BASE items and this function decides
   * whether a court fee line goes into them (see planProposalCourts), and
   * `amount` is recomputed from the result.
   */
  courtOptions?: CourtOption[];
};

const ALLOWED_LEAD_DEAL_ROLES = new Set([
  "admin",
  "superadmin",
  "lead_management",
  "finance",
  "salesperson",
]);

/** Money comparison that tolerates PostgREST returning numerics as strings. */
function sameAmount(a: unknown, b: unknown): boolean {
  const x = Number(a);
  const y = Number(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return a === b;
  return Math.abs(x - y) < 0.005;
}

/**
 * Has the offer the client is being asked to agree to actually changed?
 *
 * Only the things a client would read: the total, the itemisation (which
 * carries the amounts AND which items are due upfront), the body text, and the
 * registration courts they are offered to choose between.
 * A false positive here only clears an acceptance that the client can grant
 * again, so this deliberately errs towards "changed".
 */
function proposalTermsChanged(
  existing: Record<string, unknown>,
  next: {
    amount: number;
    lineItems?: InvoiceLineItem[];
    proposalContent?: string | null;
    courtOptions?: CourtOption[] | null;
  }
): boolean {
  if (!sameAmount(existing.amount, next.amount)) return true;
  if (next.lineItems && canonicalLineItems(existing.line_items) !== canonicalLineItems(next.lineItems))
    return true;
  // With two or three courts offered the fee lines are NOT in line_items, so
  // re-pricing a court or offering a different set changes neither the amount
  // nor the items — without this it would keep the old acceptance.
  if (next.courtOptions !== undefined && !sameCourtOptions(existing.court_options, next.courtOptions))
    return true;
  if (next.proposalContent !== undefined && (existing.proposal_content ?? null) !== (next.proposalContent ?? null))
    return true;
  return false;
}

/**
 * Finds the lead's active (not paid/cancelled) proposal row and updates it,
 * or inserts a new one. A closed deal is never reused — a fresh proposal
 * always starts a new row, preserving history.
 */
export async function upsertLeadDeal(
  supabaseAdmin: SupabaseClient,
  params: UpsertLeadDealParams
) {
  const {
    leadId,
    mode,
    currency,
    proposalContent,
    vatRate,
    vatAmount,
    courtOptions,
  } = params;
  let { amount, lineItems } = params;

  const { data: existing, error: findError } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("lead_id", leadId)
    .not("status", "in", "(paid,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  // Court options: the planner decides whether a court fee line belongs in
  // the items, keeping a client's earlier choice only on an unchanged
  // re-send. The amount is then the subtotal of what is actually stored, not
  // what the caller sent — with several courts offered the caller's figure
  // cannot know whether a choice survived.
  let plannedCourtOptions: CourtOption[] | null | undefined;
  if (mode === "proposal" && courtOptions !== undefined) {
    const plan = planProposalCourts({
      baseItems: lineItems ?? [],
      options: courtOptions,
      existing: existing as Record<string, unknown> | null,
      proposalContent,
    });
    lineItems = plan.lineItems;
    plannedCourtOptions = plan.courtOptions;
    amount = lineItemsSubtotal(plan.lineItems);
  }

  const now = new Date().toISOString();
  const baseFields: Record<string, unknown> = {
    amount,
    currency,
    status: "sent",
    sent_at: now,
  };
  if (lineItems) baseFields.line_items = lineItems;
  // proposals.court_options is not in the generated types yet (migration
  // 20260928000001); baseFields is an untyped record, so no cast is needed.
  if (plannedCourtOptions !== undefined) baseFields.court_options = plannedCourtOptions;
  if (proposalContent !== undefined) baseFields.proposal_content = proposalContent;
  // Only written when supplied — an omitted override must stay NULL rather
  // than being stamped with a default, which is what keeps legacy invoices
  // resolving through companyDetails.vatRate.
  if (vatRate !== undefined) baseFields.vat_rate = vatRate;
  if (vatAmount !== undefined) baseFields.vat_amount = vatAmount;
  if (mode === "invoice") baseFields.invoiced_at = now;

  if (existing) {
    // A re-sent proposal on DIFFERENT terms is a new offer, so the previous
    // acceptance no longer applies to it. Without this the row keeps its
    // accepted_at, the accept link reports "you've already accepted this" and
    // the client is locked out of agreeing to the revised figure — reported
    // from live use: "if i resend a proposal for a different amount, the
    // client cant re-accept the second proposal".
    //
    // Only on the proposal path: raising the invoice comes AFTER acceptance
    // and must not wipe it. An unchanged re-send (a reminder) keeps it too.
    const termsChanged =
      mode === "proposal" &&
      proposalTermsChanged(existing, {
        amount,
        lineItems,
        proposalContent,
        courtOptions: plannedCourtOptions,
      });

    const acceptanceReset = termsChanged && Boolean(existing.accepted_at);
    if (acceptanceReset) {
      baseFields.accepted_at = null;
      baseFields.accepted_ip = null;
      baseFields.accepted_user_agent = null;
    }

    // For the same reason an invoice already raised on the old terms is void:
    // the revised proposal replaces it, and the team sends a fresh invoice once
    // the client accepts. Clearing invoiced_at takes it off the outstanding
    // list and makes the old pay link land on "no longer active" (see
    // createBalanceCheckoutSession) instead of charging the new figure.
    //
    // Never once money has been taken against it — voiding a part-paid
    // invoice would hide a real payment from every balance and report.
    if (termsChanged && existing.invoiced_at) {
      const { count, error: paymentsError } = await supabaseAdmin
        .from("proposal_payments")
        .select("id", { count: "exact", head: true })
        .eq("proposal_id", existing.id);
      if (paymentsError) throw paymentsError;
      if (!count) baseFields.invoiced_at = null;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("proposals")
      .update(baseFields)
      .eq("id", existing.id)
      .select()
      .single();
    if (updateError) throw updateError;
    return { proposal: updated, isNew: false as const, acceptanceReset };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("proposals")
    .insert({
      lead_id: leadId,
      ...baseFields,
      proposal_content: proposalContent ?? null,
      line_items: lineItems ?? [],
    })
    .select()
    .single();
  if (insertError) throw insertError;
  return { proposal: inserted, isNew: true as const, acceptanceReset: false };
}

export type LeadDealAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Same role/ownership rule previously only enforced in the salesperson
 * invoice route: admin/superadmin/lead_management/finance can manage any
 * lead's deal; a caller who is ONLY a salesperson may only manage leads
 * assigned to them.
 */
export async function assertCanManageLeadDeal(
  supabaseAdmin: SupabaseClient,
  callerId: string | null,
  lead: { assigned_to?: string | null }
): Promise<LeadDealAuthResult> {
  if (!callerId) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: roleRows, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);
  if (roleErr) return { ok: false, status: 403, error: "Role lookup failed" };

  const callerRoles = new Set((roleRows || []).map((r: { role: string }) => r.role));
  const hasAllowedRole = [...callerRoles].some((r) => ALLOWED_LEAD_DEAL_ROLES.has(r));
  if (!hasAllowedRole) return { ok: false, status: 403, error: "Forbidden" };

  const isOnlySalesperson =
    callerRoles.has("salesperson") &&
    !callerRoles.has("admin") &&
    !callerRoles.has("superadmin") &&
    !callerRoles.has("lead_management") &&
    !callerRoles.has("finance");
  if (isOnlySalesperson && lead.assigned_to !== callerId) {
    return { ok: false, status: 403, error: "This lead is not assigned to you" };
  }

  return { ok: true };
}
