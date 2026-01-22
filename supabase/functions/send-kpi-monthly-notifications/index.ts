import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KPIMonthlyNotificationSettings {
  enabled: boolean;
  send_time: string;
  timezone: string;
  hr_recipient_email: string;
  hr_recipient_name: string;
  days_before_month_end: number;
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

interface IncompleteEmployee {
  employee: Employee;
  completedCount: number;
  totalCount: number;
  pendingKPIs: string[];
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
}

function generateHRMonthlyReminderHtml(
  incompleteEmployees: IncompleteEmployee[],
  year: number,
  month: number,
  daysRemaining: number,
  dashboardUrl: string
): string {
  const monthName = getMonthName(month);

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

  const urgencyColor = daysRemaining <= 3 ? '#DC2626' : '#F59E0B';
  const urgencyText = daysRemaining <= 3 ? 'Urgent' : 'Reminder';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background-color: ${urgencyColor}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Monthly KPI Review ${urgencyText}</h1>
        <p style="color: white; margin: 10px 0 0 0;">${monthName} ${year} - ${daysRemaining} days remaining</p>
      </div>

      <div style="background-color: white; padding: 25px; border: 1px solid #E6E6E4;">
        <p>Hi HR Manager,</p>
        <p>This is a reminder that <strong>${incompleteEmployees.length} employee(s)</strong> have pending KPI evaluations for <strong>${monthName} ${year}</strong>.</p>

        <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${urgencyColor};">
          <p style="margin: 0; color: #92400E;">
            <strong>${daysRemaining} days left</strong> to complete all monthly KPI evaluations.
          </p>
        </div>

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
          Please complete all KPI evaluations before the end of ${monthName}.
        </p>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${dashboardUrl}"
             style="display: inline-block; background-color: #0C5536; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            Go to KPI Dashboard
          </a>
        </div>
      </div>

      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          This is an automated monthly reminder from the HR Management System.
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

    // Get KPI monthly notification settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'hr_kpi_monthly_notifications')
      .single();

    if (settingsError) {
      console.log('No KPI monthly notification settings found, using defaults');
    }

    const settings: KPIMonthlyNotificationSettings = settingsData?.setting_value || {
      enabled: true,
      send_time: '09:00',
      timezone: 'Asia/Dubai',
      hr_recipient_email: 'aw736024@gmail.com',
      hr_recipient_name: 'HR Manager',
      days_before_month_end: 7,
    };

    if (!settings.enabled) {
      console.log('KPI monthly notifications are disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'KPI monthly notifications disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine current year and month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Calculate days remaining in the month
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
    const currentDay = now.getDate();
    const daysRemaining = lastDayOfMonth - currentDay;

    console.log(`Processing monthly KPI notifications for ${getMonthName(currentMonth)} ${currentYear}`);
    console.log(`Days remaining in month: ${daysRemaining}`);

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
    const incompleteEmployees: IncompleteEmployee[] = [];

    for (const employee of employees) {
      // Get KPI evaluations for this employee for the current month
      const { data: evaluations, error: evalError } = await supabase
        .from('kpi_evaluations')
        .select(`
          *,
          kpi:kpis(id, name, description, target_value, unit, weighting, job_role_id)
        `)
        .eq('employee_id', employee.id)
        .eq('year', currentYear)
        .eq('month', currentMonth);

      if (evalError) {
        console.error(`Failed to fetch evaluations for ${employee.full_name}:`, evalError);
        continue;
      }

      // Filter out evaluations without KPI data
      const assignedEvaluations = (evaluations || []).filter(e => e.kpi);

      if (assignedEvaluations.length === 0) {
        console.log(`No KPIs assigned to ${employee.full_name} for this month`);
        continue;
      }

      // Check completion status
      const completedEvaluations = assignedEvaluations.filter(
        (e: KPIEvaluation) => e.status === 'completed'
      );

      // If not all evaluations are completed, add to incomplete list
      if (completedEvaluations.length < assignedEvaluations.length) {
        const pendingKPIs: string[] = assignedEvaluations
          .filter((e: KPIEvaluation) => e.status !== 'completed')
          .map((e: KPIEvaluation) => e.kpi?.name || 'Unknown KPI');

        incompleteEmployees.push({
          employee: employee as Employee,
          completedCount: completedEvaluations.length,
          totalCount: assignedEvaluations.length,
          pendingKPIs,
        });
      }
    }

    // If no incomplete employees, no need to send reminder
    if (incompleteEmployees.length === 0) {
      console.log('All employees have completed their monthly KPI evaluations');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All monthly KPI evaluations complete',
          year: currentYear,
          month: currentMonth,
          monthName: getMonthName(currentMonth),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';

    // Send to admin for testing (same pattern as other edge functions)
    const adminEmail = 'aw736024@gmail.com';

    let emailsSent = 0;
    let emailsFailed = 0;

    // Send HR reminder about incomplete evaluations
    const monthName = getMonthName(currentMonth);
    const hrSubject = `${daysRemaining <= 3 ? 'URGENT: ' : ''}${incompleteEmployees.length} Pending KPI Reviews for ${monthName} ${currentYear}`;
    const hrHtml = generateHRMonthlyReminderHtml(
      incompleteEmployees,
      currentYear,
      currentMonth,
      daysRemaining,
      `${appUrl}/hr/kpis`
    );

    try {
      console.log(`Sending monthly HR reminder to ${settings.hr_recipient_email} (via ${adminEmail})`);

      if (fromEmail === 'onboarding@resend.dev') {
        console.warn('Using test email domain - email will only be sent to verified addresses');
      }

      const { data: hrEmailResult, error: hrEmailError } = await resend.emails.send({
        from: fromEmail,
        to: adminEmail, // Send to admin for testing
        subject: hrSubject,
        html: hrHtml,
      });

      if (hrEmailError) {
        console.error('Failed to send monthly HR reminder:', hrEmailError);
        emailsFailed++;

        await supabase.from('email_notification_logs').insert({
          notification_type: 'kpi_monthly_reminder',
          recipient_email: settings.hr_recipient_email,
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
          notification_type: 'kpi_monthly_reminder',
          recipient_email: settings.hr_recipient_email,
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
      console.error('Error sending monthly HR reminder:', error);
      emailsFailed++;
    }

    console.log(`Monthly KPI notifications complete. Sent: ${emailsSent}, Failed: ${emailsFailed}`);
    console.log(`Incomplete employees: ${incompleteEmployees.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Monthly KPI notifications processed',
        year: currentYear,
        month: currentMonth,
        monthName: getMonthName(currentMonth),
        daysRemaining,
        summary: {
          incompleteEmployees: incompleteEmployees.length,
          emailsSent,
          emailsFailed,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing monthly KPI notifications:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
