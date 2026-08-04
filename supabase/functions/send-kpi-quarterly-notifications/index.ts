import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KPINotificationSettings {
  enabled: boolean;
  send_time: string;
  timezone: string;
  hr_recipient_email: string;
  hr_recipient_name: string;
  days_before_quarter_end: number;
  send_employee_reports: boolean;
}

interface Employee {
  id: string;
  full_name: string;
  email: string | null;
  job_role_id: string;
  job_role: {
    id: string;
    name: string;
  };
}

interface KPI {
  id: string;
  name: string;
  description: string | null;
  target_value: number;
  unit: string;
  weighting: number;
  job_role_id: string;
}

interface KPIEvaluation {
  id: string;
  employee_id: string;
  kpi_id: string;
  year: number;
  month: number;
  achieved_value: number | null;
  score: number | null;
  notes: string | null;
  status: 'pending' | 'completed';
  kpi?: KPI;
}

interface EmployeeReport {
  employee: Employee;
  evaluations: KPIEvaluation[];
  overallScore: number;
}

interface IncompleteEmployee {
  employee: Employee;
  completedCount: number;
  totalCount: number;
  pendingKPIs: string[];
}

function getQuarterFromMonth(month: number): number {
  return Math.ceil(month / 3);
}

function getQuarterMonths(quarter: number): number[] {
  const startMonth = (quarter - 1) * 3 + 1;
  return [startMonth, startMonth + 1, startMonth + 2];
}

