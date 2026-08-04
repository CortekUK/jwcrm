// Lead-management notification mailer.
//
// Everything the Notifications tab promises but cannot do inside a single web
// request happens here. One function, three modes, chosen by the POST body:
//
//   { "mode": "flush" }   Runs every 15 minutes. When frequency is
//                         "immediate", events that occurred OUTSIDE the
//                         configured working hours were parked with
//                         email_state = 'pending'. Once the clock is back
//                         inside the window this sends them, in order. The
//                         subject and HTML were rendered when the event
//                         happened and stored on the row, so this function
//                         needs no app code and no template knowledge.
//
//   { "mode": "daily" }   Runs 08:00 GST daily.
//   { "mode": "weekly" }  Runs 08:00 GST Monday.
//                         When frequency matches, every event batched with
//                         email_state = 'digest' is folded into ONE email per
//                         recipient. A salesperson sees only their own leads.
//                         Users holding lead_management/admin additionally get
//                         a team-wide roll-up section.
//
// A mode whose frequency is not currently selected does nothing at all, so all
// three schedules can stay installed and the dropdown alone decides behaviour.
//
// Internal only — nothing here ever emails a client.

import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEAM_TIMEZONE = 'Asia/Dubai';

type Frequency = 'immediate' | 'daily' | 'weekly';

interface NotificationSettings {
  emailNewLeadAssigned?: boolean;
  emailStatusChanges?: boolean;
  emailReminders?: boolean;
  browserNotifications?: boolean;
  notificationFrequency?: Frequency;
}

interface TeamSettings {
  workingHoursStart?: string;
  workingHoursEnd?: string;
}

interface EventRow {
  id: string;
  recipient_id: string;
  lead_id: string | null;
  event_type: 'lead_assigned' | 'status_changed' | 'reminder_due' | 'lead_stale' | 'deal_won';
  title: string;
  body: string | null;
  email_subject: string | null;
  email_html: string | null;
  created_at: string;
}

