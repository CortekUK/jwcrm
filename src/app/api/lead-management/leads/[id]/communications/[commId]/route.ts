import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH - Update communication
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commId: string }> }
) {
  try {
    const { id: leadId, commId } = await params;
    const body = await request.json();
    const { communication_method_id, scheduled_at, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (communication_method_id !== undefined) {
      updateData.communication_method_id = communication_method_id;
    }
    if (scheduled_at !== undefined) updateData.scheduled_at = scheduled_at;
    if (notes !== undefined) updateData.notes = notes;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("lead_communications")
      .update(updateData)
      .eq("id", commId)
      .eq("lead_id", leadId)
      .select(`
        *,
        communication_method:communication_methods(id, name, icon)
      `)
      .single();

    if (error) {
      console.error("Error updating communication:", error);
      return NextResponse.json(
        { error: "Failed to update communication" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Communication not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in PATCH /api/lead-management/leads/[id]/communications/[commId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete communication
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commId: string }> }
) {
  try {
    const { id: leadId, commId } = await params;

    const { error } = await supabaseAdmin
      .from("lead_communications")
      .delete()
      .eq("id", commId)
      .eq("lead_id", leadId);

    if (error) {
      console.error("Error deleting communication:", error);
      return NextResponse.json(
        { error: "Failed to delete communication" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Communication deleted" });
  } catch (error) {
    console.error("Error in DELETE /api/lead-management/leads/[id]/communications/[commId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
