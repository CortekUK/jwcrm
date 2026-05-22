// POST /api/integrations/outlook/disconnect
// Removes the caller's Outlook connection.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: userInfo, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userInfo?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { error: delErr } = await supabaseAdmin
    .from("user_outlook_connections")
    .delete()
    .eq("user_id", userInfo.user.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
