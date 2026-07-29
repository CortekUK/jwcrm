import { NextRequest, NextResponse } from "next/server";
import { sendUserEmail } from "@/lib/integrations/sendUserEmail";
import { resolveLeadTemplate } from "@/lib/lead-management/leadEmailTemplates";
import {
  assertCanWriteLeadSettings,
  getLeadEmailTemplates,
} from "@/lib/lead-management/settingsServer";
import { resolveUserEmail, resolveUserName } from "@/lib/lead-management/leadNotifications";
import type { LeadEmailTemplate } from "@/lib/lead-management/settingsTypes";

// Placeholder values so a test send shows the template filled in rather than
// a page of raw {{handlebars}}.
const SAMPLE: Record<string, string> = {
  lead_name: "Sample Lead",
  invoice_number: "JW-TEST-0001",
  amount: "AED 5,250.00",
  salesperson_name: "Your Name",
  reminder_title: "Follow up on the draft will",
  reminder_description: "Client asked for a call back after reviewing the draft.",
  meeting_title: "Will drafting consultation",
  meeting_date: "Monday, 3 August 2026",
  meeting_time: "10:00 AM - 11:00 AM",
  meeting_location: "Just Wills office, Dubai",
};

/**
 * Actually sends the selected template to the signed-in user's own address.
 * (The Test button used to only pop a success toast.)
 *
 * Body may include unsaved subject/body so the button tests what is on
 * screen, not the last-saved version.
 */
export async function POST(request: NextRequest) {
  const auth = await assertCanWriteLeadSettings(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const templateId = String(body?.templateId || "");
    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const stored = await getLeadEmailTemplates();
    const base = stored.find((t) => t.id === templateId);
    if (!base) {
      return NextResponse.json({ error: "Unknown template" }, { status: 404 });
    }

    // A test send must work even while the template is toggled inactive —
    // that's how you check it before switching it on.
    const draft: LeadEmailTemplate = {
      ...base,
      subject: typeof body?.subject === "string" && body.subject.trim() ? body.subject : base.subject,
      body: typeof body?.body === "string" && body.body.trim() ? body.body : base.body,
      isActive: true,
    };

    const values: Record<string, string> = {};
    for (const name of draft.variables) {
      values[name] = SAMPLE[name] ?? `{{${name}}}`;
    }
    values.salesperson_name = (await resolveUserName(auth.callerId)) || values.salesperson_name;

    const rendered = resolveLeadTemplate([draft], templateId, values);
    if (!rendered) {
      return NextResponse.json(
        { error: "Template has an empty subject or body" },
        { status: 400 }
      );
    }

    const to = await resolveUserEmail(auth.callerId);
    if (!to) {
      return NextResponse.json(
        { error: "Your account has no email address" },
        { status: 400 }
      );
    }

    // Goes through the shared helper, so the Resend test-mode swap (everything
    // to ADMIN_EMAIL with the intended recipient in the subject until
    // PRODUCTION_EMAIL_MODE is set) still applies.
    const result = await sendUserEmail(auth.callerId, {
      to,
      subject: `[Test] ${rendered.subject}`,
      html: rendered.html,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Failed to send test email" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, sentTo: to, provider: result.provider });
  } catch (error) {
    console.error("Error sending template test email:", error);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
