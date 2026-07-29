import { NextRequest, NextResponse } from "next/server";
import {
  assertCanWriteLeadSettings,
  getLeadCadenceSettings,
  writeSettingRow,
} from "@/lib/lead-management/settingsServer";
import {
  ALL_FAILED_OUTCOMES,
  DEFAULT_LEAD_CADENCE,
  LEAD_SETTING_KEYS,
  type LeadCadenceSettings,
} from "@/lib/lead-management/settingsTypes";

// Contact cadence. This route previously exposed an unrelated shape
// ({enabled, max_attempts, interval_hours}) that only the never-rendered
// FollowupCadenceSettings component spoke, while the Settings page kept its
// own copy in localStorage. The Settings page UI is the source of truth, so
// the route now serves that shape and the old one is gone.
export async function GET() {
  try {
    const settings = await getLeadCadenceSettings();
    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("Error fetching contact cadence settings:", error);
    return NextResponse.json({ data: DEFAULT_LEAD_CADENCE });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await assertCanWriteLeadSettings(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();

    const maxAttempts = Number(body?.maxAttempts);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
      return NextResponse.json(
        { error: "maxAttempts must be an integer between 1 and 20" },
        { status: 400 }
      );
    }

    const intervalDays = Number(body?.intervalDays);
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 30) {
      return NextResponse.json(
        { error: "intervalDays must be an integer between 1 and 30" },
        { status: 400 }
      );
    }

    const allowed = new Set(ALL_FAILED_OUTCOMES.map((o) => o.value));
    const failedOutcomes = Array.isArray(body?.failedOutcomes)
      ? (body.failedOutcomes as unknown[])
          .filter((o): o is string => typeof o === "string" && allowed.has(o))
      : DEFAULT_LEAD_CADENCE.failedOutcomes;

    const value: LeadCadenceSettings = {
      maxAttempts,
      intervalDays,
      autoMarkUnreachable:
        typeof body?.autoMarkUnreachable === "boolean"
          ? body.autoMarkUnreachable
          : DEFAULT_LEAD_CADENCE.autoMarkUnreachable,
      failedOutcomes: [...new Set(failedOutcomes)],
    };

    await writeSettingRow(
      LEAD_SETTING_KEYS.cadence,
      value,
      "Contact cadence: how many consecutive failed call outcomes mark a lead unreachable, the recommended gap between attempts, and which outcomes count as failed."
    );

    return NextResponse.json({ data: value });
  } catch (error) {
    console.error("Error updating contact cadence settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
