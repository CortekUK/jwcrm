// POST /api/feedback
//
// Staff "Report an issue" button. Emails the report to the monitored team
// inbox (EMAIL_REPLY_TO → info@just-wills.net) from the verified sender, with
// Reply-To set to the reporting staff member so the team can answer them
// directly. Email only — nothing is stored.
//
// Auth: Bearer access token. Users whose only role is `client` (or who have
// no role at all) are refused — this is a staff-only channel.

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { EMAIL_FROM, EMAIL_REPLY_TO } from "@/config/email";
import {
  FEEDBACK_CATEGORIES,
  escapeHtml,
  validateFeedback,
} from "@/lib/feedback/validateFeedback";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
    }

    const { data: userInfo, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userInfo?.user;
    if (userError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 });
    }

    const { data: roleRows, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesError) {
      console.error("feedback: failed to load roles", rolesError);
      return NextResponse.json({ error: "Could not verify your account" }, { status: 500 });
    }
    const roles = Array.from(
      new Set((roleRows || []).map((r: { role: string }) => r.role))
    );
    const staffRoles = roles.filter((r) => r !== "client");
    if (staffRoles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const validation = validateFeedback(rawBody);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { category, message, pageUrl, attachment } = validation.value;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: "Email is not configured" }, { status: 500 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const email = user.email || "";
    const name =
      (profile?.full_name as string | null | undefined)?.trim() ||
      (user.user_metadata?.full_name as string | undefined)?.trim() ||
      email ||
      "Unknown user";
    const categoryLabel = FEEDBACK_CATEGORIES[category];
    const userAgent = (request.headers.get("user-agent") || "").slice(0, 500);
    const timestamp = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dubai",
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date());

    // Subject is a header: strip anything that could break it.
    const subjectName = name.replace(/[\r\n]+/g, " ").slice(0, 120);
    const subject = `[CRM feedback] ${categoryLabel} — ${subjectName}`;

    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#555;vertical-align:top;white-space:nowrap;"><strong>${label}</strong></td><td style="padding:6px 0;color:#222;word-break:break-word;">${value}</td></tr>`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background-color: #0C5536; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">CRM feedback: ${escapeHtml(categoryLabel)}</h1>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #E6E6E4;">
          <table style="border-collapse: collapse; font-size: 14px; width: 100%;">
            ${row("Name", escapeHtml(name))}
            ${row("Email", escapeHtml(email || "(none)"))}
            ${row("Role(s)", escapeHtml(roles.join(", ")))}
            ${row("Category", escapeHtml(categoryLabel))}
            ${row("Page", pageUrl ? `<a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a>` : "(not captured)")}
            ${row("Browser", escapeHtml(userAgent || "(unknown)"))}
            ${row("Sent at", `${escapeHtml(timestamp)} (Dubai time)`)}
            ${row("Screenshot", attachment ? escapeHtml(attachment.filename) + " (attached)" : "None")}
          </table>
          <h2 style="color: #0C5536; font-size: 16px; margin: 20px 0 8px;">Message</h2>
          <div style="background-color: white; padding: 15px; border-radius: 5px; border: 1px solid #E6E6E4;">
            <p style="white-space: pre-wrap; color: #333; margin: 0;">${escapeHtml(message)}</p>
          </div>
        </div>
        <div style="background-color: #f5f5f5; padding: 12px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #999; font-size: 12px; margin: 0;">Sent from the Just Wills CRM "Report an issue" button. Reply to this email to answer ${escapeHtml(name)} directly.</p>
        </div>
      </div>
    `;

    const text = [
      `CRM feedback: ${categoryLabel}`,
      `Name: ${name}`,
      `Email: ${email || "(none)"}`,
      `Role(s): ${roles.join(", ")}`,
      `Page: ${pageUrl || "(not captured)"}`,
      `Browser: ${userAgent || "(unknown)"}`,
      `Sent at: ${timestamp} (Dubai time)`,
      `Screenshot: ${attachment ? attachment.filename : "None"}`,
      "",
      message,
    ].join("\n");

    const resend = new Resend(resendApiKey);
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_REPLY_TO,
      ...(email ? { replyTo: email } : {}),
      subject,
      html,
      text,
      ...(attachment
        ? {
            attachments: [
              {
                content: attachment.content,
                filename: attachment.filename,
                contentType: attachment.contentType,
              },
            ],
          }
        : {}),
    });

    if (result.error) {
      console.error("feedback: Resend error", result.error);
      return NextResponse.json({ error: "Failed to send your report" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: result.data?.id ?? null });
  } catch (error) {
    console.error("feedback: unexpected error", error);
    return NextResponse.json({ error: "Failed to send your report" }, { status: 500 });
  }
}