function minutesOf(hhmm: string | undefined, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

function nowMinutesInTeamTz(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TEAM_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function isWithinWorkingHours(team: TeamSettings): boolean {
  const start = minutesOf(team.workingHoursStart, 0);
  const end = minutesOf(team.workingHoursEnd, 24 * 60);
  // An inverted or empty window is treated as "always open" — a misconfigured
  // window must never silently swallow every notification.
  if (start >= end) return true;
  const now = nowMinutesInTeamTz();
  return now >= start && now < end;
}

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SECTION_LABEL: Record<EventRow['event_type'], string> = {
  lead_assigned: 'New leads assigned to you',
  status_changed: 'Status changes on your leads',
  reminder_due: 'Reminders due',
  lead_stale: 'Leads gone stale',
  // Raised only by the `notify_manager_won` rule, so it is kept out of the
  // generic status-change section and called out on its own.
  deal_won: 'Deals won',
};

function listSection(label: string, rows: EventRow[]): string {
  if (rows.length === 0) return '';
  const items = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #EEE;color:#222;font-size:13px;">
            ${esc(r.title)}
            ${r.body ? `<div style="color:#777;font-size:12px;margin-top:2px;">${esc(r.body)}</div>` : ''}
          </td>
        </tr>`
    )
    .join('');
  return `
    <h3 style="color:#0C5536;font-size:15px;margin:22px 0 8px;">${esc(label)} (${rows.length})</h3>
    <table style="width:100%;border-collapse:collapse;">${items}</table>`;
}

function buildDigestHtml(options: {
  headline: string;
  ownRows: EventRow[];
  teamRows: EventRow[] | null;
}): string {
  const { headline, ownRows, teamRows } = options;

  const ownSections = (Object.keys(SECTION_LABEL) as EventRow['event_type'][])
    .map((type) =>
      listSection(
        SECTION_LABEL[type],
        ownRows.filter((r) => r.event_type === type)
      )
    )
    .join('');

  let teamBlock = '';
  if (teamRows && teamRows.length > 0) {
    const counts = (Object.keys(SECTION_LABEL) as EventRow['event_type'][])
      .map((type) => ({ type, n: teamRows.filter((r) => r.event_type === type).length }))
      .filter((c) => c.n > 0)
      .map(
        (c) =>
          `<tr><td style="padding:6px 0;color:#555;font-size:13px;">${esc(
            SECTION_LABEL[c.type].replace(' to you', '').replace('your leads', 'leads')
          )}</td><td style="padding:6px 0;text-align:right;font-weight:bold;color:#0C5536;">${c.n}</td></tr>`
      )
      .join('');
    teamBlock = `
      <div style="margin-top:28px;padding:16px;background:#F6F8F6;border-left:4px solid #C6A03B;border-radius:4px;">
        <h3 style="color:#0C5536;font-size:15px;margin:0 0 8px;">Team-wide roll-up</h3>
        <p style="color:#777;font-size:12px;margin:0 0 8px;">Across every salesperson, for this period.</p>
        <table style="width:100%;border-collapse:collapse;">${counts}</table>
      </div>`;
  }

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;">
      <div style="background-color:#0C5536;padding:22px 20px;text-align:center;">
        <h1 style="color:#C6A03B;margin:0;font-size:22px;">Just Wills</h1>
        <p style="color:#E6E6E4;margin:6px 0 0;font-size:12px;">${esc(headline)}</p>
      </div>
      <div style="padding:26px 22px;background:#FAFAF8;">
        ${ownSections || '<p style="color:#555;font-size:13px;">Nothing on your own leads this period.</p>'}
        ${teamBlock}
      </div>
      <div style="background-color:#222222;padding:15px;text-align:center;">
        <p style="color:#E6E6E4;margin:0;font-size:12px;">&copy; ${new Date().getFullYear()} Just Wills. All rights reserved.</p>
        <p style="color:#666666;margin:5px 0 0;font-size:11px;">Internal summary — no client has been contacted.</p>
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');
    const resend = new Resend(resendApiKey);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const mode: 'flush' | 'daily' | 'weekly' = body?.mode ?? 'flush';

    const { data: settingRows } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['lead_notifications', 'lead_team']);

    const byKey = new Map<string, Record<string, unknown>>();
    for (const row of settingRows || []) {
      byKey.set(row.setting_key, (row.setting_value ?? {}) as Record<string, unknown>);
    }
    const notifications = (byKey.get('lead_notifications') || {}) as NotificationSettings;
    const team = (byKey.get('lead_team') || {}) as TeamSettings;
    const frequency: Frequency = notifications.notificationFrequency ?? 'immediate';

    const fromEmail = EMAIL_FROM;

    const deliver = async (to: string, subject: string, html: string) => {
      const { error } = await resend.emails.send({
        from: fromEmail,
        to,
        replyTo: EMAIL_REPLY_TO,
        subject,
        html,
      });
      if (error) throw new Error(error.message);
    };

    const emailOf = async (userId: string): Promise<string | null> => {
      const { data } = await supabase.auth.admin.getUserById(userId);
      return data?.user?.email ?? null;
    };

    /* ---------------- flush: held immediate emails ---------------- */

    if (mode === 'flush') {
      if (frequency !== 'immediate') {
        return json({ success: true, mode, skipped: 'frequency is not immediate', sent: 0 });
      }
      if (!isWithinWorkingHours(team)) {
        return json({ success: true, mode, skipped: 'outside working hours', sent: 0 });
      }

      const { data: pending, error } = await supabase
        .from('lead_notification_events')
        .select('id, recipient_id, email_subject, email_html')
        .eq('email_state', 'pending')
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;

      let sent = 0;
      let failed = 0;
      let raced = 0;
      for (const row of pending || []) {
        if (!row.email_subject || !row.email_html) {
          // Nothing to send — retire the row so it cannot loop forever.
          await supabase
            .from('lead_notification_events')
            .update({ email_state: 'suppressed' })
            .eq('id', row.id)
            .eq('email_state', 'pending');
          continue;
        }

        // CLAIM BEFORE SEND. The select above is not a lock, so if a previous
        // 15-minute run is still working when the next one starts, both could
        // otherwise pick up the same row and mail it twice. This UPDATE is a
        // single atomic compare-and-swap: the `email_state = 'pending'`
        // predicate means exactly one worker can flip the row, and only the
        // winner gets a row back to send.
        //
        // Deliberate trade-off: if the process dies between the claim and the
        // send, that one email is lost rather than duplicated. For a
        // notification that is the right way round — the event row still
        // exists, so the in-app bell remains correct.
        const { data: claimed, error: claimError } = await supabase
          .from('lead_notification_events')
          .update({ email_state: 'sent', email_sent_at: new Date().toISOString() })
          .eq('id', row.id)
          .eq('email_state', 'pending')
          .select('id');

        if (claimError) {
          console.error(`Failed to claim notification ${row.id}:`, claimError);
          failed++;
          continue;
        }
        if (!claimed || claimed.length === 0) {
          // Another overlapping run already owns this row.
          raced++;
          continue;
        }

        try {
          const to = await emailOf(row.recipient_id);
          if (!to) throw new Error('recipient has no email address');
          await deliver(to, row.email_subject, row.email_html);
          sent++;
        } catch (err) {
          // Hand the row back so the next run retries it.
          console.error(`Failed to flush notification ${row.id}:`, err);
          await supabase
            .from('lead_notification_events')
            .update({ email_state: 'pending', email_sent_at: null })
            .eq('id', row.id);
          failed++;
        }
      }

      return json({ success: true, mode, sent, failed, raced });
    }

    /* ---------------- daily / weekly digests ---------------- */

    if (frequency !== mode) {
      return json({ success: true, mode, skipped: `frequency is ${frequency}`, sent: 0 });
    }

    const { data: rows, error: rowsError } = await supabase
      .from('lead_notification_events')
      .select('id')
      .eq('email_state', 'digest')
      .order('created_at', { ascending: true })
      .limit(2000);
    if (rowsError) throw rowsError;

    const candidateIds = (rows || []).map((r) => String(r.id));
    if (candidateIds.length === 0) {
      return json({ success: true, mode, message: 'nothing to digest', sent: 0 });
    }

    // CLAIM BEFORE BUILD. Same reasoning as the flush path: the select is not
    // a lock. This UPDATE ... RETURNING atomically flips only the rows still
    // in 'digest' and hands back exactly the ones this run owns, so two
    // overlapping digest runs partition the batch instead of both mailing it.
    //
    // (The daily and weekly schedules can never collide with each other in the
    // first place — the frequency guard above means only one of them does any
    // work at all. This guards a run against a slow instance of itself.)
    const claimedAt = new Date().toISOString();
    const { data: claimedRows, error: claimError } = await supabase
      .from('lead_notification_events')
      .update({ email_state: 'sent', email_sent_at: claimedAt })
      .in('id', candidateIds)
      .eq('email_state', 'digest')
      .select('id, recipient_id, lead_id, event_type, title, body, email_subject, email_html, created_at');
    if (claimError) throw claimError;

    const events = (claimedRows || []) as EventRow[];
    if (events.length === 0) {
      return json({ success: true, mode, message: 'batch already claimed by a concurrent run', sent: 0 });
    }

    // Managers see a team-wide roll-up on top of their own leads.
    const { data: managerRoles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['lead_management', 'admin']);
    const managerIds = new Set<string>(
      (managerRoles || []).map((r) => String(r.user_id))
    );

    const byRecipient = new Map<string, EventRow[]>();
    for (const e of events) {
      const list = byRecipient.get(e.recipient_id) || [];
      list.push(e);
      byRecipient.set(e.recipient_id, list);
    }
    // Deliberately NOT back-filling managers who have no events of their own.
    //
    // This used to add every lead_management/admin holder as a recipient so
    // they'd receive the team-wide roll-up. The result was that a single
    // status change mailed 13 people, and 12 of those emails opened with
    // "Nothing on your own leads" — the digest existed only to carry the
    // roll-up. A digest telling someone nothing happened to them is worse
    // than no digest.
    //
    // Managers who own leads still get the roll-up appended to their own
    // digest below. A manager who owns nothing reads the dashboard instead.

    const headline = mode === 'daily' ? 'Daily lead digest' : 'Weekly lead digest';
    let sent = 0;
    let failed = 0;

    for (const [recipientId, ownRows] of byRecipient) {
      try {
        const to = await emailOf(recipientId);
        if (!to) throw new Error('recipient has no email address');
        const isManager = managerIds.has(recipientId);
        const html = buildDigestHtml({
          headline,
          ownRows,
          teamRows: isManager ? events : null,
        });
        const count = isManager ? events.length : ownRows.length;
        if (count === 0) continue;
        await deliver(to, `${headline} — ${count} update${count === 1 ? '' : 's'}`, html);
        sent++;
      } catch (err) {
        console.error(`Failed to send digest to ${recipientId}:`, err);
        failed++;
      }
    }

    // The batch was already retired by the claim above, which is also what
    // stops one bad address replaying the same events into every future
    // digest.

    return json({ success: true, mode, recipients: byRecipient.size, sent, failed, events: events.length });
  } catch (error) {
    console.error('send-lead-notification-digest failed:', error);
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
