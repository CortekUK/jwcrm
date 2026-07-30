import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  uploadLeaveAttachment,
  validateLeaveAttachment,
} from "@/lib/hr/leaveAttachments";

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

/**
 * Resolve and persist the multi-step approval chain for a freshly created
 * request.
 *
 * `leave_requests.approval_rule_id` / `total_approval_steps` used to have no
 * writers at all, which pinned every request to a single step. This uses the
 * existing SQL function `get_applicable_approval_rule` (leave-type-specific
 * rules ahead of generic ones, then priority ASC) rather than re-implementing
 * the matching here.
 *
 * Best-effort: a request that cannot be planned falls back to the single-step
 * behaviour every pre-existing request already has, so submission never fails
 * because of this. Migration 20260731000006 adds a BEFORE INSERT trigger that
 * does the same thing at the database level; once applied, this is redundant
 * but harmless (it writes identical values).
 */
async function initializeApprovalPlan(
  requestId: string,
  leaveType: string,
  totalDays: number
) {
  try {
    const { data: ruleId, error: ruleError } = await supabaseAdmin.rpc(
      "get_applicable_approval_rule" as never,
      { p_leave_type: leaveType, p_total_days: totalDays } as never
    );

    if (ruleError || !ruleId) return;

    const { data: rule } = await supabaseAdmin
      .from("leave_approval_rules" as never)
      .select(
        "requires_manager_approval, requires_hr_approval, requires_director_approval"
      )
      .eq("id", ruleId as unknown as string)
      .maybeSingle();

    if (!rule) return;

    const r = rule as unknown as {
      requires_manager_approval: boolean | null;
      requires_hr_approval: boolean | null;
      requires_director_approval: boolean | null;
    };

    const steps =
      (r.requires_manager_approval ? 1 : 0) +
      (r.requires_hr_approval ? 1 : 0) +
      (r.requires_director_approval ? 1 : 0);

    await supabaseAdmin
      .from("leave_requests")
      .update({
        approval_rule_id: ruleId as unknown as string,
        // A rule with every switch off still needs one human sign-off.
        total_approval_steps: Math.max(1, steps),
        current_approval_step: 1,
      } as never)
      .eq("id", requestId);
  } catch (err) {
    console.error("Failed to resolve leave approval chain:", err);
  }
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

    // Two shapes are accepted:
    //  - application/json (unchanged, and still what the form sends when no
    //    certificate is attached — that path behaves exactly as before);
    //  - multipart/form-data, used only when the employee attaches a
    //    certificate. The file is uploaded here with the service-role client,
    //    so the browser never needs storage access and the storage path is
    //    derived server-side from the employee resolved out of the caller's own
    //    token — the client cannot name its own path.
    const isMultipart = (request.headers.get("content-type") || "").includes(
      "multipart/form-data"
    );

    let leave_type = "";
    let start_date = "";
    let end_date = "";
    let reason = "";
    let certificate: File | null = null;

    if (isMultipart) {
      const form = await request.formData().catch(() => null);
      if (!form) {
        return NextResponse.json({ error: "Could not read your request." }, { status: 400 });
      }
      leave_type = (form.get("leave_type") || "").toString();
      start_date = (form.get("start_date") || "").toString();
      end_date = (form.get("end_date") || "").toString();
      reason = (form.get("reason") || "").toString().trim();
      const file = form.get("certificate");
      if (file instanceof File && file.size > 0) certificate = file;
    } else {
      const body = await request.json().catch(() => ({}));
      leave_type = (body.leave_type || "").toString();
      start_date = (body.start_date || "").toString();
      end_date = (body.end_date || "").toString();
      reason = (body.reason || "").toString().trim();
    }

    if (certificate) {
      const problem = validateLeaveAttachment(certificate);
      if (problem) {
        return NextResponse.json({ error: problem }, { status: 400 });
      }
    }

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

    // Upload before insert: if storage fails we refuse the submission outright
    // rather than creating a request whose certificate silently vanished.
    let attachment_path: string | null = null;
    if (certificate) {
      try {
        attachment_path = await uploadLeaveAttachment(
          supabaseAdmin,
          employee.id,
          certificate
        );
      } catch (uploadErr) {
        return NextResponse.json(
          {
            error:
              uploadErr instanceof Error
                ? uploadErr.message
                : "Could not upload the certificate.",
          },
          { status: 400 }
        );
      }
    }

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
        ...(attachment_path ? { attachment_path } : {}),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Leave self POST error:", error);
      return NextResponse.json({ error: "Could not submit your request." }, { status: 500 });
    }

    await initializeApprovalPlan(inserted.id, leave_type, total_days);

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    console.error("Leave self POST exception:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
