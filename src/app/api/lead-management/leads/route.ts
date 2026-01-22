import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

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
    const body = await request.json();
    const { full_name, email, phone, company_name, source_id, notes } = body;

    // Validate required fields
    if (!full_name || !email) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 }
      );
    }

    // Auto-assignment logic
    let assignedTo: string | null = null;
    let assignedAt: string | null = null;

    if (source_id) {
      // Get salespeople assigned to this source
      const { data: assignments, error: assignError } = await supabaseAdmin
        .from("source_salesperson_assignments")
        .select("salesperson_id")
        .eq("source_id", source_id);

      if (!assignError && assignments && assignments.length > 0) {
        const salespersonIds = assignments.map((a) => a.salesperson_id);

        if (salespersonIds.length === 1) {
          // Only one salesperson - assign directly
          assignedTo = salespersonIds[0];
        } else {
          // Multiple salespeople - round-robin by workload (least assigned leads)
          const { data: leadCounts, error: countError } = await supabaseAdmin
            .from("leads")
            .select("assigned_to")
            .in("assigned_to", salespersonIds)
            .not("assigned_to", "is", null);

          if (!countError) {
            // Count leads per salesperson
            const countMap: Record<string, number> = {};
            salespersonIds.forEach((id) => {
              countMap[id] = 0;
            });
            leadCounts?.forEach((lead) => {
              if (lead.assigned_to) {
                countMap[lead.assigned_to] = (countMap[lead.assigned_to] || 0) + 1;
              }
            });

            // Find salesperson with fewest leads
            let minCount = Infinity;
            let selectedSalesperson = salespersonIds[0];
            for (const id of salespersonIds) {
              if (countMap[id] < minCount) {
                minCount = countMap[id];
                selectedSalesperson = id;
              }
            }
            assignedTo = selectedSalesperson;
          } else {
            // If count fails, just assign to first salesperson
            assignedTo = salespersonIds[0];
          }
        }

        if (assignedTo) {
          assignedAt = new Date().toISOString();
        }
      }
    }

    // Create the lead
    const { data: lead, error: createError } = await supabaseAdmin
      .from("leads")
      .insert({
        full_name,
        email,
        phone: phone || null,
        company_name: company_name || null,
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

    // Send enquiry confirmation email
    // Note: Using Resend test account - all emails go to admin email
    const resend = new Resend(process.env.RESEND_API_KEY);
    const adminEmail = process.env.ADMIN_EMAIL || "aw736024@gmail.com";
    const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";

    const recipientEmail = adminEmail;
    const subjectPrefix = `[Original: ${lead.email}] `;

    try {
      await resend.emails.send({
        from: `Just Wills <${fromEmail}>`,
        to: recipientEmail,
        subject: `${subjectPrefix}Thank You for Your Enquiry - Just Wills`,
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
      console.log("Enquiry confirmation email sent to:", recipientEmail);
    } catch (emailError) {
      // Log but don't fail the lead creation
      console.error("Failed to send enquiry confirmation email:", emailError);
    }

    // Send notification email to assigned salesperson
    if (assignedTo) {
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

          await resend.emails.send({
            from: `Just Wills <${fromEmail}>`,
            to: adminEmail, // Always send to admin (Resend test mode limitation)
            subject: `[Original: ${salespersonEmail}] New Lead Assigned: ${lead.full_name}`,
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
          });
          console.log("Lead assignment notification sent for salesperson:", salespersonEmail);
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
