import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - List notes for a lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    const { data, error } = await supabaseAdmin
      .from("lead_notes")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notes:", error);
      return NextResponse.json(
        { error: "Failed to fetch notes" },
        { status: 500 }
      );
    }

    // Fetch creator names
    const notesWithCreators = await Promise.all(
      (data || []).map(async (note) => {
        let createdByName = null;
        if (note.created_by) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("user_id", note.created_by)
            .single();
          createdByName = profile?.full_name;
        }
        return {
          ...note,
          created_by_name: createdByName,
        };
      })
    );

    return NextResponse.json({ data: notesWithCreators });
  } catch (error) {
    console.error("Error in GET /api/lead-management/leads/[id]/notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const body = await request.json();
    const { content, created_by } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Note content is required" },
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
      .from("lead_notes")
      .insert({
        lead_id: leadId,
        content: content.trim(),
        created_by: created_by || null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error creating note:", error);
      return NextResponse.json(
        { error: "Failed to create note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/lead-management/leads/[id]/notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
