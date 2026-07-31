/**
 * Shared lead status-change path.
 *
 * SERVER ONLY.
 *
 * Every status change has to fire the same "Status Changes" notification (and
 * the manager "deal won" alert). That logic used to live inside the lead PATCH
 * route, which meant any other server code that wanted to move a lead had to
 * either duplicate it or write `leads.status` directly and silently skip the
 * notifications. It lives here now so both the PATCH route and the automatic
 * rules (e.g. contact-cadence auto-unreachable) go through one implementation.
 *
 * A route file may only export route handlers, which is why this is a lib
 * module rather than an export from `app/api/.../leads/[id]/route.ts`.
 */

import { createClient } from "@supabase/supabase-js";
import { getLeadAutomationSettings } from "./settingsServer";
import { isRuleActive } from "./settingsTypes";
import { getLeadManagerIds, notifyLeadEvent } from "./leadNotifications";
import { buildBrandedLeadEmailHtml } from "./leadEmailTemplates";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Statuses that must never be walked backwards by an automatic rule. */
export const CLOSED_LEAD_STATUSES = ["won", "lost", "unreachable"] as const;

export function isClosedLeadStatus(status: string | null | undefined): boolean {
  return !!status && (CLOSED_LEAD_STATUSES as readonly string[]).includes(status);
}

const prettyStatus = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Fires the "Status Changes" notification to the lead's owner, and — when the
 * `notify_manager_won` automation rule is on and the lead just moved to Won —
 * to every user holding the `lead_management` role.
 *
 * Notifications never block or roll back the update that triggered them.
 */
export async function dispatchStatusChangeNotifications(params: {
  leadId: string;
  leadName: string;
  previousStatus: string | null;
  newStatus: string;
  assignedTo: string | null;
  actorUserId: string | null;
}) {
  const { leadId, leadName, previousStatus, newStatus, assignedTo, actorUserId } = params;

  try {
    const from = previousStatus ? prettyStatus(previousStatus) : "—";
    const to = prettyStatus(newStatus);
    const leadUrl = `${appUrl()}/admin/lead-management/leads/${leadId}`;

    const linkHtml = `
      <div style="text-align:center;margin:24px 0;">
        <a href="${leadUrl}" style="background-color:#0C5536;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:5px;display:inline-block;font-weight:bold;">View Lead</a>
      </div>`;

    // Owner of the lead. Skipped when the person who made the change is the
    // owner — nobody needs an email about their own click.
    if (assignedTo && assignedTo !== actorUserId) {
      await notifyLeadEvent({
        eventType: "status_changed",
        recipientId: assignedTo,
        leadId,
        actorUserId,
        title: `${leadName}: ${from} → ${to}`,
        body: `Lead status changed to ${to}.`,
        metadata: { previousStatus, newStatus },
        email: {
          subject: `Lead status updated: ${leadName} is now ${to}`,
          html: buildBrandedLeadEmailHtml({
            heading: `${leadName}`,
            subtitle: "Lead Status Update",
            bodyText: `The status of ${leadName} changed from ${from} to ${to}.`,
            extraHtml: linkHtml,
          }),
        },
      });
    }

    if (newStatus !== "won") return;

    const automation = await getLeadAutomationSettings();
    if (!isRuleActive(automation, "notify_manager_won")) return;

    const managerIds = await getLeadManagerIds();
    for (const managerId of managerIds) {
      // The owner already got the status-change mail above; don't double-send.
      if (managerId === assignedTo) continue;
      await notifyLeadEvent({
        // `deal_won`, NOT `status_changed`: this alert exists only because an
        // admin switched the `notify_manager_won` rule on, so the rule must be
        // its only gate. Filing it as a status change would let the general
        // "Status Changes" notification switch silently cancel it.
        eventType: "deal_won",
        recipientId: managerId,
        leadId,
        actorUserId,
        title: `Deal won: ${leadName}`,
        body: `${leadName} has been marked as Won.`,
        metadata: { previousStatus, newStatus, rule: "notify_manager_won" },
        email: {
          subject: `Deal won: ${leadName}`,
          html: buildBrandedLeadEmailHtml({
            heading: "A deal has been won",
            subtitle: "Lead Management Notification",
            bodyText: `${leadName} has just been marked as Won.`,
            extraHtml: linkHtml,
          }),
        },
      });
    }
  } catch (err) {
    console.error("Status-change notification failed:", err);
  }
}

export interface ApplyLeadStatusChangeResult {
  changed: boolean;
  previousStatus: string | null;
  error: string | null;
}

/**
 * Move a lead to `newStatus` and dispatch exactly the notifications the PATCH
 * route dispatches. Server-side automatic rules must call this instead of
 * updating `leads.status` themselves.
 */
export async function applyLeadStatusChange(params: {
  leadId: string;
  newStatus: string;
  actorUserId: string | null;
}): Promise<ApplyLeadStatusChangeResult> {
  const { leadId, newStatus, actorUserId } = params;

  const { data: existingLead, error: fetchError } = await supabaseAdmin
    .from("leads")
    .select("id, status, assigned_to, full_name")
    .eq("id", leadId)
    .single();

  if (fetchError || !existingLead) {
    return { changed: false, previousStatus: null, error: "Lead not found" };
  }

  if (existingLead.status === newStatus) {
    return { changed: false, previousStatus: existingLead.status, error: null };
  }

  const { error: updateError } = await supabaseAdmin
    .from("leads")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (updateError) {
    return {
      changed: false,
      previousStatus: existingLead.status,
      error: updateError.message,
    };
  }

  await dispatchStatusChangeNotifications({
    leadId,
    leadName: existingLead.full_name || "Lead",
    previousStatus: existingLead.status,
    newStatus,
    assignedTo: existingLead.assigned_to || null,
    actorUserId,
  });

  return { changed: true, previousStatus: existingLead.status, error: null };
}
