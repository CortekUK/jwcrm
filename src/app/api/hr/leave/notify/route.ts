import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

interface LeaveNotificationRequest {
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: 'approved' | 'denied';
  denialReason?: string;
  remainingBalance?: number;
  approverName?: string;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export async function POST(request: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401, headers });
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401, headers });
    }

    // Get Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500, headers });
    }

    const body: LeaveNotificationRequest = await request.json();
    const {
      employeeName,
      employeeEmail,
      leaveType,
      startDate,
      endDate,
      totalDays,
      status,
      denialReason,
      remainingBalance,
      approverName,
    } = body;

    // Validate required fields
    if (!employeeName || !employeeEmail || !leaveType || !startDate || !endDate || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers });
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Test mode: all emails go to admin (must match Resend registered email for unverified domains)
    const adminEmail = process.env.ADMIN_EMAIL || 'aw736024@gmail.com';
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

    console.log(`Sending leave ${status} notification for:`, employeeName);

    const isApproved = status === 'approved';
    const statusColor = isApproved ? '#0C5536' : '#DC2626';
    const statusText = isApproved ? 'Approved' : 'Denied';
    const statusEmoji = isApproved ? '✅' : '❌';

    // Format leave type for display
    const leaveTypeDisplay = leaveType.charAt(0).toUpperCase() + leaveType.slice(1) + ' Leave';

    // Build email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${statusColor}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${statusEmoji} Leave Request ${statusText}</h1>
        </div>

        <div style="background-color: white; padding: 30px; border: 1px solid #E6E6E4;">
          <p style="font-size: 16px;">Dear ${employeeName},</p>

          <p style="font-size: 16px; line-height: 1.6;">
            ${isApproved
              ? 'Your leave request has been <strong style="color: #0C5536;">approved</strong>.'
              : 'Unfortunately, your leave request could not be approved.'
            }
          </p>

          <div style="background-color: ${isApproved ? '#E6F7F1' : '#FEE2E2'}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;">Type:</td>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">${leaveTypeDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Dates:</td>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">${startDate} - ${endDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Duration:</td>
                <td style="padding: 8px 0; font-weight: bold; color: #333;">${totalDays} working day${totalDays > 1 ? 's' : ''}</td>
              </tr>
              ${isApproved && remainingBalance !== undefined ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Remaining:</td>
                <td style="padding: 8px 0; font-weight: bold; color: #0C5536;">${remainingBalance} days</td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${!isApproved && denialReason ? `
          <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #92400E;">Reason for Denial:</p>
            <p style="margin: 10px 0 0 0; color: #78350F;">${denialReason}</p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            You can submit a new request for alternative dates if needed.
          </p>
          ` : ''}

          ${isApproved ? `
          <p style="color: #666; line-height: 1.6;">
            Your attendance has been automatically marked as "On Leave" for the approved dates.
            Enjoy your time off!
          </p>
          ` : ''}

          ${approverName ? `
          <p style="color: #999; font-size: 14px; margin-top: 20px;">
            ${isApproved ? 'Approved' : 'Reviewed'} by: ${approverName}
          </p>
          ` : ''}

          <p style="color: #0C5536; margin-top: 30px;"><strong>HR Department</strong></p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            This is an automated notification from the HR Management System.
          </p>
        </div>
      </div>
    `;

    // Send email to admin (test mode) with original recipient in subject
    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: adminEmail, // TEST: always admin | PROD: replace with employeeEmail
      // replyTo: employeeEmail, // Commented out for test mode
      subject: `[Original: ${employeeEmail}] ${statusEmoji} Leave Request ${statusText} - ${leaveTypeDisplay}`,
      html: emailHtml,
    });

    if (emailResult.error) {
      console.error('Resend API error:', emailResult.error);
      return NextResponse.json({ error: `Failed to send email: ${emailResult.error.message}` }, { status: 500, headers });
    }

    console.log(`Leave ${status} notification email sent, ID:`, emailResult.data?.id);

    // Log to email_notification_logs table
    try {
      await supabase.from('email_notification_logs').insert({
        notification_type: status === 'approved' ? 'leave_approval' : 'leave_denial',
        recipient_email: employeeEmail,
        subject: `Leave Request ${statusText} - ${leaveTypeDisplay}`,
        documents_included: [{
          employee_name: employeeName,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
        }],
        status: 'sent',
        resend_email_id: emailResult.data?.id,
        sent_at: new Date().toISOString(),
      });
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('Failed to log email notification:', logError);
    }

    return NextResponse.json({
      success: true,
      message: `Leave ${status} notification sent successfully`,
      emailId: emailResult.data?.id,
    }, { headers });
  } catch (error) {
    console.error('Error sending leave notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500, headers });
  }
}
