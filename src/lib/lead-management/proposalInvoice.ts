import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceLineItem } from "@/lib/pdf/invoiceLineItems";

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
};

const ALLOWED_LEAD_DEAL_ROLES = new Set([
  "admin",
  "superadmin",
  "lead_management",
  "finance",
  "salesperson",
]);

/**
 * Finds the lead's active (not paid/cancelled) proposal row and updates it,
 * or inserts a new one. A closed deal is never reused — a fresh proposal
 * always starts a new row, preserving history.
 */
export async function upsertLeadDeal(
  supabaseAdmin: SupabaseClient,
  params: UpsertLeadDealParams
) {
  const { leadId, mode, amount, currency, lineItems, proposalContent } = params;

  const { data: existing, error: findError } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("lead_id", leadId)
    .not("status", "in", "(paid,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  const now = new Date().toISOString();
  const baseFields: Record<string, unknown> = {
    amount,
    currency,
    status: "sent",
    sent_at: now,
  };
  if (lineItems) baseFields.line_items = lineItems;
  if (proposalContent !== undefined) baseFields.proposal_content = proposalContent;
  if (mode === "invoice") baseFields.invoiced_at = now;

  if (existing) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("proposals")
      .update(baseFields)
      .eq("id", existing.id)
      .select()
      .single();
    if (updateError) throw updateError;
    return { proposal: updated, isNew: false as const };
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
  return { proposal: inserted, isNew: true as const };
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
