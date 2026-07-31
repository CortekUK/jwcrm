// "When did we last actually talk to this lead, and what is due next?" —
// answered from the communication log and the reminder queue rather than from
// the lead row's own timestamps.
//
// The health badge used to key off `leads.updated_at`, so any unrelated edit
// (a status change, a note, a reassignment) reset a fortnight-old lead to
// "Hot". There is no last_contact_date / next_action_date column to read
// instead: the real signals are the newest lead_communications.scheduled_at
// and the earliest outstanding lead_reminders.remind_at.

import { supabase } from "@/integrations/supabase/client";

export type LeadActivitySummary = {
  /** Newest logged communication for the lead, ISO string. */
  lastContactAt: string | null;
  /** Earliest still-outstanding reminder for the lead, ISO string. */
  nextActionAt: string | null;
};

// A reminder still counts as outstanding until it is done or dismissed;
// "triggered" only means the cron noticed it was due.
const OUTSTANDING_REMINDER_STATUSES = ["pending", "triggered"] as const;

/**
 * Activity summary per lead id, in two queries regardless of lead count.
 *
 * Leads with neither a communication nor a reminder are simply absent from the
 * map — callers must treat that as "unknown", not as "no recent contact".
 */
export async function fetchLeadActivity(
  leadIds: string[]
): Promise<Map<string, LeadActivitySummary>> {
  const result = new Map<string, LeadActivitySummary>();
  if (leadIds.length === 0) return result;

  const entryFor = (leadId: string): LeadActivitySummary => {
    const existing = result.get(leadId);
    if (existing) return existing;
    const created: LeadActivitySummary = { lastContactAt: null, nextActionAt: null };
    result.set(leadId, created);
    return created;
  };

  const [communications, reminders] = await Promise.all([
    supabase
      .from("lead_communications")
      .select("lead_id, scheduled_at")
      .in("lead_id", leadIds),
    supabase
      .from("lead_reminders")
      .select("lead_id, remind_at, status")
      .in("lead_id", leadIds)
      .in("status", [...OUTSTANDING_REMINDER_STATUSES]),
  ]);

  // Compared as timestamps rather than strings: the offset suffix PostgREST
  // returns is not guaranteed to sort lexically across rows.
  const at = (value: string) => new Date(value).getTime();

  for (const row of communications.data || []) {
    if (!row.scheduled_at) continue;
    const entry = entryFor(row.lead_id);
    if (!entry.lastContactAt || at(row.scheduled_at) > at(entry.lastContactAt)) {
      entry.lastContactAt = row.scheduled_at;
    }
  }

  for (const row of reminders.data || []) {
    if (!row.remind_at) continue;
    const entry = entryFor(row.lead_id);
    if (!entry.nextActionAt || at(row.remind_at) < at(entry.nextActionAt)) {
      entry.nextActionAt = row.remind_at;
    }
  }

  return result;
}
