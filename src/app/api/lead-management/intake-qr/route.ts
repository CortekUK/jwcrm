import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { REFERRAL_ASSIGNABLE_ROLES } from "@/lib/lead-management/leadAssignment";

/**
 * Backs the per-person intake QR page.
 *
 * Every internal user needs to know their OWN id to build `/intake?ref=<id>`,
 * and managers additionally need the roster so they can print a code for each
 * member of the sales team before an event. Both come from here rather than
 * from the browser's Supabase session, because the roster is a privileged read
 * (it exposes who works here) and RLS is disabled project-wide — the gate has
 * to live in this route.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Roles allowed to generate somebody else's code, not just their own. */
const MANAGER_ROLES = ["admin", "superadmin", "lead_management"];

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = (callerRoles || []).map((r: { role: string }) => r.role);
    const canPickOthers = roles.some((r) => MANAGER_ROLES.includes(r));

    // A manager who is not themselves a salesperson still gets a personal code
    // — a lead scanned off their badge should land on them, not in the pool.
    const { data: selfProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const self = {
      user_id: user.id,
      full_name: selfProfile?.full_name ?? user.email ?? null,
      // Only a ref the public endpoint will actually honour is worth encoding.
      assignable: roles.some((r) => (REFERRAL_ASSIGNABLE_ROLES as readonly string[]).includes(r)),
    };

    if (!canPickOthers) {
      return NextResponse.json({ data: { self, canPickOthers, salespeople: [] } });
    }

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", REFERRAL_ASSIGNABLE_ROLES as unknown as string[]);

    const ids = Array.from(new Set((roleRows || []).map((r: { user_id: string }) => r.user_id)));

    const { data: profiles } = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids)
      : { data: [] };

    const salespeople = (profiles || []).sort((a, b) =>
      (a.full_name || "").localeCompare(b.full_name || "")
    );

    return NextResponse.json({ data: { self, canPickOthers, salespeople } });
  } catch (error) {
    console.error("Error loading intake QR roster:", error);
    return NextResponse.json({ error: "Failed to load salespeople" }, { status: 500 });
  }
}
