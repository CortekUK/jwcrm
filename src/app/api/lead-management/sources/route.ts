import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Fetch all sources with assigned salespeople count
    const { data: sources, error: sourcesError } = await supabaseAdmin
      .from("lead_sources")
      .select(`
        *,
        assignments:source_salesperson_assignments(
          id,
          salesperson_id,
          assigned_at
        )
      `)
      .order("created_at", { ascending: false });

    if (sourcesError) throw sourcesError;

    // For each source, fetch salesperson names
    const sourcesWithSalespeople = await Promise.all(
      (sources || []).map(async (source) => {
        const salespersonIds = source.assignments?.map((a: { salesperson_id: string }) => a.salesperson_id) || [];

        if (salespersonIds.length === 0) {
          return {
            ...source,
            salespeople: [],
            salespeople_count: 0,
          };
        }

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", salespersonIds);

        return {
          ...source,
          salespeople: profiles || [],
          salespeople_count: salespersonIds.length,
        };
      })
    );

    return NextResponse.json({ data: sourcesWithSalespeople });
  } catch (error) {
    console.error("Error fetching sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, salesperson_ids } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "Source name is required" },
        { status: 400 }
      );
    }

    // Create the source
    const { data: source, error: sourceError } = await supabaseAdmin
      .from("lead_sources")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (sourceError) {
      if (sourceError.code === "23505") {
        return NextResponse.json(
          { error: "A source with this name already exists" },
          { status: 400 }
        );
      }
      throw sourceError;
    }

    // Assign salespeople if provided
    if (salesperson_ids && salesperson_ids.length > 0) {
      const assignments = salesperson_ids.map((id: string) => ({
        source_id: source.id,
        salesperson_id: id,
      }));

      const { error: assignError } = await supabaseAdmin
        .from("source_salesperson_assignments")
        .insert(assignments);

      if (assignError) {
        console.error("Error assigning salespeople:", assignError);
      }
    }

    return NextResponse.json({ data: source }, { status: 201 });
  } catch (error) {
    console.error("Error creating source:", error);
    return NextResponse.json(
      { error: "Failed to create source" },
      { status: 500 }
    );
  }
}
