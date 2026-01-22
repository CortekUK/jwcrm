import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

interface AttendanceSummaryRequest {
  date: string;
  hrEmail: string;
}

interface AttendanceRecord {
  status: string;
  employee_id: string;
  employees: {
    full_name: string;
  };
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

    // Create Supabase client with service role key to bypass RLS for data queries
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Get Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500, headers });
    }

    const body: AttendanceSummaryRequest = await request.json();
    const { date, hrEmail } = body;

    // Validate required fields
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400, headers });
    }

    // Fetch attendance data for the date
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select(`
        status,
        employee_id,
        employees(full_name)
      `)
      .eq('date', date);

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError);
      return NextResponse.json({ error: 'Failed to fetch attendance data' }, { status: 500, headers });
    }

    // Get total active employees count
    const { count: totalEmployees } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('employment_status', 'active');

    // Calculate counts by status
    const counts: Record<string, number> = {
      present: 0,
      late: 0,
      wfh: 0,
      on_leave: 0,
      sick_leave: 0,
      absent: 0,
    };

    const absentEmployees: string[] = [];

    (attendanceData || []).forEach((record: any) => {
      if (record.status in counts) {
        counts[record.status]++;
      }
      if (record.status === 'absent') {
        absentEmployees.push(record.employees?.full_name || 'Unknown');
      }
    });

    // Calculate attendance rate
    const total = totalEmployees || 0;
    const attendanceRate = total > 0
      ? Math.round(((counts.present + counts.late + counts.wfh) / total) * 100)
      : 0;

    // Determine rate color
    const rateColor = attendanceRate >= 85 ? '#22C55E' : attendanceRate >= 70 ? '#EAB308' : '#EF4444';

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Test mode: all emails go to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'aw736024@gmail.com';
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

    const formattedDate = format(new Date(date), 'EEEE, MMMM d, yyyy');

    console.log('Sending attendance summary for:', date);

    // Status labels and colors for email
    const statusConfig: Record<string, { label: string; color: string }> = {
      present: { label: 'Present', color: '#22C55E' },
      late: { label: 'Late', color: '#F97316' },
      wfh: { label: 'WFH', color: '#3B82F6' },
      on_leave: { label: 'On Leave', color: '#A855F7' },
      sick_leave: { label: 'Sick Leave', color: '#EAB308' },
      absent: { label: 'Absent', color: '#EF4444' },
    };

    // Generate status rows for email
    const statusRows = Object.entries(counts)
      .map(([status, count]) => {
        const config = statusConfig[status];
        return `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB;">
              <span style="display: inline-block; width: 12px; height: 12px; background-color: ${config.color}; border-radius: 50%; margin-right: 8px;"></span>
              ${config.label}
            </td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: 600;">
              ${count}
            </td>
          </tr>
        `;
      })
      .join('');

    // Absent employees list
    const absentList = absentEmployees.length > 0
      ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #FEE2E2; border-radius: 8px; border-left: 4px solid #EF4444;">
          <h3 style="color: #DC2626; margin: 0 0 10px 0; font-size: 14px;">Absent Employees (${absentEmployees.length})</h3>
          <ul style="margin: 0; padding-left: 20px; color: #7F1D1D;">
            ${absentEmployees.map(name => `<li>${name}</li>`).join('')}
          </ul>
        </div>
      `
      : '';

    // Send email
    const emailResult = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      // replyTo: hrEmail, // Disabled in test mode - enable in production
      subject: `[Original: ${hrEmail}] Attendance Summary - ${formattedDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Attendance Summary</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0;">${formattedDate}</p>
          </div>

          <div style="background-color: white; padding: 30px; border: 1px solid #E6E6E4;">
            <!-- Attendance Rate -->
            <div style="text-align: center; margin-bottom: 25px; padding: 20px; background-color: #F9FAFB; border-radius: 8px;">
              <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 14px;">Attendance Rate</p>
              <p style="margin: 0; font-size: 48px; font-weight: bold; color: ${rateColor};">${attendanceRate}%</p>
              <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 12px;">
                ${counts.present + counts.late + counts.wfh} of ${total} employees present/working
              </p>
            </div>

            <!-- Status Breakdown -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #F3F4F6;">
                  <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #374151;">Status</th>
                  <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #374151;">Count</th>
                </tr>
              </thead>
              <tbody>
                ${statusRows}
              </tbody>
              <tfoot>
                <tr style="background-color: #F9FAFB;">
                  <td style="padding: 10px 12px; font-weight: 600;">Total Marked</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 600;">${attendanceData?.length || 0}</td>
                </tr>
              </tfoot>
            </table>

            ${absentList}
          </div>

          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an automated email from the HR Management System.
            </p>
          </div>
        </div>
      `,
    });

    if (emailResult.error) {
      console.error('Resend API error:', emailResult.error);
      return NextResponse.json({ error: `Failed to send email: ${emailResult.error.message}` }, { status: 500, headers });
    }

    console.log('Attendance summary email sent, ID:', emailResult.data?.id);

    return NextResponse.json({
      success: true,
      message: 'Attendance summary email sent successfully',
      emailId: emailResult.data?.id,
    }, { headers });
  } catch (error) {
    console.error('Error sending attendance summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500, headers });
  }
}
