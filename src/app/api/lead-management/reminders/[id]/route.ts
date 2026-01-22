import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Get single reminder
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("lead_reminders")
      .select(`
        *,
        lead:leads(id, full_name, email, company_name, status)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Reminder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in GET /api/lead-management/reminders/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update reminder (mark as done, dismiss, or edit)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, remind_at, status } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (remind_at !== undefined) updateData.remind_at = remind_at;
    if (status !== undefined) {
      updateData.status = status;
      // If marking as done, set completed_at
      if (status === "done") {
        updateData.completed_at = new Date().toISOString();
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("lead_reminders")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        lead:leads(id, full_name, email, company_name, status)
      `)
      .single();

    if (error) {
      console.error("Error updating reminder:", error);
      return NextResponse.json(
        { error: "Failed to update reminder" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Reminder not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in PATCH /api/lead-management/reminders/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete reminder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("lead_reminders")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting reminder:", error);
      return NextResponse.json(
        { error: "Failed to delete reminder" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Reminder deleted" });
  } catch (error) {
    console.error("Error in DELETE /api/lead-management/reminders/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
