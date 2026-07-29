import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getLeadAutomationSettings,
  resolveCallerId,
} from "@/lib/lead-management/settingsServer";
import { isRuleActive } from "@/lib/lead-management/settingsTypes";
import {
  getLeadManagerIds,
  notifyLeadEvent,
} from "@/lib/lead-management/leadNotifications";
import { buildBrandedLeadEmailHtml } from "@/lib/lead-management/leadEmailTemplates";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const prettyStatus = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Fires the "Status Changes" notification to the lead's owner, and — when the
 * `notify_manager_won` automation rule is on and the lead just moved to Won —
 * to every user holding the `lead_management` role.
 *
 * Notifications never block or roll back the update that triggered them.
 */
async function dispatchStatusChangeNotifications(params: {
  leadId: string;
  leadName: string;
  previousStatus: string | null;
  newStatus: string;
  assignedTo: string | null;
  actorUserId: string | null;
}) {
  const { leadId, leadName, previousStatus, newStatus, assignedTo, actorUserId } = params;

  try {
    const from = previousStatus ? prettyStatus(previousStatus) : "—";
    const to = prettyStatus(newStatus);
    const leadUrl = `${appUrl()}/admin/lead-management/leads/${leadId}`;

    const linkHtml = `
      <div style="text-align:center;margin:24px 0;">
        <a href="${leadUrl}" style="background-color:#0C5536;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:5px;display:inline-block;font-weight:bold;">View Lead</a>
      </div>`;

    // Owner of the lead. Skipped when the person who made the change is the
    // owner — nobody needs an email about their own click.
    if (assignedTo && assignedTo !== actorUserId) {
      await notifyLeadEvent({
        eventType: "status_changed",
        recipientId: assignedTo,
        leadId,
        actorUserId,
        title: `${leadName}: ${from} → ${to}`,
        body: `Lead status changed to ${to}.`,
        metadata: { previousStatus, newStatus },
        email: {
          subject: `Lead status updated: ${leadName} is now ${to}`,
          html: buildBrandedLeadEmailHtml({
            heading: `${leadName}`,
            subtitle: "Lead Status Update",
            bodyText: `The status of ${leadName} changed from ${from} to ${to}.`,
            extraHtml: linkHtml,
          }),
        },
      });
    }

    if (newStatus !== "won") return;

    const automation = await getLeadAutomationSettings();
    if (!isRuleActive(automation, "notify_manager_won")) return;

    const managerIds = await getLeadManagerIds();
    for (const managerId of managerIds) {
      // The owner already got the status-change mail above; don't double-send.
      if (managerId === assignedTo) continue;
      await notifyLeadEvent({
        // `deal_won`, NOT `status_changed`: this alert exists only because an
        // admin switched the `notify_manager_won` rule on, so the rule must be
        // its only gate. Filing it as a status change would let the general
        // "Status Changes" notification switch silently cancel it.
        eventType: "deal_won",
        recipientId: managerId,
        leadId,
        actorUserId,
        title: `Deal won: ${leadName}`,
        body: `${leadName} has been marked as Won.`,
        metadata: { previousStatus, newStatus, rule: "notify_manager_won" },
        email: {
          subject: `Deal won: ${leadName}`,
          html: buildBrandedLeadEmailHtml({
            heading: "A deal has been won",
            subtitle: "Lead Management Notification",
            bodyText: `${leadName} has just been marked as Won.`,
            extraHtml: linkHtml,
          }),
        },
      });
    }
  } catch (err) {
    console.error("Status-change notification failed:", err);
  }
}

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
      "source",
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

    // The previous status is needed to tell a real status CHANGE from a save
    // that happened to include the same status — resaving a lead must not
    // fire a notification.
    const { data: existingLead, error: fetchError } = await supabaseAdmin
      .from("leads")
      .select("id, status, assigned_to, full_name")
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

    // Every status change in the app funnels through this route, so this is
    // the single place the "Status Changes" notification has to live.
    const newStatus = typeof updateData.status === "string" ? updateData.status : null;
    if (newStatus && newStatus !== existingLead.status) {
      await dispatchStatusChangeNotifications({
        leadId: id,
        leadName: data.full_name || existingLead.full_name || "Lead",
        previousStatus: existingLead.status,
        newStatus,
        assignedTo: data.assigned_to || existingLead.assigned_to || null,
        actorUserId: await resolveCallerId(request),
      });
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
