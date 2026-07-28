import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCanManageLeadDeal } from "@/lib/lead-management/proposalInvoice";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH - Update the lead's free-text notes field.
//
// NOTE ON THE TWO NOTE MODELS: the GET/POST handlers below operate on the
// `lead_notes` table (append-only, one row per note), while this handler
// updates `leads.notes` (a single free-text field). The lead detail page's
// auto-saving notes panel uses the latter, and that is where the real data
// lives — 42 leads have `leads.notes` set versus 1 row in `lead_notes`.
// This handler was simply never written, so every auto-save hit a 405 and
// surfaced as "Failed to save notes".
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: userInfo, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userInfo?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const callerId = userInfo.user.id;

    const body = await request.json().catch(() => ({}));
    const { notes } = body;
    if (typeof notes !== "string") {
      return NextResponse.json(
        { error: "notes must be a string" },
        { status: 400 }
      );
    }

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, assigned_to")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Same rule as the other lead write paths: staff roles only, and a
    // salesperson may only edit notes on a lead assigned to them.
    const auth = await assertCanManageLeadDeal(supabaseAdmin, callerId, lead);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from("leads")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .select("id, notes, updated_at")
      .single();

    if (error) {
      console.error("Error updating lead notes:", error);
      return NextResponse.json(
        { error: "Failed to save notes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in PATCH /api/lead-management/leads/[id]/notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
