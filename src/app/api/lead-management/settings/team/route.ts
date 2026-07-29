import { NextRequest, NextResponse } from "next/server";
import {
  assertCanWriteLeadSettings,
  getLeadTeamSettings,
  writeSettingRow,
} from "@/lib/lead-management/settingsServer";
import {
  DEFAULT_LEAD_TEAM,
  LEAD_SETTING_KEYS,
  type LeadTeamSettings,
} from "@/lib/lead-management/settingsTypes";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  try {
    const settings = await getLeadTeamSettings();
    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("Error fetching lead team settings:", error);
    return NextResponse.json({ data: DEFAULT_LEAD_TEAM });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await assertCanWriteLeadSettings(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();

    const method = body?.defaultAssignmentMethod;
    if (!["by_source", "round_robin", "manual"].includes(method)) {
      return NextResponse.json(
        { error: "defaultAssignmentMethod must be by_source, round_robin or manual" },
        { status: 400 }
      );
    }

    const start = String(body?.workingHoursStart ?? "");
    const end = String(body?.workingHoursEnd ?? "");
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) {
      return NextResponse.json(
        { error: "workingHoursStart/End must be HH:MM" },
        { status: 400 }
      );
    }

    const value: LeadTeamSettings = {
      defaultAssignmentMethod: method,
      workingHoursStart: start,
      workingHoursEnd: end,
      autoAssignNewLeads:
        typeof body?.autoAssignNewLeads === "boolean"
          ? body.autoAssignNewLeads
          : DEFAULT_LEAD_TEAM.autoAssignNewLeads,
      notifyOnAssignment:
        typeof body?.notifyOnAssignment === "boolean"
          ? body.notifyOnAssignment
          : DEFAULT_LEAD_TEAM.notifyOnAssignment,
    };

    await writeSettingRow(
      LEAD_SETTING_KEYS.team,
      value,
      "Lead assignment method (by_source | round_robin | manual), auto-assign and assignment-email switches, and the working-hours window used to hold notification emails."
    );

    return NextResponse.json({ data: value });
  } catch (error) {
    console.error("Error updating lead team settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
