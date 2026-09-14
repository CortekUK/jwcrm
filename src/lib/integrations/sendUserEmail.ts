// sendUserEmail — sends an email "as" a specific user.
//
// If that user has connected their Outlook (user_outlook_connections row
// present and refreshable), the message goes out through Microsoft Graph
// /me/sendMail using their tokens — the recipient sees the message coming
// from the user's own mailbox, and replies land in their normal inbox.
//
// Otherwise the helper falls back to Resend so existing behavior keeps
// working today. The recipient sees the message from EMAIL_FROM, with replies
// directed to EMAIL_REPLY_TO.
//
// Callers should never crash on email errors — both branches catch and
// return { ok: false, ... } so the surrounding write (create proposal,
// log invoice, etc.) is not rolled back.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { refreshTokens, getOutlookEnv } from "./outlook";
import { EMAIL_FROM, EMAIL_REPLY_TO } from "@/config/email";

export type SendUserEmailInput = {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string /* base64 */ }[];
  /** When set, used as the message id header / Resend X-Entity-Ref-ID. */
  refId?: string;
  /**
   * Optional context recorded in email_send_log, so a later "it never arrived"
   * can be answered from the lead's own history instead of a provider
   * dashboard. Purely for the audit trail — it never affects delivery.
   */
  log?: {
    kind?: string;
    leadId?: string | null;
    proposalId?: string | null;
  };
};

export type SendAttempt = {
  provider: "outlook" | "resend" | "none";
  ok: boolean;
  /** The mailbox the message went out as — the usual answer to "where did it go". */
  sentAs?: string | null;
  error?: string;
};

export type SendUserEmailResult = {
  ok: boolean;
  provider: "outlook" | "resend" | "none";
  messageId?: string;
  error?: string;
  /** Which mailbox actually sent it. */
  sentAs?: string | null;
  /** Every provider tried, in order, including the ones that failed. */
  attempts?: SendAttempt[];
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const REFRESH_LEEWAY_MS = 60 * 1000; // refresh if expiring within a minute

/**
 * Record the outcome. Deliberately best-effort: a logging failure must never
 * turn a delivered email into a failed request.
 */
async function recordSend(
  actorUserId: string | null,
  input: SendUserEmailInput,
  result: SendUserEmailResult,
  attempts: SendAttempt[]
): Promise<void> {
  try {
    await supabaseAdmin.from("email_send_log").insert({
      kind: input.log?.kind ?? null,
      subject: input.subject,
      recipient: input.to,
      actor_user_id: actorUserId,
      lead_id: input.log?.leadId ?? null,
      proposal_id: input.log?.proposalId ?? null,
      ok: result.ok,
      provider: result.provider,
      sent_as: result.sentAs ?? null,
      message_id: result.messageId ?? null,
      error: result.error ?? null,
      has_attachments: (input.attachments?.length ?? 0) > 0,
      attempts,
    });
  } catch (err) {
    console.error("Could not write email_send_log:", err);
  }
}

type OutlookRow = {
  user_id: string;
  outlook_email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

async function loadOutlookRow(userId: string, sb: SupabaseClient): Promise<OutlookRow | null> {
  const { data, error } = await sb
    .from("user_outlook_connections")
    .select("user_id, outlook_email, access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("loadOutlookRow failed:", error);
    return null;
  }
  return (data as OutlookRow) || null;
}

async function ensureFreshAccessToken(row: OutlookRow): Promise<string | null> {
  const expiresMs = new Date(row.expires_at).getTime();
  if (Number.isFinite(expiresMs) && expiresMs - Date.now() > REFRESH_LEEWAY_MS) {
    return row.access_token;
  }
  try {
    const fresh = await refreshTokens(row.refresh_token);
    const newExpiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("user_outlook_connections")
      .update({
        access_token: fresh.access_token,
        refresh_token: fresh.refresh_token || row.refresh_token,
        expires_at: newExpiresAt,
        scope: fresh.scope,
      })
      .eq("user_id", row.user_id);
    return fresh.access_token;
  } catch (err) {
    console.error("Outlook token refresh failed for", row.user_id, err);
    return null;
  }
}

async function sendViaOutlook(
  accessToken: string,
  input: SendUserEmailInput,
  sentAs: string | null
): Promise<SendUserEmailResult> {
  const message = {
    message: {
      subject: input.subject,
      body: { contentType: "HTML", content: input.html },
      toRecipients: [{ emailAddress: { address: input.to } }],
      attachments: (input.attachments || []).map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.filename,
        contentBytes: a.content,
      })),
    },
    saveToSentItems: true,
  };
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, provider: "outlook", error: `Graph ${res.status}: ${body}`, sentAs };
  }
  return { ok: true, provider: "outlook", sentAs };
}

async function sendViaResend(input: SendUserEmailInput): Promise<SendUserEmailResult> {
  if (!resend) {
    return { ok: false, provider: "none", error: "RESEND_API_KEY not configured" };
  }
  if (!input.to || !input.to.trim()) {
    return { ok: false, provider: "resend", error: "No recipient address" };
  }
  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: input.to,
      replyTo: EMAIL_REPLY_TO,
      subject: input.subject,
      html: input.html,
      headers: input.refId ? { "X-Entity-Ref-ID": input.refId } : undefined,
      attachments: input.attachments,
    });
    if (result.error) {
      return { ok: false, provider: "resend", error: result.error.message };
    }
    return { ok: true, provider: "resend", messageId: result.data?.id };
  } catch (err) {
    return {
      ok: false,
      provider: "resend",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/**
 * Send an email as the given user. Tries Outlook first when configured and
 * connected; falls back to Resend; returns a structured result.
 */
export async function sendUserEmail(
  actorUserId: string | null,
  input: SendUserEmailInput
): Promise<SendUserEmailResult> {
  const attempts: SendAttempt[] = [];

  const env = getOutlookEnv();
  if (env.configured && actorUserId) {
    const row = await loadOutlookRow(actorUserId, supabaseAdmin);
    if (row) {
      const token = await ensureFreshAccessToken(row);
      if (token) {
        const outlookResult = await sendViaOutlook(token, input, row.outlook_email);
        attempts.push({
          provider: "outlook",
          ok: outlookResult.ok,
          sentAs: row.outlook_email,
          error: outlookResult.error,
        });
        if (outlookResult.ok) {
          const result = { ...outlookResult, attempts };
          await recordSend(actorUserId, input, result, attempts);
          return result;
        }
        console.error("Outlook send failed, falling back to Resend:", outlookResult.error);
      } else {
        attempts.push({
          provider: "outlook",
          ok: false,
          sentAs: row.outlook_email,
          error: "Could not refresh the Outlook access token",
        });
      }
    }
  }

  const resendResult = await sendViaResend(input);
  attempts.push({
    provider: resendResult.provider,
    ok: resendResult.ok,
    sentAs: resendResult.ok ? EMAIL_FROM : null,
    error: resendResult.error,
  });

  const result: SendUserEmailResult = {
    ...resendResult,
    sentAs: resendResult.ok ? EMAIL_FROM : null,
    attempts,
  };
  await recordSend(actorUserId, input, result, attempts);
  return result;
}
