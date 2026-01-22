import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - List communications for a lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    const { data, error } = await supabaseAdmin
      .from("lead_communications")
      .select(`
        *,
        communication_method:communication_methods(id, name, icon)
      `)
      .eq("lead_id", leadId)
      .order("scheduled_at", { ascending: false });

    if (error) {
      console.error("Error fetching communications:", error);
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
    console.error("Error in GET /api/lead-management/leads/[id]/communications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Add new communication to lead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const body = await request.json();
    const { communication_method_id, scheduled_at, notes, created_by } = body;

    if (!communication_method_id) {
      return NextResponse.json(
        { error: "Communication method is required" },
        { status: 400 }
      );
    }

    if (!scheduled_at) {
      return NextResponse.json(
        { error: "Date/time is required" },
        { status: 400 }
      );
    }

    // Verify the lead exists
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("lead_communications")
      .insert({
        lead_id: leadId,
        communication_method_id,
        scheduled_at,
        notes: notes || null,
        created_by: created_by || null,
      })
      .select(`
        *,
        communication_method:communication_methods(id, name, icon)
      `)
      .single();

    if (error) {
      console.error("Error creating communication:", error);
      return NextResponse.json(
        { error: "Failed to create communication" },
        { status: 500 }
      );
    }

    // Update lead status to 'contacted' when communication is logged
    await supabaseAdmin
      .from("leads")
      .update({ status: "contacted" })
      .eq("id", leadId);

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/lead-management/leads/[id]/communications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
