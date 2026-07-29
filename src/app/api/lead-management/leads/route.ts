import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendUserEmail } from "@/lib/integrations/sendUserEmail";
import { resolveLeadAssignment } from "@/lib/lead-management/leadAssignment";
import { notifyLeadEvent } from "@/lib/lead-management/leadNotifications";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Build query
    let query = supabaseAdmin
      .from("leads")
      .select(`
        *,
        source_data:lead_sources(id, name)
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    // Fetch assigned user profiles separately
    const leadsWithProfiles = await Promise.all(
      (data || []).map(async (lead) => {
        if (lead.assigned_to) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("user_id, full_name")
            .eq("user_id", lead.assigned_to)
            .single();
          return { ...lead, assigned_user: profile };
        }
        return { ...lead, assigned_user: null };
      })
    );

    return NextResponse.json({ data: leadsWithProfiles });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Resolve actor if a JWT is present (intake forms may be unauthenticated;
    // dashboard creation by a manager will be authenticated). When present,
    // the assignment notification routes through their Outlook.
    let callerId: string | null = null;
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (accessToken) {
      const { data: userInfo } = await supabaseAdmin.auth.getUser(accessToken);
      callerId = userInfo?.user?.id ?? null;
    }

    const body = await request.json();
    const { full_name, email, phone, company_name, source_id, notes, lead_type } = body;

    // Validate required fields
    if (!full_name || !email) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 }
      );
    }

    // Assignment is decided by the shared resolver so the dashboard route and
    // the public QR intake form can never drift apart. See
    // src/lib/lead-management/leadAssignment.ts for the full rule table.
    const { assignedTo, assignedAt, teamSettings } = await resolveLeadAssignment(
      supabaseAdmin,
      source_id || null
    );

    // Create the lead
    const { data: lead, error: createError } = await supabaseAdmin
      .from("leads")
      .insert({
        full_name,
        email,
        phone: phone || null,
        company_name: company_name || null,
        lead_type: lead_type === "corporate" ? "corporate" : "individual",
        source_id: source_id || null,
        source: null,
        notes: notes || null,
        status: "not_started",
        assigned_to: assignedTo,
        assigned_at: assignedAt,
      })
      .select(`
        *,
        source_data:lead_sources(id, name)
      `)
      .single();

    if (createError) throw createError;

    // Mirror the primary assignment into lead_assignments (multi-assignee table)
    if (lead.assigned_to) {
      await supabaseAdmin
        .from("lead_assignments")
        .upsert(
          {
            lead_id: lead.id,
            salesperson_id: lead.assigned_to,
            is_primary: true,
            assigned_at: assignedAt || new Date().toISOString(),
          },
          { onConflict: "lead_id,salesperson_id" }
        );
    }

    // Fetch assigned user profile if assigned
    let leadWithProfile = lead;
    if (lead.assigned_to) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .eq("user_id", lead.assigned_to)
        .single();
      leadWithProfile = { ...lead, assigned_user: profile };
    } else {
      leadWithProfile = { ...lead, assigned_user: null };
    }

    // Send enquiry confirmation email. Goes via caller's Outlook when
    // authenticated and connected, else Resend.
    try {
      const enquiryResult = await sendUserEmail(callerId, {
        to: lead.email,
        subject: `Thank You for Your Enquiry - Just Wills`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #0C5536; padding: 20px; text-align: center;">
              <h1 style="color: #C6A03B; margin: 0;">Just Wills</h1>
              <p style="color: #E6E6E4; margin: 5px 0 0 0; font-size: 12px;">Professional Will Drafting Services</p>
            </div>
            <div style="padding: 30px; background-color: #FAFAF8;">
              <h2 style="color: #0C5536; margin-top: 0;">Dear ${lead.full_name},</h2>
              <p style="color: #222222; line-height: 1.6;">
                Thank you for reaching out to <strong>Just Wills</strong>. We have received your enquiry and one of our team members will be in touch with you shortly.
              </p>
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;"><strong>Your Details:</strong></p>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 5px 0; color: #666666;">Name:</td>
                    <td style="padding: 5px 0; color: #222222;">${lead.full_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0; color: #666666;">Email:</td>
                    <td style="padding: 5px 0; color: #222222;">${lead.email}</td>
                  </tr>
                  ${lead.phone ? `<tr><td style="padding: 5px 0; color: #666666;">Phone:</td><td style="padding: 5px 0; color: #222222;">${lead.phone}</td></tr>` : ""}
                  ${lead.company_name ? `<tr><td style="padding: 5px 0; color: #666666;">Company:</td><td style="padding: 5px 0; color: #222222;">${lead.company_name}</td></tr>` : ""}
                </table>
              </div>
              <p style="color: #222222; line-height: 1.6;">
                We understand that planning for the future is important, and we're here to help make the process as smooth as possible.
              </p>
              <p style="color: #222222; line-height: 1.6;">
                If you have any urgent questions in the meantime, please don't hesitate to contact us.
              </p>
              <p style="color: #222222; line-height: 1.6; margin-top: 30px;">
                Best regards,<br/>
                <strong>The Just Wills Team</strong>
              </p>
            </div>
            <div style="background-color: #222222; padding: 15px; text-align: center;">
              <p style="color: #E6E6E4; margin: 0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Just Wills. All rights reserved.
              </p>
              <p style="color: #666666; margin: 5px 0 0 0; font-size: 11px;">
                Questions? Contact us at support@justwills.ae
              </p>
            </div>
          </div>
        `,
      });
      if (!enquiryResult.ok) {
        console.error("Failed to send enquiry confirmation email:", enquiryResult.error);
      } else {
        console.log("Enquiry confirmation email sent via", enquiryResult.provider, "to:", lead.email);
      }
    } catch (emailError) {
      // Log but don't fail the lead creation
      console.error("Failed to send enquiry confirmation email:", emailError);
    }

    // Notify the assigned salesperson. The email body below is unchanged —
    // it is now routed through notifyLeadEvent so the Notifications tab's
    // "New Lead Assigned" switch, the immediate/daily/weekly frequency and
    // the working-hours hold all apply, and so the event also lands in the
    // in-app bell. The Team tab's "Notify on Assignment" switch gates it too.
    if (assignedTo && teamSettings.notifyOnAssignment) {
      try {
        // Get salesperson profile and email
        const { data: salespersonProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("user_id", assignedTo)
          .single();

        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(assignedTo);
        const salespersonEmail = authUser?.user?.email;
        const salespersonName = salespersonProfile?.full_name || "Salesperson";

        if (salespersonEmail) {
          const sourceName = lead.source_data?.name || "Unknown Source";

          const assignedNotifyResult = await notifyLeadEvent({
            eventType: "lead_assigned",
            recipientId: assignedTo,
            leadId: lead.id,
            actorUserId: callerId,
            title: `New lead assigned: ${lead.full_name}`,
            body: lead.company_name || lead.email || null,
            metadata: { source: lead.source_data?.name || null },
            email: {
            subject: `New Lead Assigned: ${lead.full_name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #0C5536; padding: 20px; text-align: center;">
                  <h1 style="color: #C6A03B; margin: 0;">Just Wills</h1>
                  <p style="color: #E6E6E4; margin: 5px 0 0 0; font-size: 12px;">Sales Lead Notification</p>
                </div>
                <div style="padding: 30px; background-color: #FAFAF8;">
                  <h2 style="color: #0C5536; margin-top: 0;">Hello ${salespersonName},</h2>
                  <p style="color: #222222; line-height: 1.6;">
                    A new lead has been assigned to you. Please review the details below and reach out to them at your earliest convenience.
                  </p>
                  <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #0C5536;">
                    <h3 style="color: #0C5536; margin-top: 0; margin-bottom: 15px;">Lead Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #666666; width: 100px;">Name:</td>
                        <td style="padding: 8px 0; color: #222222; font-weight: bold;">${lead.full_name}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666;">Email:</td>
                        <td style="padding: 8px 0; color: #222222;">
                          <a href="mailto:${lead.email}" style="color: #0C5536;">${lead.email}</a>
                        </td>
                      </tr>
                      ${lead.phone ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666666;">Phone:</td>
                        <td style="padding: 8px 0; color: #222222;">
                          <a href="tel:${lead.phone}" style="color: #0C5536;">${lead.phone}</a>
                        </td>
                      </tr>
                      ` : ""}
                      ${lead.company_name ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666666;">Company:</td>
                        <td style="padding: 8px 0; color: #222222;">${lead.company_name}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="padding: 8px 0; color: #666666;">Source:</td>
                        <td style="padding: 8px 0; color: #222222;">${sourceName}</td>
                      </tr>
                      ${lead.notes ? `
                      <tr>
                        <td style="padding: 8px 0; color: #666666; vertical-align: top;">Notes:</td>
                        <td style="padding: 8px 0; color: #222222;">${lead.notes}</td>
                      </tr>
                      ` : ""}
                    </table>
                  </div>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/salesperson/leads"
                       style="background-color: #0C5536; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; font-weight: bold;">
                      View in Dashboard
                    </a>
                  </div>
                  <p style="color: #666666; font-size: 13px; text-align: center;">
                    Please follow up with this lead promptly to ensure the best customer experience.
                  </p>
                </div>
                <div style="background-color: #222222; padding: 15px; text-align: center;">
                  <p style="color: #E6E6E4; margin: 0; font-size: 12px;">
                    &copy; ${new Date().getFullYear()} Just Wills. All rights reserved.
                  </p>
                </div>
              </div>
            `,
            },
          });
          if (assignedNotifyResult.error) {
            console.error("Lead assignment notification issue:", assignedNotifyResult.error);
          } else {
            console.log(
              "Lead assignment notification recorded for",
              salespersonEmail,
              "email state:",
              assignedNotifyResult.emailState
            );
          }
        }
      } catch (salespersonEmailError) {
        // Log but don't fail the lead creation
        console.error("Failed to send salesperson notification email:", salespersonEmailError);
      }
    }

    return NextResponse.json({ data: leadWithProfile }, { status: 201 });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
