// sendUserEmail — sends an email "as" a specific user.
//
// If that user has connected their Outlook (user_outlook_connections row
// present and refreshable), the message goes out through Microsoft Graph
// /me/sendMail using their tokens — the recipient sees the message coming
// from the user's own mailbox, and replies land in their normal inbox.
//
// Otherwise the helper falls back to Resend so existing behavior keeps
// working today. The recipient sees the message from FROM_EMAIL.
//
// Callers should never crash on email errors — both branches catch and
// return { ok: false, ... } so the surrounding write (create proposal,
// log invoice, etc.) is not rolled back.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { refreshTokens, getOutlookEnv } from "./outlook";

export type SendUserEmailInput = {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string /* base64 */ }[];
  /** When set, used as the message id header / Resend X-Entity-Ref-ID. */
  refId?: string;
};

export type SendUserEmailResult = {
  ok: boolean;
  provider: "outlook" | "resend" | "none";
  messageId?: string;
  error?: string;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const REFRESH_LEEWAY_MS = 60 * 1000; // refresh if expiring within a minute

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
  input: SendUserEmailInput
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
    return { ok: false, provider: "outlook", error: `Graph ${res.status}: ${body}` };
  }
  return { ok: true, provider: "outlook" };
}

async function sendViaResend(input: SendUserEmailInput): Promise<SendUserEmailResult> {
  if (!resend) {
    return { ok: false, provider: "none", error: "RESEND_API_KEY not configured" };
  }
  const adminEmail = process.env.ADMIN_EMAIL || "aw736024@gmail.com";
  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
  const isTestMode = !process.env.PRODUCTION_EMAIL_MODE;
  const recipient = isTestMode ? adminEmail : input.to;
  const subject = isTestMode ? `[Original: ${input.to}] ${input.subject}` : input.subject;
  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: recipient,
      subject,
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
  const env = getOutlookEnv();
  if (env.configured && actorUserId) {
    const row = await loadOutlookRow(actorUserId, supabaseAdmin);
    if (row) {
      const token = await ensureFreshAccessToken(row);
      if (token) {
        const outlookResult = await sendViaOutlook(token, input);
        if (outlookResult.ok) return outlookResult;
        console.error("Outlook send failed, falling back to Resend:", outlookResult.error);
      }
    }
  }
  return sendViaResend(input);
}
