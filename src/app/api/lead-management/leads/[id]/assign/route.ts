import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { salesperson_id } = body;

    if (!salesperson_id) {
      return NextResponse.json(
        { error: "Salesperson ID is required" },
        { status: 400 }
      );
    }

    // Get the lead to check its source
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("source_id")
      .eq("id", id)
      .single();

    if (leadError) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Validate that the new salesperson is assigned to the same source
    if (lead.source_id) {
      const { data: assignment, error: assignError } = await supabaseAdmin
        .from("source_salesperson_assignments")
        .select("id")
        .eq("source_id", lead.source_id)
        .eq("salesperson_id", salesperson_id)
        .single();

      if (assignError || !assignment) {
        return NextResponse.json(
          { error: "Selected salesperson is not assigned to this lead's source" },
          { status: 400 }
        );
      }
    }

    // Update the lead assignment
    const { data: updatedLead, error: updateError } = await supabaseAdmin
      .from("leads")
      .update({
        assigned_to: salesperson_id,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        source_data:lead_sources(id, name)
      `)
      .single();

    if (updateError) throw updateError;

    // Fetch assigned user profile
    let leadWithProfile = updatedLead;
    if (updatedLead.assigned_to) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .eq("user_id", updatedLead.assigned_to)
        .single();
      leadWithProfile = { ...updatedLead, assigned_user: profile };
    } else {
      leadWithProfile = { ...updatedLead, assigned_user: null };
    }

    // Send notification email to the new salesperson
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const adminEmail = process.env.ADMIN_EMAIL || "aw736024@gmail.com";
      const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";

      // Get salesperson profile and email
      const { data: salespersonProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("user_id", salesperson_id)
        .single();

      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(salesperson_id);
      const salespersonEmail = authUser?.user?.email;
      const salespersonName = salespersonProfile?.full_name || "Salesperson";

      if (salespersonEmail) {
        const sourceName = updatedLead.source_data?.name || "Unknown Source";

        await resend.emails.send({
          from: `Just Wills <${fromEmail}>`,
          to: adminEmail, // Always send to admin (Resend test mode limitation)
          subject: `[Original: ${salespersonEmail}] Lead Reassigned to You: ${updatedLead.full_name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #0C5536; padding: 20px; text-align: center;">
                <h1 style="color: #C6A03B; margin: 0;">Just Wills</h1>
                <p style="color: #E6E6E4; margin: 5px 0 0 0; font-size: 12px;">Sales Lead Notification</p>
              </div>
              <div style="padding: 30px; background-color: #FAFAF8;">
                <h2 style="color: #0C5536; margin-top: 0;">Hello ${salespersonName},</h2>
                <p style="color: #222222; line-height: 1.6;">
                  A lead has been <strong>reassigned</strong> to you. Please review the details below and follow up at your earliest convenience.
                </p>
                <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #C6A03B;">
                  <h3 style="color: #0C5536; margin-top: 0; margin-bottom: 15px;">Lead Details</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #666666; width: 100px;">Name:</td>
                      <td style="padding: 8px 0; color: #222222; font-weight: bold;">${updatedLead.full_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666666;">Email:</td>
                      <td style="padding: 8px 0; color: #222222;">
                        <a href="mailto:${updatedLead.email}" style="color: #0C5536;">${updatedLead.email}</a>
                      </td>
                    </tr>
                    ${updatedLead.phone ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666666;">Phone:</td>
                      <td style="padding: 8px 0; color: #222222;">
                        <a href="tel:${updatedLead.phone}" style="color: #0C5536;">${updatedLead.phone}</a>
                      </td>
                    </tr>
                    ` : ""}
                    ${updatedLead.company_name ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666666;">Company:</td>
                      <td style="padding: 8px 0; color: #222222;">${updatedLead.company_name}</td>
                    </tr>
                    ` : ""}
                    <tr>
                      <td style="padding: 8px 0; color: #666666;">Source:</td>
                      <td style="padding: 8px 0; color: #222222;">${sourceName}</td>
                    </tr>
                    ${updatedLead.notes ? `
                    <tr>
                      <td style="padding: 8px 0; color: #666666; vertical-align: top;">Notes:</td>
                      <td style="padding: 8px 0; color: #222222;">${updatedLead.notes}</td>
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
        });
        console.log("Lead reassignment notification sent for salesperson:", salespersonEmail);
      }
    } catch (emailError) {
      // Log but don't fail the reassignment
      console.error("Failed to send salesperson notification email:", emailError);
    }

    return NextResponse.json({ data: leadWithProfile });
  } catch (error) {
    console.error("Error assigning lead:", error);
    return NextResponse.json(
      { error: "Failed to assign lead" },
      { status: 500 }
    );
  }
}
