import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get triggered reminders (for in-app notifications)
// Returns reminders that have been triggered by the cron job and need user attention
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const salespersonId = searchParams.get("salesperson_id");

    if (!salespersonId) {
      return NextResponse.json(
        { error: "Salesperson ID is required" },
        { status: 400 }
      );
    }

    // Get reminders that are either:
    // 1. triggered (cron ran and marked them)
    // 2. pending but past their remind_at time (for real-time checking)
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("lead_reminders")
      .select(`
        *,
        lead:leads(id, full_name, email, company_name, status)
      `)
      .eq("salesperson_id", salespersonId)
      .or(`status.eq.triggered,and(status.eq.pending,remind_at.lte.${now})`)
      .order("remind_at", { ascending: true });

    if (error) {
      console.error("Error fetching pending reminders:", error);
      return NextResponse.json(
        { error: "Failed to fetch pending reminders" },
        { status: 500 }
      );
    }

    // Count for badge
    const count = data?.length || 0;

    return NextResponse.json({ data, count });
  } catch (error) {
    console.error("Error in GET /api/lead-management/reminders/pending:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
