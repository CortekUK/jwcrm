import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch communications for a salesperson's leads in date range,
// plus that salesperson's call reminders (lead_reminders) in the same range
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

    // Fetch creator names in one query (was one query per row)
    const creatorIds = Array.from(
      new Set((data || []).map((comm) => comm.created_by).filter(Boolean))
    ) as string[];
    const creatorNames = new Map<string, string | null>();
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", creatorIds);
      (profiles || []).forEach((p) => creatorNames.set(p.user_id, p.full_name));
    }
    const dataWithCreators = (data || []).map((comm) => ({
      ...comm,
      created_by_name: comm.created_by
        ? creatorNames.get(comm.created_by) ?? null
        : null,
    }));

    // Planned calls / callbacks live in lead_reminders (Set Reminder dialog,
    // call-attempt retries, new-lead and stale-lead follow-ups). Include them
    // so the calendar shows every call the salesperson has to make.
    let remindersQuery = supabaseAdmin
      .from("lead_reminders")
      .select(`
        id,
        lead_id,
        salesperson_id,
        title,
        description,
        remind_at,
        status,
        completed_at,
        created_at,
        lead:leads(
          id,
          full_name,
          email,
          phone,
          company_name
        )
      `)
      .eq("salesperson_id", userId)
      .neq("status", "dismissed")
      .order("remind_at", { ascending: true });

    if (startDate) {
      remindersQuery = remindersQuery.gte("remind_at", startDate);
    }
    if (endDate) {
      remindersQuery = remindersQuery.lte("remind_at", endDate);
    }

    const { data: reminders, error: remindersError } = await remindersQuery;

    if (remindersError) {
      // Don't take the whole calendar down if reminders fail; log and return
      // communications only.
      console.error("Error fetching calendar reminders:", remindersError);
    }

    return NextResponse.json({
      data: dataWithCreators,
      reminders: reminders || [],
    });
  } catch (error) {
    console.error("Error in GET /api/lead-management/calendar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
