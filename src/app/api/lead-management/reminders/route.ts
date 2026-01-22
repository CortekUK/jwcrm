import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - List reminders (optionally filtered by salesperson_id, status, lead_id)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const leadId = searchParams.get("lead_id");
    const salespersonId = searchParams.get("salesperson_id");

    let query = supabaseAdmin
      .from("lead_reminders")
      .select(`
        *,
        lead:leads(id, full_name, email, company_name, status)
      `)
      .order("remind_at", { ascending: true });

    if (salespersonId) {
      query = query.eq("salesperson_id", salespersonId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (leadId) {
      query = query.eq("lead_id", leadId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching reminders:", error);
      return NextResponse.json(
        { error: "Failed to fetch reminders" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in GET /api/lead-management/reminders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create new reminder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, salesperson_id, title, description, remind_at } = body;

    if (!lead_id) {
      return NextResponse.json(
        { error: "Lead ID is required" },
        { status: 400 }
      );
    }

    if (!salesperson_id) {
      return NextResponse.json(
        { error: "Salesperson ID is required" },
        { status: 400 }
      );
    }

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!remind_at) {
      return NextResponse.json(
        { error: "Reminder time is required" },
        { status: 400 }
      );
    }

    // Verify the lead exists
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("id", lead_id)
      .single();

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("lead_reminders")
      .insert({
        lead_id,
        salesperson_id,
        title: title.trim(),
        description: description || null,
        remind_at,
        status: "pending",
      })
      .select(`
        *,
        lead:leads(id, full_name, email, company_name, status)
      `)
      .single();

    if (error) {
      console.error("Error creating reminder:", error);
      return NextResponse.json(
        { error: "Failed to create reminder" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/lead-management/reminders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
