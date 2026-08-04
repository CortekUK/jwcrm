import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '@/config/email';

interface WarningRequest {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  issueSummary: string;
  message: string;
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

    // Create Supabase client with anon key for auth verification
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401, headers });
    }

    // Create Supabase client with service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Get Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500, headers });
    }

    const body: WarningRequest = await request.json();
    const { employeeId, employeeName, employeeEmail, issueSummary, message } = body;

    // Validate required fields
    if (!employeeId || !employeeName || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers });
    }

    // The notice goes to the employee. No fallback address.
    if (!employeeEmail || !employeeEmail.trim()) {
      return NextResponse.json({ error: 'Employee has no email address' }, { status: 400, headers });
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    console.log('Sending attendance warning to:', employeeName);

    // Send email
    const emailResult = await resend.emails.send({
      from: EMAIL_FROM,
      to: employeeEmail,
      replyTo: EMAIL_REPLY_TO,
      subject: `Attendance Notice - Action Required`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #DC2626; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Attendance Notice</h1>
          </div>

          <div style="background-color: white; padding: 30px; border: 1px solid #E6E6E4;">
            <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
              Dear ${employeeName},
            </p>

            <div style="white-space: pre-wrap; color: #374151; font-size: 14px; line-height: 1.6; margin-bottom: 25px; padding: 20px; background-color: #F9FAFB; border-radius: 8px;">
${message}
            </div>

            <div style="padding: 15px; background-color: #FEF3C7; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 20px;">
              <p style="color: #92400E; margin: 0; font-size: 14px;">
                <strong>Issue:</strong> ${issueSummary}
              </p>
            </div>

            <p style="color: #6B7280; font-size: 14px;">
              Please contact HR if you have any questions or concerns.
            </p>
          </div>

          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an official communication from the HR Department.
            </p>
          </div>
        </div>
      `,
    });

    if (emailResult.error) {
      console.error('Resend API error:', emailResult.error);
      return NextResponse.json({ error: `Failed to send email: ${emailResult.error.message}` }, { status: 500, headers });
    }

    // Log the warning in the database
    const { error: insertError } = await supabase
      .from('attendance_warnings')
      .insert({
        employee_id: employeeId,
        sent_by: user.id,
        issue_summary: issueSummary,
        message: message,
      });

    if (insertError) {
      console.error('Error logging warning:', insertError);
      // Don't fail the request - email was sent successfully
    }

    console.log('Attendance warning sent, ID:', emailResult.data?.id);

    return NextResponse.json({
      success: true,
      message: 'Warning sent successfully',
      emailId: emailResult.data?.id,
    }, { headers });
  } catch (error) {
    console.error('Error sending warning:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500, headers });
  }
}
