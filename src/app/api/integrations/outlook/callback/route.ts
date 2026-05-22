// GET /api/integrations/outlook/callback?code=...&state=...
// Microsoft redirects here after the user grants consent. We verify the
// signed state, exchange the code for tokens, look up the user's mailbox
// via Graph /me, and upsert the connection row.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import {
  exchangeCodeForTokens,
  fetchMyMailbox,
  getOutlookEnv,
} from "@/lib/integrations/outlook";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function stateSecret(): string {
  return process.env.OUTLOOK_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev";
}

function verifyState(state: string): { uid: string } | null {
  const [json, sig] = state.split(".");
  if (!json || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(json).digest("base64url");
  if (expected !== sig) return null;
  try {
    const decoded = JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
    if (!decoded?.uid) return null;
    // 10-minute window
    if (typeof decoded.ts === "number" && Date.now() - decoded.ts > 10 * 60 * 1000) {
      return null;
    }
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

function settingsUrl(message: string, status: "success" | "error" = "error"): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const u = new URL(`${base.replace(/\/$/, "")}/admin/salesperson/settings`);
  u.searchParams.set("outlook", status);
  u.searchParams.set("msg", message);
  return u.toString();
}

export async function GET(request: NextRequest) {
  const env = getOutlookEnv();
  if (!env.configured) {
    return NextResponse.redirect(settingsUrl("not_configured"));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(settingsUrl(oauthError));
  }
  if (!code || !state) {
    return NextResponse.redirect(settingsUrl("missing_code_or_state"));
  }
  const verified = verifyState(state);
  if (!verified) {
    return NextResponse.redirect(settingsUrl("invalid_state"));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const mailbox = await fetchMyMailbox(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: upsertErr } = await supabaseAdmin
      .from("user_outlook_connections")
      .upsert(
        {
          user_id: verified.uid,
          outlook_email: mailbox.email,
          ms_user_id: mailbox.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          scope: tokens.scope,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (upsertErr) {
      console.error("Outlook upsert failed:", upsertErr);
      return NextResponse.redirect(settingsUrl(upsertErr.message));
    }
    return NextResponse.redirect(settingsUrl("connected", "success"));
  } catch (err) {
    console.error("Outlook callback failed:", err);
    const msg = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.redirect(settingsUrl(msg));
  }
}
