import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Employee leave self-service. The caller submits and views leave for THEIR OWN
// employee record (resolved from their auth user), so no one can act for others.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resolveEmployee(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!accessToken) return { error: "Unauthorized", status: 401 as const };

  const { data: userInfo } = await supabaseAdmin.auth.getUser(accessToken);
  const userId = userInfo?.user?.id;
  const userEmail = userInfo?.user?.email;
  if (!userId) return { error: "Unauthorized", status: 401 as const };

  // Primary: employee linked by user_id.
  let { data: employee } = await supabaseAdmin
    .from("employees")
    .select("id, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  // Fallback: match by email (accounts created after the one-time backfill may
  // not have a user_id yet). Self-heal the link so it's fast next time.
  if (!employee && userEmail) {
    const { data: byEmail } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, user_id")
      .ilike("email", userEmail)
      .maybeSingle();
    if (byEmail) {
      employee = { id: byEmail.id, full_name: byEmail.full_name };
      if (!byEmail.user_id) {
        await supabaseAdmin
          .from("employees")
          .update({ user_id: userId })
          .eq("id", byEmail.id);
      }
    }
  }

  if (!employee) {
    return { error: "No employee record is linked to your account.", status: 403 as const };
  }
  return { employee, userId };
}

export async function GET(request: NextRequest) {
  try {
    const res = await resolveEmployee(request);

    // Always load active leave types so the form is populated/usable even for
    // accounts that aren't linked to an employee record yet.
    const { data: types } = await supabaseAdmin
      .from("leave_types")
      .select("slug, name")
      .eq("is_active", true)
      .order("sort_order");

    if ("error" in res) {
      if (res.status === 401) {
        return NextResponse.json({ error: res.error }, { status: 401 });
      }
      // No employee linked: return types + a clear flag so the page can show a
      // helpful message instead of an empty, broken form.
      return NextResponse.json({
        employeeLinked: false,
        error: res.error,
        leaveTypes: types || [],
        requests: [],
      });
    }

    const { employee } = res;

    const { data: requests } = await supabaseAdmin
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, total_days, reason, status, denial_reason, created_at")
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      employeeLinked: true,
      employee,
      requests: requests || [],
      leaveTypes: types || [],
    });
  } catch (err) {
    console.error("Leave self GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const res = await resolveEmployee(request);
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    const { employee } = res;

    const body = await request.json().catch(() => ({}));
    const leave_type = (body.leave_type || "").toString();
    const start_date = (body.start_date || "").toString();
    const end_date = (body.end_date || "").toString();
    const reason = (body.reason || "").toString().trim();

    if (!leave_type || !start_date || !end_date) {
      return NextResponse.json(
        { error: "Leave type, start date and end date are required." },
        { status: 400 }
      );
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: "Please choose a valid date range." }, { status: 400 });
    }

    // Inclusive day count
    const total_days =
      Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

    const { data: inserted, error } = await supabaseAdmin
      .from("leave_requests")
      .insert({
        employee_id: employee.id,
        leave_type,
        start_date,
        end_date,
        total_days,
        reason: reason || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Leave self POST error:", error);
      return NextResponse.json({ error: "Could not submit your request." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    console.error("Leave self POST exception:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
