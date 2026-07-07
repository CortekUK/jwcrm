import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch a single lead by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("leads")
      .select(`
        *,
        source_data:lead_sources(id, name)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      throw error;
    }

    // Fetch assigned user profile
    let leadWithProfile = data;
    if (data.assigned_to) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("user_id", data.assigned_to)
        .single();
      leadWithProfile = { ...data, assigned_user: profile };
    } else {
      leadWithProfile = { ...data, assigned_user: null };
    }

    return NextResponse.json({ data: leadWithProfile });
  } catch (error) {
    console.error("Error fetching lead:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

// PATCH - Update a lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Allowed fields for update
    const allowedFields = [
      "full_name",
      "email",
      "phone",
      "company_name",
      "lead_type",
      "notes",
      "source_id",
      "status",
      "needs_identified",
      "quoted_price",
      "quoted_currency",
      "next_steps",
    ];

    // Build update object with only allowed fields
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Always update updated_at
    updateData.updated_at = new Date().toISOString();

    // Check if lead exists
    const { data: existingLead, error: fetchError } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Update the lead
    const { data, error } = await supabaseAdmin
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        source_data:lead_sources(id, name)
      `)
      .single();

    if (error) {
      console.error("Error updating lead:", error);
      throw error;
    }

    // Fetch assigned user profile
    let leadWithProfile = data;
    if (data.assigned_to) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("user_id", data.assigned_to)
        .single();
      leadWithProfile = { ...data, assigned_user: profile };
    } else {
      leadWithProfile = { ...data, assigned_user: null };
    }

    return NextResponse.json({ data: leadWithProfile });
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if lead exists
    const { data: existingLead, error: fetchError } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Delete the lead
    const { error } = await supabaseAdmin
      .from("leads")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting lead:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting lead:", error);
    return NextResponse.json(
      { error: "Failed to delete lead" },
      { status: 500 }
    );
  }
}
