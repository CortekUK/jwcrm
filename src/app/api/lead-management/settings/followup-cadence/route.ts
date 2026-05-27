import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SETTING_KEY = "lead_followup_cadence";

const DEFAULT_SETTINGS = {
  enabled: true,
  max_attempts: 3,
  interval_hours: 48,
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("setting_value, updated_at")
      .eq("setting_key", SETTING_KEY)
      .single();

    if (error && error.code === "PGRST116") {
      // Not found - return defaults
      return NextResponse.json({ data: { setting_value: DEFAULT_SETTINGS, updated_at: null } });
    }

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching followup cadence settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled, max_attempts, interval_hours } = body;

    // Validate inputs
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
    }
    if (!Number.isInteger(max_attempts) || max_attempts < 1 || max_attempts > 10) {
      return NextResponse.json({ error: "max_attempts must be an integer between 1 and 10" }, { status: 400 });
    }
    if (!Number.isInteger(interval_hours) || interval_hours < 1 || interval_hours > 720) {
      return NextResponse.json({ error: "interval_hours must be an integer between 1 and 720" }, { status: 400 });
    }

    const settingValue = { enabled, max_attempts, interval_hours };

    // Upsert the setting
    const { data: existing } = await supabaseAdmin
      .from("system_settings")
      .select("id")
      .eq("setting_key", SETTING_KEY)
      .single();

    let data;
    let error;

    if (existing) {
      ({ data, error } = await supabaseAdmin
        .from("system_settings")
        .update({ setting_value: settingValue })
        .eq("setting_key", SETTING_KEY)
        .select("setting_value, updated_at")
        .single());
    } else {
      ({ data, error } = await supabaseAdmin
        .from("system_settings")
        .insert({
          setting_key: SETTING_KEY,
          setting_value: settingValue,
          description: "Settings for automated proposal follow-up emails.",
        })
        .select("setting_value, updated_at")
        .single());
    }

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error updating followup cadence settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
