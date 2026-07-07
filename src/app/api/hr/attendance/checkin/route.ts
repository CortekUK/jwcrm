import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Login-driven attendance: called right after a staff member signs in. If their
// auth user is linked to an employee record, marks them present for today.
// Idempotent — a second login the same day does not overwrite an existing mark.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    if (!accessToken) {
      return NextResponse.json({ ok: false, reason: "no_token" }, { status: 200 });
    }

    const { data: userInfo } = await supabaseAdmin.auth.getUser(accessToken);
    const userId = userInfo?.user?.id;
    const userEmail = userInfo?.user?.email;
    if (!userId) {
      return NextResponse.json({ ok: false, reason: "no_user" }, { status: 200 });
    }

    // Is this user an employee? Primary: linked by user_id.
    let { data: employee } = await supabaseAdmin
      .from("employees")
      .select("id, start_date, employment_status")
      .eq("user_id", userId)
      .maybeSingle();

    // Fallback: match by email (accounts created after the one-time backfill
    // may not have a user_id yet). Self-heal the link for next time.
    if (!employee && userEmail) {
      const { data: byEmail } = await supabaseAdmin
        .from("employees")
        .select("id, start_date, employment_status, user_id")
        .ilike("email", userEmail)
        .maybeSingle();
      if (byEmail) {
        employee = {
          id: byEmail.id,
          start_date: byEmail.start_date,
          employment_status: byEmail.employment_status,
        };
        if (!byEmail.user_id) {
          await supabaseAdmin
            .from("employees")
            .update({ user_id: userId })
            .eq("id", byEmail.id);
        }
      }
    }

    if (!employee) {
      // Not everyone who logs in is a tracked employee — that's fine.
      return NextResponse.json({ ok: true, marked: false, reason: "not_employee" });
    }

    // Today's date in the app timezone (server local). Use YYYY-MM-DD.
    const today = new Date().toISOString().slice(0, 10);

    // Already marked today? Don't override (HR may have set a specific status).
    const { data: existing } = await supabaseAdmin
      .from("attendance")
      .select("id, status")
      .eq("employee_id", employee.id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, marked: false, reason: "already_marked" });
    }

    const checkInTime = new Date().toTimeString().slice(0, 8); // HH:MM:SS

    const { error: insertError } = await supabaseAdmin.from("attendance").insert({
      employee_id: employee.id,
      date: today,
      status: "present",
      check_in_time: checkInTime,
      marked_by: userId, // self, via login
    });

    if (insertError) {
      console.error("Attendance check-in error:", insertError);
      return NextResponse.json({ ok: false, reason: "insert_failed" }, { status: 200 });
    }

    return NextResponse.json({ ok: true, marked: true });
  } catch (err) {
    console.error("Attendance check-in exception:", err);
    // Never block login on attendance failure.
    return NextResponse.json({ ok: false, reason: "exception" }, { status: 200 });
  }
}
