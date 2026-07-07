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
    const { id: salespersonId } = await params;

    // Fetch salesperson profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .eq("user_id", salespersonId)
      .single();

    if (profileError) {
      if (profileError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Salesperson not found" },
          { status: 404 }
        );
      }
      throw profileError;
    }

    // Fetch user email from auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(salespersonId);

    const salesperson = {
      user_id: profile.user_id,
      full_name: profile.full_name,
      email: authUser?.user?.email || "",
    };

    // Fetch all leads where this salesperson is the primary assignee OR a
    // co-assignee (multi-assignee support via lead_assignments).
    const { data: coAssignments } = await supabaseAdmin
      .from("lead_assignments")
      .select("lead_id")
      .eq("salesperson_id", salespersonId);
    const coAssignedLeadIds = (coAssignments || []).map((a) => a.lead_id);

    let leadsQuery = supabaseAdmin
      .from("leads")
      .select(`
        *,
        source_data:lead_sources(id, name)
      `)
      .order("created_at", { ascending: false });

    if (coAssignedLeadIds.length > 0) {
      leadsQuery = leadsQuery.or(
        `assigned_to.eq.${salespersonId},id.in.(${coAssignedLeadIds.join(",")})`
      );
    } else {
      leadsQuery = leadsQuery.eq("assigned_to", salespersonId);
    }

    const { data: leads, error: leadsError } = await leadsQuery;

    if (leadsError) throw leadsError;

    // Calculate stats
    const total = leads?.length || 0;
    const won = leads?.filter((l) => l.status === "won").length || 0;
    const lost = leads?.filter((l) => l.status === "lost").length || 0;
    const pending = leads?.filter((l) => l.status === "pending").length || 0;
    const inProgress =
      leads?.filter((l) => !["won", "lost", "pending"].includes(l.status))
        .length || 0;
    const conversionRate = total > 0 ? (won / total) * 100 : 0;

    const totalRevenue =
      leads
        ?.filter((l) => l.is_paid && l.paid_amount)
        .reduce((sum, l) => sum + (l.paid_amount || 0), 0) || 0;

    // Get the most common currency
    const currencies =
      leads?.filter((l) => l.paid_currency).map((l) => l.paid_currency!) || [];
    const currency = currencies.length > 0 ? currencies[0] : "AED";

    return NextResponse.json({
      data: {
        salesperson,
        leads: leads || [],
        stats: {
          total,
          won,
          lost,
          pending,
          inProgress,
          conversionRate,
          totalRevenue,
          currency,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching salesperson leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch salesperson leads" },
      { status: 500 }
    );
  }
}
