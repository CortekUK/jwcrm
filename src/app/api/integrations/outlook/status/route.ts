// GET /api/integrations/outlook/status
// Returns whether the integration is configured globally and whether the
// calling user has connected their Outlook.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOutlookEnv } from "@/lib/integrations/outlook";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const env = getOutlookEnv();

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ configured: env.configured, connected: false }, { status: 200 });
  }

  const { data: userInfo, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userInfo?.user) {
    return NextResponse.json({ configured: env.configured, connected: false }, { status: 200 });
  }

  const { data: row } = await supabaseAdmin
    .from("user_outlook_connections")
    .select("outlook_email, connected_at, expires_at")
    .eq("user_id", userInfo.user.id)
    .maybeSingle();

  return NextResponse.json({
    configured: env.configured,
    connected: !!row,
    outlookEmail: row?.outlook_email ?? null,
    connectedAt: row?.connected_at ?? null,
    expiresAt: row?.expires_at ?? null,
  });
}
