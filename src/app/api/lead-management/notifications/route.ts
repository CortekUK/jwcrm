import { NextRequest, NextResponse } from "next/server";
import {
  getLeadNotificationSettings,
  leadSettingsAdmin as supabaseAdmin,
  resolveCallerId,
} from "@/lib/lead-management/settingsServer";

/**
 * In-app notification feed for the existing bell.
 *
 * "Browser notifications" in the Notifications tab means exactly this — the
 * bell — not Web Push. When the switch is off this returns an empty feed, so
 * the badge goes quiet without any service-worker machinery.
 */
export async function GET(request: NextRequest) {
  try {
    const callerId = await resolveCallerId(request);
    const { searchParams } = new URL(request.url);
    const userId = callerId || searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ data: [], count: 0 });
    }

    const settings = await getLeadNotificationSettings();
    if (!settings.browserNotifications) {
      return NextResponse.json({ data: [], count: 0, disabled: true });
    }

    const { data, error } = await supabaseAdmin
      .from("lead_notification_events")
      .select("id, lead_id, event_type, title, body, created_at")
      .eq("recipient_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ data: data || [], count: (data || []).length });
  } catch (error) {
    console.error("Error fetching lead notifications:", error);
    return NextResponse.json({ data: [], count: 0 });
  }
}

/** Marks notifications read. Omit `ids` to clear the caller's whole feed. */
export async function PATCH(request: NextRequest) {
  try {
    const callerId = await resolveCallerId(request);
    const body = await request.json().catch(() => ({}));
    const userId = callerId || body?.user_id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let query = supabaseAdmin
      .from("lead_notification_events")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .is("read_at", null);

    if (Array.isArray(body?.ids) && body.ids.length > 0) {
      query = query.in("id", body.ids as string[]);
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking lead notifications read:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
