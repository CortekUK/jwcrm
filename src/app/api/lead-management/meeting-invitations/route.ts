import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  generateGoogleCalendarLink,
  generateOutlookWebLink,
  generateICSContent,
  icsToBase64,
  MeetingDetails,
} from "@/lib/calendar-links";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, title, startTime, endTime, location, description, userId } = body;

    if (!leadId || !title || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields: leadId, title, startTime, endTime" },
        { status: 400 }
      );
    }

    // Get the "Email" communication method ID
    const { data: emailMethod } = await supabaseAdmin
      .from("communication_methods")
      .select("id")
      .eq("name", "Email")
      .single();

    const emailMethodId = emailMethod?.id;

    // Get lead details
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, full_name, email, phone, company_name")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.email) {
      return NextResponse.json(
        { error: "Lead does not have an email address" },
        { status: 400 }
      );
    }

    // Prepare meeting details
    const meeting: MeetingDetails = {
      title,
      description: description || "",
      location: location || "",
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    };

    // Generate calendar links
    const googleCalendarLink = generateGoogleCalendarLink(meeting);
    const outlookWebLink = generateOutlookWebLink(meeting);
    const icsContent = generateICSContent(meeting);
    const icsBase64 = icsToBase64(icsContent);

    // Format meeting date/time for display
    const meetingDate = new Date(startTime);
    const meetingEndDate = new Date(endTime);
    const formattedDate = meetingDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedStartTime = meetingDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const formattedEndTime = meetingEndDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Calculate duration in minutes
    const durationMs = meetingEndDate.getTime() - meetingDate.getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    const durationHours = Math.floor(durationMinutes / 60);
    const durationRemainingMinutes = durationMinutes % 60;
    const formattedDuration =
      durationHours > 0
        ? `${durationHours}h ${durationRemainingMinutes > 0 ? `${durationRemainingMinutes}m` : ""}`
        : `${durationMinutes}m`;

    // Test mode: all emails go to admin with original recipient in subject
    const adminEmail = process.env.ADMIN_EMAIL || "aw736024@gmail.com";
    const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";
    const isTestMode = !process.env.PRODUCTION_EMAIL_MODE;

    const recipientEmail = isTestMode ? adminEmail : lead.email;
    const subjectPrefix = isTestMode ? `[Original: ${lead.email}] ` : "";

    // Send email with meeting invitation
    try {
      await resend.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject: `${subjectPrefix}Meeting Invitation: ${title}`,
        headers: {
          "X-Entity-Ref-ID": leadId,
        },
        attachments: [
          {
            content: icsBase64,
            filename: `meeting-${meetingDate.toISOString().split("T")[0]}.ics`,
          },
        ],
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <!-- Header: Just Wills branding -->
            <div style="background-color: #0C5536; padding: 20px; text-align: center;">
              <h1 style="color: #C6A03B; margin: 0;">Just Wills</h1>
              <p style="color: #E6E6E4; margin: 5px 0 0 0; font-size: 12px;">Professional Will Drafting Services</p>
            </div>

            <!-- Content -->
            <div style="padding: 30px; background-color: #FAFAF8;">
              <h2 style="color: #0C5536; margin-top: 0;">Dear ${lead.full_name},</h2>
              <p style="color: #222222; line-height: 1.6;">
                You have been invited to a meeting. Please find the details below.
              </p>

              <!-- Meeting Details Card -->
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0C5536; margin: 0 0 15px 0; font-size: 18px;">${title}</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666666; width: 100px;">
                      <strong>📅 Date:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #222222;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">
                      <strong>⏰ Time:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #222222;">${formattedStartTime} - ${formattedEndTime}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">
                      <strong>⏱️ Duration:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #222222;">${formattedDuration}</td>
                  </tr>
                  ${
                    location
                      ? `
                  <tr>
                    <td style="padding: 8px 0; color: #666666;">
                      <strong>📍 Location:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #222222;">${location}</td>
                  </tr>
                  `
                      : ""
                  }
                </table>
              </div>

              ${
                description
                  ? `
              <!-- Meeting Agenda Section -->
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h4 style="color: #0C5536; margin: 0 0 10px 0;">Meeting Agenda</h4>
                <p style="color: #222222; line-height: 1.6; margin: 0; white-space: pre-wrap;">${description}</p>
              </div>
              `
                  : ""
              }

              <!-- Primary: ICS Attachment -->
              <div style="background-color: #0C5536; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px; font-weight: bold;">
                  📎 Add to Your Calendar
                </p>
                <p style="margin: 0; color: #E6E6E4; font-size: 14px;">
                  Open the attached <strong>.ics file</strong> to instantly add this meeting to your calendar.
                </p>
              </div>

              <!-- Alternative: Copy Links (plain text to avoid tracking rewrite) -->
              <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 15px 0; color: #666666; font-size: 14px; text-align: center;">
                  Or copy one of these links into your browser:
                </p>

                <div style="margin-bottom: 15px;">
                  <p style="margin: 0 0 5px 0; color: #0C5536; font-size: 13px; font-weight: bold;">📆 Google Calendar:</p>
                  <div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
                    <span style="font-size: 11px; color: #333333; font-family: monospace;">${googleCalendarLink}</span>
                  </div>
                </div>

                <div>
                  <p style="margin: 0 0 5px 0; color: #0078D4; font-size: 13px; font-weight: bold;">📅 Outlook Calendar:</p>
                  <div style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
                    <span style="font-size: 11px; color: #333333; font-family: monospace;">${outlookWebLink}</span>
                  </div>
                </div>
              </div>

              <p style="color: #6B6B6B; font-size: 13px; text-align: center;">
                If you have any questions about this meeting, please don't hesitate to contact us.
              </p>
            </div>

            <!-- Footer -->
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
    } catch (emailError) {
      console.error("Error sending meeting invitation email:", emailError);
      return NextResponse.json(
        { error: "Failed to send meeting invitation email" },
        { status: 500 }
      );
    }

    // Save the meeting to lead_communications so it appears in the calendar
    if (emailMethodId) {
      const meetingNotes = [
        `Meeting: ${title}`,
        location ? `Location: ${location}` : null,
        description ? `Agenda: ${description}` : null,
      ].filter(Boolean).join("\n");

      const { error: commError } = await supabaseAdmin
        .from("lead_communications")
        .insert({
          lead_id: leadId,
          communication_method_id: emailMethodId,
          scheduled_at: startTime,
          notes: meetingNotes,
          created_by: userId || null,
        });

      if (commError) {
        console.error("Error saving meeting to calendar:", commError);
        // Don't fail the request - email was sent successfully
      }
    }

    return NextResponse.json({
      success: true,
      message: "Meeting invitation sent successfully",
      testMode: isTestMode,
      sentTo: recipientEmail,
    });
  } catch (error) {
    console.error("Error in POST /api/lead-management/meeting-invitations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
