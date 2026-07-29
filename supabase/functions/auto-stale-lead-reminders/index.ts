// `auto_reminder_7days` — the "Auto-create reminder for stale leads"
// automation rule.
//
// A lead with nobody chasing it goes quiet and stays quiet. Once a day this
// finds every open, assigned lead whose last logged communication is older
// than the configured threshold (the number input beside the rule in the
// Automation tab; 7 days by default) and creates a follow-up reminder for its
// owner. The existing send-lead-reminders cron then delivers it like any other
// reminder, so there is exactly one reminder pipeline.
//
// Switching the rule off in the Automation tab makes this function a no-op —
// the schedule can stay installed and the toggle alone decides.
//
// Duplicate protection: a lead that already has an open reminder is skipped,
// so a lead that stays stale accumulates one reminder, not one per day.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Statuses where silence is expected and a nag would be noise.
const CLOSED_STATUSES = ['won', 'lost', 'unreachable'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settingRows } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['lead_automation', 'lead_notifications']);

    const byKey = new Map<string, Record<string, unknown>>();
    for (const row of settingRows || []) {
      byKey.set(row.setting_key, (row.setting_value ?? {}) as Record<string, unknown>);
    }

    const automation = byKey.get('lead_automation') || {};
    const rules = Array.isArray(automation.rules)
      ? (automation.rules as { id?: string; isActive?: boolean }[])
      : [];
    const rule = rules.find((r) => r.id === 'auto_reminder_7days');
    // Missing row => defaults, and the rule ships enabled.
    const ruleActive = rule ? rule.isActive !== false : true;

    if (!ruleActive) {
      return json({ success: true, skipped: 'auto_reminder_7days is disabled', created: 0 });
    }

    const staleDaysRaw = Number(automation.staleLeadDays);
    const staleDays =
      Number.isFinite(staleDaysRaw) && staleDaysRaw >= 1 ? Math.floor(staleDaysRaw) : 7;
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    const frequency =
      ((byKey.get('lead_notifications') || {}).notificationFrequency as string) || 'immediate';

    // Open, assigned leads only. An unassigned lead has no one to remind.
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, full_name, assigned_to, status, created_at')
      .not('assigned_to', 'is', null)
      .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`);
    if (leadsError) throw leadsError;

    const openLeads = leads || [];
    if (openLeads.length === 0) {
      return json({ success: true, message: 'no open assigned leads', created: 0 });
    }

    const leadIds = openLeads.map((l) => l.id as string);

    // Last logged contact per lead.
    const { data: comms } = await supabase
      .from('lead_communications')
      .select('lead_id, scheduled_at')
      .in('lead_id', leadIds);

    const lastContact = new Map<string, number>();
    for (const c of comms || []) {
      const t = new Date(c.scheduled_at as string).getTime();
      if (!Number.isFinite(t)) continue;
      const prev = lastContact.get(c.lead_id as string) ?? 0;
      if (t > prev) lastContact.set(c.lead_id as string, t);
    }

    // Leads that already have an open reminder are already being chased.
    const { data: openReminders } = await supabase
      .from('lead_reminders')
      .select('lead_id')
      .in('lead_id', leadIds)
      .in('status', ['pending', 'triggered']);
    const alreadyChased = new Set((openReminders || []).map((r) => r.lead_id as string));

    const now = new Date();
    const stale = openLeads.filter((lead) => {
      if (alreadyChased.has(lead.id as string)) return false;
      // No communication ever logged => measure from lead creation.
      const last =
        lastContact.get(lead.id as string) ??
        new Date((lead.created_at as string) ?? now.toISOString()).getTime();
      return last < cutoff.getTime();
    });

    if (stale.length === 0) {
      return json({ success: true, message: 'no stale leads', created: 0, staleDays });
    }

    const remindAt = now.toISOString();
    const { error: insertError } = await supabase.from('lead_reminders').insert(
      stale.map((lead) => ({
        lead_id: lead.id,
        salesperson_id: lead.assigned_to,
        title: `Follow up: no contact in ${staleDays} days`,
        description: `${lead.full_name} has had no logged communication for ${staleDays}+ days. Created automatically by the stale-lead rule.`,
        remind_at: remindAt,
        status: 'pending',
      }))
    );
    if (insertError) throw insertError;

    // Record the event too so stale leads show up in the daily/weekly digest.
    // No email is built: in immediate mode the reminder itself is the alert,
    // so a second "this lead is stale" email would just be noise.
    const digestState = frequency === 'immediate' ? 'none' : 'digest';
    const { error: eventError } = await supabase.from('lead_notification_events').insert(
      stale.map((lead) => ({
        recipient_id: lead.assigned_to,
        lead_id: lead.id,
        event_type: 'lead_stale',
        title: `${lead.full_name} has gone quiet`,
        body: `No logged communication for ${staleDays}+ days.`,
        metadata: { staleDays, rule: 'auto_reminder_7days' },
        email_state: digestState,
      }))
    );
    if (eventError) console.error('Failed to record stale-lead events:', eventError);

    return json({ success: true, created: stale.length, staleDays });
  } catch (error) {
    console.error('auto-stale-lead-reminders failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function json(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
