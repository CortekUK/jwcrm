import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getLeadAutomationSettings,
  resolveCallerId,
} from "@/lib/lead-management/settingsServer";
import { isRuleActive } from "@/lib/lead-management/settingsTypes";
import { notifyLeadEvent } from "@/lib/lead-management/leadNotifications";
import { buildBrandedLeadEmailHtml } from "@/lib/lead-management/leadEmailTemplates";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - List communications for a lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    const { data, error } = await supabaseAdmin
      .from("lead_communications")
      .select(`
        *,
        communication_method:communication_methods(id, name, icon)
      `)
      .eq("lead_id", leadId)
      .order("scheduled_at", { ascending: false });

    if (error) {
      console.error("Error fetching communications:", error);
      return NextResponse.json(
        { error: "Failed to fetch communications" },
        { status: 500 }
      );
    }

    // Fetch creator names
    const dataWithCreators = await Promise.all(
      (data || []).map(async (comm) => {
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

    return NextResponse.json({ data: dataWithCreators });
  } catch (error) {
    console.error("Error in GET /api/lead-management/leads/[id]/communications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Valid call outcomes matching the database enum
const VALID_CALL_OUTCOMES = ["answered", "no_answer", "voicemail", "busy", "wrong_number"];

// POST - Add new communication to lead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const body = await request.json();
    const { communication_method_id, scheduled_at, notes, created_by, call_outcome } = body;

    if (!communication_method_id) {
      return NextResponse.json(
        { error: "Communication method is required" },
        { status: 400 }
      );
    }

    if (!scheduled_at) {
      return NextResponse.json(
        { error: "Date/time is required" },
        { status: 400 }
      );
    }

    // Validate call_outcome if provided
    if (call_outcome && !VALID_CALL_OUTCOMES.includes(call_outcome)) {
      return NextResponse.json(
        { error: "Invalid call outcome" },
        { status: 400 }
      );
    }

    // Verify the lead exists. The current status matters: the auto-status
    // rule must never drag a lead backwards from a stage it has progressed to.
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, status, assigned_to, full_name")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("lead_communications")
      .insert({
        lead_id: leadId,
        communication_method_id,
        scheduled_at,
        notes: notes || null,
        created_by: created_by || null,
        call_outcome: call_outcome || null,
      })
      .select(`
        *,
        communication_method:communication_methods(id, name, icon)
      `)
      .single();

    if (error) {
      console.error("Error creating communication:", error);
      return NextResponse.json(
        { error: "Failed to create communication" },
        { status: 500 }
      );
    }

    // `auto_status_contacted`: move the lead to Contacted when a communication
    // is logged — but ONLY from `not_started`. This route used to force
    // "contacted" unconditionally, which silently reversed leads that had
    // already reached qualified/negotiation/won. With the rule switched off it
    // is now genuinely inert and the status is left alone.
    //
    // If call_outcome indicates the call wasn't answered, the database trigger
    // still handles retry reminders and attempt counts.
    const automation = await getLeadAutomationSettings();
    if (isRuleActive(automation, "auto_status_contacted") && lead.status === "not_started") {
      const { error: statusError } = await supabaseAdmin
        .from("leads")
        .update({ status: "contacted", updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (statusError) {
        console.error("Failed to auto-advance lead status:", statusError);
      } else if (lead.assigned_to) {
        const actorUserId = (await resolveCallerId(request)) || created_by || null;
        const leadName = lead.full_name || "Lead";
        if (lead.assigned_to !== actorUserId) {
          await notifyLeadEvent({
            eventType: "status_changed",
            recipientId: lead.assigned_to,
            leadId,
            actorUserId,
            title: `${leadName}: Not Started → Contacted`,
            body: "Status advanced automatically after a communication was logged.",
            metadata: { previousStatus: "not_started", newStatus: "contacted", rule: "auto_status_contacted" },
            email: {
              subject: `Lead status updated: ${leadName} is now Contacted`,
              html: buildBrandedLeadEmailHtml({
                heading: leadName,
                subtitle: "Lead Status Update",
                bodyText: `${leadName} moved from Not Started to Contacted after a communication was logged.`,
              }),
            },
          });
        }
      }
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/lead-management/leads/[id]/communications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
