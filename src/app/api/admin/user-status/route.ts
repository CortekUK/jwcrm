import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Returns the real activation state for every user.
 *
 * The deactivation flag lives in auth.users.user_metadata.is_active (it is what
 * SignInForm checks before letting anyone in) — there is no status column on
 * `profiles`, so a plain `profiles` query can never see it. The admin dashboard
 * used to hardcode an "Active" badge for everyone because of that.
 *
 * The existing admin-get-users edge function exposes the same flag but is
 * restricted to superadmins, and the dashboard is an admin-level page, so this
 * route re-exposes just the flag to admins and superadmins.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = (roles || []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "superadmin"
    );

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // listUsers is paginated; walk every page so nobody is silently reported
    // as active just because they fell off page one.
    const statuses: Record<string, boolean> = {};
    const perPage = 1000;
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) throw error;

      const users = data?.users || [];
      for (const authUser of users) {
        // Absent metadata means "never deactivated".
        statuses[authUser.id] =
          (authUser.user_metadata as { is_active?: boolean } | null)
            ?.is_active !== false;
      }

      if (users.length < perPage) break;
    }

    return NextResponse.json({ data: statuses });
  } catch (error) {
    console.error("Error fetching user activation states:", error);
    return NextResponse.json(
      { error: "Failed to fetch user activation states" },
      { status: 500 }
    );
  }
}
