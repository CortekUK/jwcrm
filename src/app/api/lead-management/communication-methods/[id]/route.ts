import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH - Update communication method
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, icon, is_active, display_order } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (icon !== undefined) updateData.icon = icon;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (display_order !== undefined) updateData.display_order = display_order;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("communication_methods")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating communication method:", error);
      return NextResponse.json(
        { error: "Failed to update communication method" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Communication method not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in PATCH /api/lead-management/communication-methods/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete (deactivate) communication method
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete by setting is_active to false
    const { data, error } = await supabaseAdmin
      .from("communication_methods")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error deleting communication method:", error);
      return NextResponse.json(
        { error: "Failed to delete communication method" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Communication method not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data, message: "Communication method deactivated" });
  } catch (error) {
    console.error("Error in DELETE /api/lead-management/communication-methods/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
