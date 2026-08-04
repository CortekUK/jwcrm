import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { insertEmailNotificationLog } from '@/lib/hr/email-notification-log';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '@/config/email';

type KPIReportRequest = {
  employeeId: string;
  year: number;
  month: number;
};

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

    // Create Supabase client with anon key to verify user
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401, headers });
    }

    // Create Supabase client with service role key for database operations (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    // Get Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500, headers });
    }

    const body: KPIReportRequest = await request.json();
    const { employeeId, year, month } = body;

    // Validate required fields
    if (!employeeId || !year || !month) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers });
    }

    // Fetch employee data
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, full_name, email, job_role_id, job_role:job_roles(id, name)')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404, headers });
    }

    if (!employee.email) {
      return NextResponse.json({ error: 'Employee has no email address' }, { status: 400, headers });
    }

    if (!employee.job_role_id) {
      return NextResponse.json({ error: 'Employee has no job role assigned' }, { status: 400, headers });
    }

    // Fetch ONLY assigned KPIs (those with evaluation records) for this employee/year/month
    // Join with kpis table to get KPI details
    const { data: evaluations, error: evalError } = await supabase
      .from('kpi_evaluations')
      .select(`
        kpi_id,
        achieved_value,
        score,
        notes,
        status,
        kpi:kpis(id, name, description, target_value, unit, weighting)
      `)
      .eq('employee_id', employeeId)
      .eq('year', year)
      .eq('month', month);

    if (evalError) {
      return NextResponse.json({ error: 'Failed to fetch evaluations' }, { status: 500, headers });
    }

    // Filter out evaluations without KPI data and check if any KPIs are assigned
    const assignedEvaluations = (evaluations || []).filter(e => e.kpi);

    if (assignedEvaluations.length === 0) {
      return NextResponse.json({ error: 'No KPIs assigned to this employee for this period' }, { status: 400, headers });
    }

    // Calculate overall score
    let weightedScore = 0;
    let totalWeight = 0;

    const kpiRows = assignedEvaluations.map((evaluation) => {
      const kpi = evaluation.kpi as { id: string; name: string; description: string | null; target_value: number; unit: string; weighting: number };
      const isCompleted = evaluation.status === 'completed';

      if (evaluation.score && isCompleted) {
        weightedScore += (evaluation.score * kpi.weighting) / 100;
        totalWeight += kpi.weighting;
      }

      const scoreColor = evaluation.score
        ? evaluation.score >= 80 ? '#0C5536' : evaluation.score >= 60 ? '#C6A03B' : '#DC2626'
        : '#666';

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #E6E6E4;">${kpi.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E6E6E4; text-align: center;">${kpi.target_value} ${kpi.unit}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E6E6E4; text-align: center;">${evaluation.achieved_value ?? '-'} ${evaluation.achieved_value ? kpi.unit : ''}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E6E6E4; text-align: center;">${kpi.weighting}%</td>
          <td style="padding: 12px; border-bottom: 1px solid #E6E6E4; text-align: center; color: ${scoreColor}; font-weight: bold;">
            ${evaluation.score ? `${evaluation.score}%` : '-'}
          </td>
        </tr>
      `;
    }).join('');

    const overallScore = totalWeight > 0 ? Math.round(weightedScore * 100) / 100 : null;
    const overallColor = overallScore ? (overallScore >= 80 ? '#0C5536' : overallScore >= 60 ? '#C6A03B' : '#DC2626') : '#666';

    const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });

    // Build email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
        <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">KPI Performance Report</h1>
          <p style="color: #C6A03B; margin: 10px 0 0 0;">${monthName} ${year}</p>
        </div>

        <div style="background-color: white; padding: 30px; border: 1px solid #E6E6E4;">
          <p style="font-size: 16px;">Dear ${employee.full_name},</p>

          <p style="font-size: 16px; line-height: 1.6;">
            Here is your KPI performance report for <strong>${monthName} ${year}</strong>:
          </p>

          ${overallScore !== null ? `
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; color: #666;">Overall Weighted Score</p>
            <h2 style="margin: 10px 0; color: ${overallColor}; font-size: 36px;">${overallScore}%</h2>
          </div>
          ` : ''}

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #FAFAF8;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #E6E6E4;">KPI</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #E6E6E4;">Target</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #E6E6E4;">Achieved</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #E6E6E4;">Weight</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #E6E6E4;">Score</th>
              </tr>
            </thead>
            <tbody>
              ${kpiRows}
            </tbody>
          </table>

          <p style="color: #666; line-height: 1.6;">
            If you have any questions about your performance evaluation, please contact your manager or HR.
          </p>

          <p style="color: #0C5536; margin-top: 30px;"><strong>HR Department</strong></p>
        </div>

        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            This is an automated notification from the HR Management System.
          </p>
        </div>
      </div>
    `;

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    console.log(`Sending KPI report for ${employee.full_name} (${monthName} ${year})`);

    const emailResult = await resend.emails.send({
      from: EMAIL_FROM,
      to: employee.email,
      replyTo: EMAIL_REPLY_TO,
      subject: `KPI Performance Report - ${monthName} ${year}`,
      html: emailHtml,
    });

    if (emailResult.error) {
      console.error('Resend API error:', emailResult.error);
      return NextResponse.json({ error: `Failed to send email: ${emailResult.error.message}` }, { status: 500, headers });
    }

    console.log('KPI report email sent, ID:', emailResult.data?.id);

    // Log to email_notification_logs table
    try {
      await insertEmailNotificationLog(supabase, {
        notification_type: 'kpi_quarterly_report',
        // Record where the email ACTUALLY went.
        recipient_email: employee.email,
        subject: `KPI Performance Report - ${monthName} ${year}`,
        documents_included: assignedEvaluations.map((evaluation) => {
          const kpi = evaluation.kpi as { id: string; name: string; target_value: number; unit: string; weighting: number };
          return {
            kpi_name: kpi.name,
            target_value: kpi.target_value,
            achieved_value: evaluation.achieved_value,
            score: evaluation.score,
            weighting: kpi.weighting,
          };
        }),
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
      message: 'KPI report sent successfully',
      emailId: emailResult.data?.id,
    }, { headers });
  } catch (error) {
    console.error('Error sending KPI report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500, headers });
  }
}
