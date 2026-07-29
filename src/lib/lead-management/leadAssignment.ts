/**
 * The one place a new lead's owner is decided.
 *
 * There are two lead-creation entry points — the dashboard/API route
 * (`/api/lead-management/leads`) and the public QR intake form
 * (`/api/public/intake`) — and they each carried their own copy of this logic.
 * That meant the Team tab's assignment dropdown could only ever govern half of
 * the incoming leads. Both routes now call this.
 *
 * Behaviour, driven entirely by the Team tab plus one automation rule:
 *
 *   autoAssignNewLeads OFF -> nobody is assigned, whatever the method is.
 *   manual                 -> nobody is assigned; a human picks later.
 *   by_source              -> salespeople linked to the lead's source; if the
 *                             source has none (or there is no source), fall
 *                             back to a workload round-robin across ALL
 *                             salespeople. This is the historical behaviour and
 *                             is preserved exactly.
 *                             The `auto_assign_source` automation rule gates the
 *                             source lookup itself, so switching it off degrades
 *                             this to a plain round-robin.
 *   round_robin            -> the source mapping is never consulted; always the
 *                             lightest-loaded salesperson.
 *
 * SERVER ONLY.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLeadAutomationSettings, getLeadTeamSettings } from "./settingsServer";
import { isRuleActive, type LeadTeamSettings } from "./settingsTypes";

export type LeadAssignmentResult = {
  assignedTo: string | null;
  assignedAt: string | null;
  /** Returned so callers can also honour `notifyOnAssignment` without refetching. */
  teamSettings: LeadTeamSettings;
};

export async function resolveLeadAssignment(
  supabaseAdmin: SupabaseClient,
  sourceId: string | null
): Promise<LeadAssignmentResult> {
  const [teamSettings, automationSettings] = await Promise.all([
    getLeadTeamSettings(),
    getLeadAutomationSettings(),
  ]);

  let assignedTo: string | null = null;

  const shouldAutoAssign =
    teamSettings.autoAssignNewLeads && teamSettings.defaultAssignmentMethod !== "manual";

  if (shouldAutoAssign) {
    let salespersonIds: string[] = [];

    const useSourceMapping =
      teamSettings.defaultAssignmentMethod === "by_source" &&
      isRuleActive(automationSettings, "auto_assign_source");

    if (useSourceMapping && sourceId) {
      const { data: assignments } = await supabaseAdmin
        .from("source_salesperson_assignments")
        .select("salesperson_id")
        .eq("source_id", sourceId);
      salespersonIds = (assignments || []).map(
        (a: { salesperson_id: string }) => a.salesperson_id
      );
    }

    if (salespersonIds.length === 0) {
      // Fallback: every user with the salesperson role, so a lead is never
      // left unassigned merely because its source has no mapping.
      const { data: roleRows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "salesperson");
      salespersonIds = (roleRows || []).map((r: { user_id: string }) => r.user_id);
    }

    if (salespersonIds.length === 1) {
      assignedTo = salespersonIds[0];
    } else if (salespersonIds.length > 1) {
      // Round-robin by workload (least assigned leads).
      const { data: leadCounts, error: countError } = await supabaseAdmin
        .from("leads")
        .select("assigned_to")
        .in("assigned_to", salespersonIds)
        .not("assigned_to", "is", null);

      if (!countError) {
        const countMap: Record<string, number> = {};
        salespersonIds.forEach((id) => {
          countMap[id] = 0;
        });
        (leadCounts || []).forEach((lead: { assigned_to: string | null }) => {
          if (lead.assigned_to) {
            countMap[lead.assigned_to] = (countMap[lead.assigned_to] || 0) + 1;
          }
        });

        let minCount = Infinity;
        let selectedSalesperson = salespersonIds[0];
        for (const id of salespersonIds) {
          if (countMap[id] < minCount) {
            minCount = countMap[id];
            selectedSalesperson = id;
          }
        }
        assignedTo = selectedSalesperson;
      } else {
        assignedTo = salespersonIds[0];
      }
    }
  }

  return {
    assignedTo,
    assignedAt: assignedTo ? new Date().toISOString() : null,
    teamSettings,
  };
}
