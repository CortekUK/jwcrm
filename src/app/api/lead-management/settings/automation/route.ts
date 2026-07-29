import { NextRequest, NextResponse } from "next/server";
import {
  assertCanWriteLeadSettings,
  getLeadAutomationSettings,
  writeSettingRow,
} from "@/lib/lead-management/settingsServer";
import {
  DEFAULT_LEAD_AUTOMATION,
  LEAD_SETTING_KEYS,
  type LeadAutomationSettings,
} from "@/lib/lead-management/settingsTypes";

export async function GET() {
  try {
    const settings = await getLeadAutomationSettings();
    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("Error fetching lead automation settings:", error);
    return NextResponse.json({ data: DEFAULT_LEAD_AUTOMATION });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await assertCanWriteLeadSettings(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const incoming = Array.isArray(body?.rules)
      ? (body.rules as { id?: string; isActive?: boolean }[])
      : [];

    // Rule identities, labels and wiring are code-owned; only the on/off flag
    // is client-editable, so a stored rule can never name an id no server
    // code checks.
    const rules = DEFAULT_LEAD_AUTOMATION.rules.map((fallback) => {
      const match = incoming.find((r) => r?.id === fallback.id);
      return match && typeof match.isActive === "boolean"
        ? { ...fallback, isActive: match.isActive }
        : fallback;
    });

    const rawDays = Number(body?.staleLeadDays);
    if (!Number.isInteger(rawDays) || rawDays < 1 || rawDays > 365) {
      return NextResponse.json(
        { error: "staleLeadDays must be an integer between 1 and 365" },
        { status: 400 }
      );
    }

    // Keep the rule's displayed trigger text honest about the configured
    // threshold — the row is what the settings page renders.
    const value: LeadAutomationSettings = {
      staleLeadDays: rawDays,
      rules: rules.map((r) =>
        r.id === "auto_reminder_7days"
          ? { ...r, trigger: `Lead not contacted for ${rawDays} days` }
          : r
      ),
    };

    await writeSettingRow(
      LEAD_SETTING_KEYS.automation,
      value,
      "Lead-management automation rules plus the configurable stale-lead threshold (days of silence before a follow-up reminder is auto-created)."
    );

    return NextResponse.json({ data: value });
  } catch (error) {
    console.error("Error updating lead automation settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
