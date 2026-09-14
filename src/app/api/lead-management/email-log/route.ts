// GET /api/lead-management/email-log
//
// Reads the outbound email audit trail so "the client says it never arrived"
// can be answered in seconds: which provider carried it, which mailbox it was
// sent AS, and the provider's own error if it failed.
//
// Query params:
//   ?leadId=<uuid>   only this lead's emails
//   ?failedOnly=1    only sends that did not succeed
//   ?kind=invoice    invoice | proposal | payment_request
//   ?limit=50        default 50, max 200

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Roles allowed to inspect the mail log — it exposes client addresses. */
const ALLOWED_ROLES = new Set([
  "admin",
  "superadmin",
  "finance",
  "lead_management",
  "account_manager",
]);

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: userInfo, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userInfo?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userInfo.user.id);
    const allowed = (roles || []).some((r: { role: string }) => ALLOWED_ROLES.has(r.role));
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const limit = Math.min(Number(params.get("limit")) || 50, 200);

    let query = supabaseAdmin
      .from("email_send_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    const leadId = params.get("leadId");
    if (leadId) query = query.eq("lead_id", leadId);
    const kind = params.get("kind");
    if (kind) query = query.eq("kind", kind);
    if (params.get("failedOnly") === "1") query = query.eq("ok", false);

    const { data, error } = await query;
    if (error) {
      console.error("Error reading email log:", error);
      return NextResponse.json({ error: "Could not read the email log" }, { status: 500 });
    }

    return NextResponse.json({
      count: data?.length ?? 0,
      emails: (data || []).map((row) => ({
        at: row.created_at,
        kind: row.kind,
        subject: row.subject,
        to: row.recipient,
        delivered: row.ok,
        provider: row.provider,
        sentAs: row.sent_as,
        error: row.error,
        attempts: row.attempts,
      })),
    });
  } catch (error) {
    console.error("Error in email-log:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
