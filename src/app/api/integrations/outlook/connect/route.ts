// POST /api/integrations/outlook/connect
// Returns the Microsoft authorize URL the client should redirect the user
// to. The OAuth state token includes the user's Supabase id so the
// callback knows which user the returned authorization code belongs to.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHmac } from "node:crypto";
import { buildAuthorizeUrl, getOutlookEnv } from "@/lib/integrations/outlook";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function stateSecret(): string {
  return process.env.OUTLOOK_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev";
}

export function signState(payload: object): string {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(json).digest("base64url");
  return `${json}.${sig}`;
}

export async function POST(request: NextRequest) {
  const env = getOutlookEnv();
  if (!env.configured) {
    return NextResponse.json(
      { error: "Outlook integration is not configured yet. The Azure AD app credentials (MS_CLIENT_ID, MS_CLIENT_SECRET) must be set first." },
      { status: 501 }
    );
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: userInfo, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userInfo?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = signState({
    uid: userInfo.user.id,
    nonce: randomBytes(8).toString("hex"),
    ts: Date.now(),
  });
  const url = buildAuthorizeUrl(state);
  if (!url) {
    return NextResponse.json({ error: "Outlook integration not configured" }, { status: 501 });
  }
  return NextResponse.json({ authorizeUrl: url });
}
