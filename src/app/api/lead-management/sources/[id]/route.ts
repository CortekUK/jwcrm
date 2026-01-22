import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch source with assignments
    const { data: source, error: sourceError } = await supabaseAdmin
      .from("lead_sources")
      .select(`
        *,
        assignments:source_salesperson_assignments(
          id,
          salesperson_id,
          assigned_at
        )
      `)
      .eq("id", id)
      .single();

    if (sourceError) {
      if (sourceError.code === "PGRST116") {
        return NextResponse.json({ error: "Source not found" }, { status: 404 });
      }
      throw sourceError;
    }

    // Fetch salesperson names
    const salespersonIds = source.assignments?.map((a: { salesperson_id: string }) => a.salesperson_id) || [];

    if (salespersonIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", salespersonIds);

      return NextResponse.json({
        data: {
          ...source,
          salespeople: profiles || [],
        },
      });
    }

    return NextResponse.json({
      data: {
        ...source,
        salespeople: [],
      },
    });
  } catch (error) {
    console.error("Error fetching source:", error);
    return NextResponse.json(
      { error: "Failed to fetch source" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, is_active, salesperson_ids } = body;

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    // Update the source if there are fields to update
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("lead_sources")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        if (updateError.code === "23505") {
          return NextResponse.json(
            { error: "A source with this name already exists" },
            { status: 400 }
          );
        }
        throw updateError;
      }
    }

    // Handle salesperson assignments if provided
    if (salesperson_ids !== undefined) {
      // Delete existing assignments for this source
      await supabaseAdmin
        .from("source_salesperson_assignments")
        .delete()
        .eq("source_id", id);

      // Add new assignments
      if (salesperson_ids.length > 0) {
        const assignments = salesperson_ids.map((spId: string) => ({
          source_id: id,
          salesperson_id: spId,
        }));

        const { error: assignError } = await supabaseAdmin
          .from("source_salesperson_assignments")
          .insert(assignments);

        if (assignError) {
          console.error("Error assigning salespeople:", assignError);
        }
      }
    }

    // Fetch updated source
    const { data: source, error: fetchError } = await supabaseAdmin
      .from("lead_sources")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ data: source });
  } catch (error) {
    console.error("Error updating source:", error);
    return NextResponse.json(
      { error: "Failed to update source" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete the source (assignments will cascade)
    const { error: deleteError } = await supabaseAdmin
      .from("lead_sources")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting source:", error);
    return NextResponse.json(
      { error: "Failed to delete source" },
      { status: 500 }
    );
  }
}