function generateEmployeeReportHtml(
  report: EmployeeReport,
  year: number,
  quarter: number
): string {
  const kpiRows = report.evaluations
    .map((evaluation) => {
      const kpi = evaluation.kpi;
      const score = evaluation.score || 0;
      const statusColor = score >= 80 ? '#22C55E' : score >= 60 ? '#F59E0B' : '#EF4444';

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${kpi?.name || 'Unknown KPI'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${evaluation.achieved_value || 0} ${kpi?.unit || ''}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${kpi?.target_value || 0} ${kpi?.unit || ''}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${kpi?.weighting || 0}%</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
            <span style="color: ${statusColor}; font-weight: bold;">${score.toFixed(1)}%</span>
          </td>
        </tr>
      `;
    })
    .join('');

  const overallColor = report.overallScore >= 80 ? '#22C55E' : report.overallScore >= 60 ? '#F59E0B' : '#EF4444';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
      <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">KPI Performance Report</h1>
        <p style="color: #C6A03B; margin: 10px 0 0 0;">Q${quarter} ${year}</p>
      </div>

      <div style="background-color: white; padding: 25px; border: 1px solid #E6E6E4;">
        <p>Hi ${report.employee.full_name},</p>
        <p>Here is your KPI performance report for <strong>Q${quarter} ${year}</strong>:</p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; color: #666;">Overall Weighted Score</p>
          <h2 style="margin: 10px 0; color: ${overallColor}; font-size: 36px;">${report.overallScore.toFixed(1)}%</h2>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f9f9f9;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">KPI</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Achieved</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Target</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Weight</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Score</th>
            </tr>
          </thead>
          <tbody>
            ${kpiRows}
          </tbody>
        </table>

        <p style="color: #666; font-size: 14px;">
          Job Role: <strong>${report.employee.job_role?.name || 'Not Assigned'}</strong>
        </p>
      </div>

      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          This is an automated report from the HR Management System.
        </p>
      </div>
    </div>
  `;
}

function generateHRReminderHtml(
  incompleteEmployees: IncompleteEmployee[],
  year: number,
  quarter: number,
  dashboardUrl: string
): string {
  const employeeRows = incompleteEmployees
    .map((item) => {
      const pendingList = item.pendingKPIs.slice(0, 3).join(', ') + (item.pendingKPIs.length > 3 ? '...' : '');
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.employee.full_name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.employee.job_role?.name || 'N/A'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
            <span style="color: #F59E0B; font-weight: bold;">${item.completedCount}/${item.totalCount}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; font-size: 12px; color: #666;">${pendingList}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background-color: #F59E0B; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">KPI Evaluations Reminder</h1>
        <p style="color: white; margin: 10px 0 0 0;">Q${quarter} ${year} - Action Required</p>
      </div>

      <div style="background-color: white; padding: 25px; border: 1px solid #E6E6E4;">
        <p>Hi HR Manager,</p>
        <p>The following <strong>${incompleteEmployees.length} employee(s)</strong> have incomplete KPI evaluations for <strong>Q${quarter} ${year}</strong>:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f9f9f9;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Employee</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Job Role</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Progress</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Pending KPIs</th>
            </tr>
          </thead>
          <tbody>
            ${employeeRows}
          </tbody>
        </table>

        <p style="color: #DC2626; font-weight: bold;">
          Please complete all KPI evaluations before the end of the quarter.
        </p>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${dashboardUrl}"
             style="display: inline-block; background-color: #0C5536; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            Go to HR Dashboard
          </a>
        </div>
      </div>

      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          This is an automated reminder from the HR Management System.
        </p>
      </div>
    </div>
  `;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for full access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get KPI notification settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'hr_kpi_notifications')
      .single();

    if (settingsError) {
      console.log('No KPI notification settings found, using defaults');
    }

    const settings: KPINotificationSettings = settingsData?.setting_value || {
      enabled: true,
      send_time: '09:00',
      timezone: 'Asia/Dubai',
      hr_recipient_email: '',
      hr_recipient_name: 'HR Manager',
      days_before_quarter_end: 7,
      send_employee_reports: true,
    };

    if (!settings.enabled) {
      console.log('KPI notifications are disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'KPI notifications disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine current year and quarter
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentQuarter = getQuarterFromMonth(currentMonth);
    const quarterMonths = getQuarterMonths(currentQuarter);

    console.log(`Processing KPI notifications for Q${currentQuarter} ${currentYear} (months: ${quarterMonths.join(', ')})`);

    // Fetch all active employees with job roles
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select(`
        id,
        full_name,
        email,
        job_role_id,
        job_role:job_roles(id, name)
      `)
      .eq('employment_status', 'active')
      .not('job_role_id', 'is', null);

    if (employeesError) {
      throw new Error(`Failed to fetch employees: ${employeesError.message}`);
    }

    if (!employees || employees.length === 0) {
      console.log('No active employees with job roles found');
      return new Response(
        JSON.stringify({ success: true, message: 'No employees to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each employee
    const completedReports: EmployeeReport[] = [];
    const incompleteEmployees: IncompleteEmployee[] = [];

    for (const employee of employees) {
      // Get ONLY ASSIGNED KPIs (those with evaluation records) for this employee for the current quarter
      // This ensures we only include KPIs that HR manually assigned to this employee
      const { data: evaluations, error: evalError } = await supabase
        .from('kpi_evaluations')
        .select(`
          *,
          kpi:kpis(id, name, description, target_value, unit, weighting, job_role_id)
        `)
        .eq('employee_id', employee.id)
        .eq('year', currentYear)
        .in('month', quarterMonths);

      if (evalError) {
        console.error(`Failed to fetch evaluations for ${employee.full_name}:`, evalError);
        continue;
      }

      // Filter out evaluations without KPI data
      const assignedEvaluations = (evaluations || []).filter(e => e.kpi);

      if (assignedEvaluations.length === 0) {
        console.log(`No KPIs assigned to ${employee.full_name}`);
        continue;
      }

      // Get unique assigned KPI IDs
      const assignedKPIIds = [...new Set(assignedEvaluations.map(e => e.kpi_id))];
      const expectedEvaluations = assignedKPIIds.length * quarterMonths.length;

      // Check completion status
      const completedEvaluations = assignedEvaluations.filter(
        (e: KPIEvaluation) => e.status === 'completed'
      );

      if (completedEvaluations.length >= expectedEvaluations) {
        // All evaluations completed - calculate overall weighted score
        // Group by KPI and average the monthly scores, then apply weighting
        const kpiScores: Record<string, { scores: number[], weighting: number }> = {};

        completedEvaluations.forEach((evaluation: KPIEvaluation) => {
          const kpiId = evaluation.kpi_id;
          if (!kpiScores[kpiId]) {
            kpiScores[kpiId] = {
              scores: [],
              weighting: evaluation.kpi?.weighting || 0
            };
          }
          kpiScores[kpiId].scores.push(evaluation.score || 0);
        });

        let overallScore = 0;
        Object.values(kpiScores).forEach((kpiData) => {
          const avgScore = kpiData.scores.reduce((a, b) => a + b, 0) / kpiData.scores.length;
          overallScore += (avgScore * kpiData.weighting) / 100;
        });

        completedReports.push({
          employee: employee as Employee,
          evaluations: completedEvaluations,
          overallScore,
        });
      } else {
        // Some evaluations pending - only for ASSIGNED KPIs
        const completedKPIMonths = new Set(
          completedEvaluations.map((e: KPIEvaluation) => `${e.kpi_id}-${e.month}`)
        );

        const pendingKPIs: string[] = [];
        // Get unique KPIs from assigned evaluations
        const uniqueKPIs = new Map<string, KPI>();
        assignedEvaluations.forEach((e: KPIEvaluation) => {
          if (e.kpi && !uniqueKPIs.has(e.kpi_id)) {
            uniqueKPIs.set(e.kpi_id, e.kpi);
          }
        });

        uniqueKPIs.forEach((kpi, kpiId) => {
          quarterMonths.forEach((month) => {
            if (!completedKPIMonths.has(`${kpiId}-${month}`)) {
              const monthName = new Date(currentYear, month - 1, 1).toLocaleString('en', { month: 'short' });
              pendingKPIs.push(`${kpi.name} (${monthName})`);
            }
          });
        });

        incompleteEmployees.push({
          employee: employee as Employee,
          completedCount: completedEvaluations.length,
          totalCount: expectedEvaluations,
          pendingKPIs,
        });
      }
    }

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = EMAIL_FROM;
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';

    // The HR recipient is configured on the HR settings page.
    const hrRecipientEmail = (settings.hr_recipient_email || '').trim();

    let emailsSent = 0;
    let emailsFailed = 0;

    // Send completed reports to each employee's own address
    if (settings.send_employee_reports) {
      for (const report of completedReports) {
        // The employee's own address. Without one there is nobody to send to.
        const actualRecipient = (report.employee.email || '').trim();
        if (!actualRecipient) {
          console.warn(`Skipping KPI report for ${report.employee.full_name}: no email address`);
          emailsFailed++;
          continue;
        }
        const subject = `Your Q${currentQuarter} ${currentYear} KPI Performance Report`;
        const html = generateEmployeeReportHtml(report, currentYear, currentQuarter);

        try {
          console.log(`Sending KPI report to ${actualRecipient}`);

          const { data: emailResult, error: emailError } = await resend.emails.send({
            from: fromEmail,
            to: actualRecipient,
            replyTo: EMAIL_REPLY_TO,
            subject: subject,
            html: html,
          });

          if (emailError) {
            console.error(`Failed to send report to ${actualRecipient}:`, emailError);
            emailsFailed++;

            await supabase.from('email_notification_logs').insert({
              notification_type: 'kpi_quarterly_report',
              recipient_email: actualRecipient,
              subject: subject,
              documents_included: report.evaluations.map((e) => ({
                kpi_name: e.kpi?.name,
                achieved_value: e.achieved_value,
                target_value: e.kpi?.target_value,
                score: e.score,
                weighting: e.kpi?.weighting,
              })),
              status: 'failed',
              error_message: emailError.message,
            });
          } else {
            emailsSent++;

            await supabase.from('email_notification_logs').insert({
              notification_type: 'kpi_quarterly_report',
              recipient_email: actualRecipient,
              subject: subject,
              documents_included: report.evaluations.map((e) => ({
                kpi_name: e.kpi?.name,
                achieved_value: e.achieved_value,
                target_value: e.kpi?.target_value,
                score: e.score,
                weighting: e.kpi?.weighting,
              })),
              status: 'sent',
              resend_email_id: emailResult?.id,
            });
          }
        } catch (error) {
          console.error(`Error sending report to ${actualRecipient}:`, error);
          emailsFailed++;
        }
      }
    }

    // Send HR reminder about incomplete evaluations
    if (incompleteEmployees.length > 0) {
      const hrSubject = `Action Required: ${incompleteEmployees.length} Incomplete KPI Evaluations for Q${currentQuarter} ${currentYear}`;
      const hrHtml = generateHRReminderHtml(
        incompleteEmployees,
        currentYear,
        currentQuarter,
        `${appUrl}/hr/kpis`
      );

      if (!hrRecipientEmail) {
        console.warn('hr_kpi_notifications.hr_recipient_email is not configured; skipping HR reminder');
      } else {
      try {
        console.log(`Sending HR reminder to ${hrRecipientEmail}`);

        const { data: hrEmailResult, error: hrEmailError } = await resend.emails.send({
          from: fromEmail,
          to: hrRecipientEmail,
          replyTo: EMAIL_REPLY_TO,
          subject: hrSubject,
          html: hrHtml,
        });

        if (hrEmailError) {
          console.error('Failed to send HR reminder:', hrEmailError);
          emailsFailed++;

          await supabase.from('email_notification_logs').insert({
            notification_type: 'kpi_incomplete_reminder',
            recipient_email: hrRecipientEmail,
            subject: hrSubject,
            documents_included: incompleteEmployees.map((item) => ({
              employee_name: item.employee.full_name,
              completed: item.completedCount,
              total: item.totalCount,
              pending_kpis: item.pendingKPIs,
            })),
            status: 'failed',
            error_message: hrEmailError.message,
          });
        } else {
          emailsSent++;

          await supabase.from('email_notification_logs').insert({
            notification_type: 'kpi_incomplete_reminder',
            recipient_email: hrRecipientEmail,
            subject: hrSubject,
            documents_included: incompleteEmployees.map((item) => ({
              employee_name: item.employee.full_name,
              completed: item.completedCount,
              total: item.totalCount,
              pending_kpis: item.pendingKPIs,
            })),
            status: 'sent',
            resend_email_id: hrEmailResult?.id,
          });
        }
      } catch (error) {
        console.error('Error sending HR reminder:', error);
        emailsFailed++;
      }
      }
    }

    console.log(`KPI notifications complete. Sent: ${emailsSent}, Failed: ${emailsFailed}`);
    console.log(`Completed reports: ${completedReports.length}, Incomplete employees: ${incompleteEmployees.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'KPI notifications processed',
        year: currentYear,
        quarter: currentQuarter,
        summary: {
          completedReports: completedReports.length,
          incompleteEmployees: incompleteEmployees.length,
          emailsSent,
          emailsFailed,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing KPI notifications:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
