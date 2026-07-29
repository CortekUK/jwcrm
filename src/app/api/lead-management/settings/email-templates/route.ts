import { NextRequest, NextResponse } from "next/server";
import {
  assertCanWriteLeadSettings,
  getLeadEmailTemplates,
  writeSettingRow,
} from "@/lib/lead-management/settingsServer";
import {
  DEFAULT_LEAD_TEMPLATES,
  LEAD_SETTING_KEYS,
  type LeadEmailTemplate,
} from "@/lib/lead-management/settingsTypes";

export async function GET() {
  try {
    const templates = await getLeadEmailTemplates();
    return NextResponse.json({ data: { templates } });
  } catch (error) {
    console.error("Error fetching lead email templates:", error);
    return NextResponse.json({ data: { templates: DEFAULT_LEAD_TEMPLATES } });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await assertCanWriteLeadSettings(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const incoming = body?.templates;
    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: "templates must be an array" }, { status: 400 });
    }

    // The set of templates and their variable lists are code-owned — only the
    // subject, body and active flag are editable. This stops a client from
    // inventing template ids the senders would never look up, or declaring
    // variables nothing supplies.
    const templates: LeadEmailTemplate[] = DEFAULT_LEAD_TEMPLATES.map((fallback) => {
      const match = (incoming as Partial<LeadEmailTemplate>[]).find(
        (t) => t?.id === fallback.id
      );
      if (!match) return fallback;
      return {
        ...fallback,
        subject:
          typeof match.subject === "string" && match.subject.trim()
            ? match.subject
            : fallback.subject,
        body:
          typeof match.body === "string" && match.body.trim() ? match.body : fallback.body,
        isActive: typeof match.isActive === "boolean" ? match.isActive : fallback.isActive,
      };
    });

    await writeSettingRow(
      LEAD_SETTING_KEYS.templates,
      { templates },
      "Editable subject/body for the proposal, reminder, follow-up and meeting-invitation emails. English only. isActive=false falls back to the hardcoded builder."
    );

    return NextResponse.json({ data: { templates } });
  } catch (error) {
    console.error("Error updating lead email templates:", error);
    return NextResponse.json({ error: "Failed to update templates" }, { status: 500 });
  }
}
