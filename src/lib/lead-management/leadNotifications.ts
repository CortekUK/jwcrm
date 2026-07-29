/**
 * One entry point for every lead-management notification.
 *
 * Each event is recorded in `lead_notification_events` FIRST, then the row's
 * `email_state` decides what happens to the email:
 *
 *   suppressed — the event's switch is OFF in the Notifications tab.
 *   sent       — frequency is "immediate" and we are inside working hours;
 *                the mail went out during this request.
 *   pending    — frequency is "immediate" but we are OUTSIDE working hours.
 *                The `flush` run of send-lead-notification-digest picks it up
 *                at the next working-hours start. The rendered subject/html
 *                are stored on the row so the cron needs no app code.
 *   digest     — frequency is "daily"/"weekly"; the row is raw material for
 *                the digest cron and is never mailed individually.
 *
 * The row is written regardless of email state because the in-app bell and
 * the digests both read from it — turning email off must not blind the UI.
 *
 * SERVER ONLY.
 */

import { sendUserEmail } from "@/lib/integrations/sendUserEmail";
import {
  getLeadNotificationSettings,
  getLeadTeamSettings,
  isWithinWorkingHours,
  leadSettingsAdmin as supabaseAdmin,
} from "./settingsServer";
import { EVENT_SWITCH, type LeadNotificationEventType } from "./settingsTypes";

export type NotifyLeadEventParams = {
  eventType: LeadNotificationEventType;
  /** auth.users id of the person being notified. */
  recipientId: string;
  leadId?: string | null;
  /** Short line shown in the in-app bell. */
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
  /** Rendered email. Omit to record an in-app-only event. */
  email?: { subject: string; html: string } | null;
  /** Whose Outlook the mail should route through, when connected. */
  actorUserId?: string | null;
};

export type NotifyResult = {
  recorded: boolean;
  emailState: "sent" | "pending" | "digest" | "suppressed" | "none";
  error?: string;
};

export async function notifyLeadEvent(
  params: NotifyLeadEventParams
): Promise<NotifyResult> {
  const {
    eventType,
    recipientId,
    leadId = null,
    title,
    body = null,
    metadata = {},
    email = null,
    actorUserId = null,
  } = params;

  if (!recipientId) return { recorded: false, emailState: "none", error: "no recipient" };

  try {
    const [notifications, team] = await Promise.all([
      getLeadNotificationSettings(),
      getLeadTeamSettings(),
    ]);

    const switchKey = EVENT_SWITCH[eventType];
    const switchOn = switchKey ? Boolean(notifications[switchKey]) : true;

    let emailState: NotifyResult["emailState"];
    if (!email) {
      emailState = "none";
    } else if (!switchOn) {
      emailState = "suppressed";
    } else if (notifications.notificationFrequency !== "immediate") {
      emailState = "digest";
    } else if (isWithinWorkingHours(team)) {
      emailState = "sent"; // provisional — downgraded below if the send fails
    } else {
      emailState = "pending";
    }

    // Send before insert so a failed send is stored as "pending" and the
    // flush cron retries it, rather than being recorded as delivered.
    let sendError: string | undefined;
    if (emailState === "sent" && email) {
      const recipientEmail = await resolveUserEmail(recipientId);
      if (!recipientEmail) {
        emailState = "pending";
        sendError = "recipient has no email address";
      } else {
        const result = await sendUserEmail(actorUserId, {
          to: recipientEmail,
          subject: email.subject,
          html: email.html,
          refId: leadId || undefined,
        });
        if (!result.ok) {
          emailState = "pending";
          sendError = result.error;
        }
      }
    }

    const { error } = await supabaseAdmin.from("lead_notification_events").insert({
      recipient_id: recipientId,
      lead_id: leadId,
      event_type: eventType,
      title,
      body,
      metadata,
      email_state: emailState,
      email_subject: email?.subject ?? null,
      email_html: email?.html ?? null,
      email_sent_at: emailState === "sent" ? new Date().toISOString() : null,
    });

    if (error) {
      console.error("Failed to record lead notification event:", error.message);
      return { recorded: false, emailState, error: error.message };
    }

    return { recorded: true, emailState, error: sendError };
  } catch (err) {
    // A notification must never roll back the write that triggered it.
    const message = err instanceof Error ? err.message : "unknown";
    console.error("notifyLeadEvent failed:", message);
    return { recorded: false, emailState: "none", error: message };
  }
}

export async function resolveUserEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function resolveUserName(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.full_name ?? null;
}

/** Every user holding the `lead_management` role — the "managers". */
export async function getLeadManagerIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "lead_management");
  if (error) {
    console.error("Failed to load lead_management users:", error.message);
    return [];
  }
  return [...new Set((data || []).map((r: { user_id: string }) => r.user_id))];
}
