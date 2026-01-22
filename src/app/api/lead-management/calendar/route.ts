import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch communications for a salesperson's leads in date range
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Build query for communications with lead details
    let query = supabaseAdmin
      .from("lead_communications")
      .select(`
        id,
        lead_id,
        scheduled_at,
        notes,
        created_at,
        created_by,
        communication_method:communication_methods(id, name, icon),
        lead:leads!inner(
          id,
          full_name,
          email,
          phone,
          company_name,
          assigned_to
        )
      `)
      .eq("lead.assigned_to", userId)
      .order("scheduled_at", { ascending: true });

    // Filter by date range if provided
    if (startDate) {
      query = query.gte("scheduled_at", startDate);
    }
    if (endDate) {
      query = query.lte("scheduled_at", endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching calendar communications:", error);
      return NextResponse.json(
        { error: "Failed to fetch communications" },
        { status: 500 }
      );
    }

    // Fetch creator names
    const dataWithCreators = await Promise.all(
      (data || []).map(async (comm) => {
        let createdByName = null;
        if (comm.created_by) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("user_id", comm.created_by)
            .single();
          createdByName = profile?.full_name;
        }
        return {
          ...comm,
          created_by_name: createdByName,
        };
      })
    );

    return NextResponse.json({ data: dataWithCreators });
  } catch (error) {
    console.error("Error in GET /api/lead-management/calendar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
