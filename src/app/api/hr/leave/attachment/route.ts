import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  signLeaveAttachment,
  uploadLeaveAttachment,
  validateLeaveAttachment,
} from "@/lib/hr/leaveAttachments";

/**
 * Leave certificate attachments for an EXISTING leave request.
 *
 *  GET  ?request_id=...  -> short-lived signed URL for the stored certificate
 *  POST multipart        -> HR attaches a (paper) certificate to a request
 *
 * Access is gated here, at the API layer, with the service-role client — the
 * same model `/api/hr/leave/self` uses, because RLS is disabled on the HR
 * tables. Reads are allowed for hr/admin/superadmin, or for the employee the
 * request belongs to. Writes are HR-only (an employee attaches their own
 * certificate at submission time, via /api/hr/leave/self).
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HR_ROLES = ["hr", "admin", "superadmin"];

type Caller = {
  userId: string;
  isHr: boolean;
  employeeId: string | null;
};

async function resolveCaller(request: NextRequest): Promise<Caller | null> {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!accessToken) return null;

  const { data: userInfo } = await supabaseAdmin.auth.getUser(accessToken);
  const userId = userInfo?.user?.id;
  const userEmail = userInfo?.user?.email;
  if (!userId) return null;

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const isHr = (roles || []).some((r) => HR_ROLES.includes(r.role as string));

  // Same resolution order as /api/hr/leave/self: user_id first, email fallback.
  let { data: employee } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!employee && userEmail) {
    const { data: byEmail } = await supabaseAdmin
      .from("employees")
      .select("id")
      .ilike("email", userEmail)
      .maybeSingle();
    employee = byEmail;
  }

  return { userId, isHr, employeeId: employee?.id ?? null };
}

async function loadRequest(requestId: string) {
  const { data } = await supabaseAdmin
    .from("leave_requests")
    .select("id, employee_id, attachment_path")
    .eq("id", requestId)
    .maybeSingle();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestId = request.nextUrl.searchParams.get("request_id") || "";
    if (!requestId) {
      return NextResponse.json({ error: "request_id is required." }, { status: 400 });
    }

    const leaveRequest = await loadRequest(requestId);
    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found." }, { status: 404 });
    }

    if (!caller.isHr && leaveRequest.employee_id !== caller.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!leaveRequest.attachment_path) {
      return NextResponse.json(
        { error: "No certificate is attached to this request." },
        { status: 404 }
      );
    }

    const url = await signLeaveAttachment(supabaseAdmin, leaveRequest.attachment_path);
    if (!url) {
      return NextResponse.json(
        { error: "Could not open the certificate. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Leave attachment GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveCaller(request);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!caller.isHr) {
      return NextResponse.json(
        { error: "Insufficient permissions. HR role required." },
        { status: 403 }
      );
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
    }

    const requestId = (form.get("request_id") || "").toString();
    const file = form.get("file");
    if (!requestId || !(file instanceof File)) {
      return NextResponse.json(
        { error: "request_id and file are required." },
        { status: 400 }
      );
    }

    const problem = validateLeaveAttachment(file);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }

    const leaveRequest = await loadRequest(requestId);
    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found." }, { status: 404 });
    }

    const path = await uploadLeaveAttachment(
      supabaseAdmin,
      leaveRequest.employee_id,
      file
    );

    const { error } = await supabaseAdmin
      .from("leave_requests")
      .update({ attachment_path: path })
      .eq("id", requestId);

    if (error) {
      console.error("Leave attachment update error:", error);
      return NextResponse.json(
        { error: "Uploaded, but the request could not be updated." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, attachment_path: path });
  } catch (err) {
    console.error("Leave attachment POST error:", err);
    const message =
      err instanceof Error ? err.message : "Could not attach the certificate.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
