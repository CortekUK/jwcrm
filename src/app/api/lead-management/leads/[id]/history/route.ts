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
    const { id: leadId } = await params;

    // Fetch lead with source data
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select(`
        *,
        source_data:lead_sources(id, name)
      `)
      .eq("id", leadId)
      .single();

    if (leadError) {
      if (leadError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Lead not found" },
          { status: 404 }
        );
      }
      throw leadError;
    }

    // Fetch assigned user profile if exists
    let assignedUser = null;
    if (lead.assigned_to) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .eq("user_id", lead.assigned_to)
        .single();

      // Fetch email from auth.users
      if (profile) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(lead.assigned_to);
        assignedUser = {
          ...profile,
          email: authUser?.user?.email || "",
        };
      }
    }

    // Fetch all proposals for this lead
    const { data: proposals, error: proposalsError } = await supabaseAdmin
      .from("proposals")
      .select(`
        id,
        invoice_number,
        amount,
        currency,
        status,
        created_at,
        sent_at,
        paid_at
      `)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (proposalsError) {
      console.error("Error fetching proposals:", proposalsError);
    }

    // Fetch all communications for this lead
    const { data: communications, error: communicationsError } = await supabaseAdmin
      .from("lead_communications")
      .select(`
        id,
        scheduled_at,
        notes,
        created_by,
        created_at,
        communication_method:communication_methods(id, name, icon)
      `)
      .eq("lead_id", leadId)
      .order("scheduled_at", { ascending: false });

    if (communicationsError) {
      console.error("Error fetching communications:", communicationsError);
    }

    // Fetch creator names for communications
    const communicationsWithCreator = await Promise.all(
      (communications || []).map(async (comm) => {
        let createdByName = null;
        if (comm.created_by) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("user_id", comm.created_by)
            .single();
          createdByName = profile?.full_name;
        }
        return {
          ...comm,
          created_by_name: createdByName,
        };
      })
    );

    // Fetch reminders for this lead
    const { data: reminders, error: remindersError } = await supabaseAdmin
      .from("lead_reminders")
      .select(`
        id,
        title,
        description,
        remind_at,
        status,
        completed_at,
        created_at
      `)
      .eq("lead_id", leadId)
      .order("remind_at", { ascending: false });

    if (remindersError) {
      console.error("Error fetching reminders:", remindersError);
    }

    return NextResponse.json({
      data: {
        lead: {
          ...lead,
          assigned_user: assignedUser,
        },
        proposals: proposals || [],
        communications: communicationsWithCreator || [],
        reminders: reminders || [],
      },
    });
  } catch (error) {
    console.error("Error fetching lead history:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead history" },
      { status: 500 }
    );
  }
}
