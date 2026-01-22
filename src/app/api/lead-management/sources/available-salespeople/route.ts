import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get optional exclude_source_id from query params
    const { searchParams } = new URL(request.url);
    const excludeSourceId = searchParams.get("exclude_source_id");

    // Fetch all users with salesperson role
    const { data: salespersonRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "salesperson");

    if (rolesError) throw rolesError;

    const salespersonIds = salespersonRoles?.map((r) => r.user_id) || [];

    if (salespersonIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get currently assigned salespeople (excluding the source being edited)
    let assignedQuery = supabaseAdmin
      .from("source_salesperson_assignments")
      .select("salesperson_id");

    if (excludeSourceId) {
      assignedQuery = assignedQuery.neq("source_id", excludeSourceId);
    }

    const { data: assignedSalespeople, error: assignedError } = await assignedQuery;

    if (assignedError) throw assignedError;

    const assignedIds = new Set(assignedSalespeople?.map((a) => a.salesperson_id) || []);

    // Filter out already assigned salespeople
    const availableIds = salespersonIds.filter((id) => !assignedIds.has(id));

    if (availableIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Fetch profiles for available salespeople
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", availableIds);

    if (profilesError) throw profilesError;

    return NextResponse.json({ data: profiles || [] });
  } catch (error) {
    console.error("Error fetching available salespeople:", error);
    return NextResponse.json(
      { error: "Failed to fetch available salespeople" },
      { status: 500 }
    );
  }
}
