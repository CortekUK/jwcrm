import { NextRequest, NextResponse } from "next/server";
import {
  assertCanWriteLeadSettings,
  getLeadNotificationSettings,
  writeSettingRow,
} from "@/lib/lead-management/settingsServer";
import {
  DEFAULT_LEAD_NOTIFICATIONS,
  LEAD_SETTING_KEYS,
  type LeadNotificationSettings,
} from "@/lib/lead-management/settingsTypes";

// Readable by anyone signed into the dashboard (salespeople see the values,
// with the controls rendered disabled). Writes are role-gated below.
export async function GET() {
  try {
    const settings = await getLeadNotificationSettings();
    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("Error fetching lead notification settings:", error);
    return NextResponse.json({ data: DEFAULT_LEAD_NOTIFICATIONS });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await assertCanWriteLeadSettings(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();

    const bool = (v: unknown, fallback: boolean) =>
      typeof v === "boolean" ? v : fallback;

    const frequency = body?.notificationFrequency;
    if (!["immediate", "daily", "weekly"].includes(frequency)) {
      return NextResponse.json(
        { error: "notificationFrequency must be immediate, daily or weekly" },
        { status: 400 }
      );
    }

    const value: LeadNotificationSettings = {
      emailNewLeadAssigned: bool(
        body?.emailNewLeadAssigned,
        DEFAULT_LEAD_NOTIFICATIONS.emailNewLeadAssigned
      ),
      emailStatusChanges: bool(
        body?.emailStatusChanges,
        DEFAULT_LEAD_NOTIFICATIONS.emailStatusChanges
      ),
      emailReminders: bool(body?.emailReminders, DEFAULT_LEAD_NOTIFICATIONS.emailReminders),
      browserNotifications: bool(
        body?.browserNotifications,
        DEFAULT_LEAD_NOTIFICATIONS.browserNotifications
      ),
      notificationFrequency: frequency,
    };

    await writeSettingRow(
      LEAD_SETTING_KEYS.notifications,
      value,
      "Lead-management notifications: which events email, whether the in-app bell is on, and immediate vs daily/weekly digest batching."
    );

    return NextResponse.json({ data: value });
  } catch (error) {
    console.error("Error updating lead notification settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
