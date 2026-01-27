import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_email?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  created_at: string;
  current_approval_step: number;
  total_approval_steps: number;
  escalation_count: number;
  last_escalated_at: string | null;
  approval_rule_id: string | null;
}

interface ApprovalRule {
  id: string;
  leave_type: string | null;
  min_days: number;
  max_days: number | null;
  requires_manager_approval: boolean;
  requires_hr_approval: boolean;
  requires_director_approval: boolean;
  escalation_days: number;
  priority: number;
  is_active: boolean;
}

interface EscalationResult {
  request_id: string;
  employee_name: string;
  escalated_from: string;
  escalated_to: string;
  days_pending: number;
  notified: boolean;
}

function generateEscalationEmailHtml(
  request: LeaveRequest,
  escalatedFrom: string,
  daysPending: number,
  dashboardUrl: string
): string {
  const leaveTypeLabels: Record<string, string> = {
    annual: 'Annual Leave',
    sick: 'Sick Leave',
    emergency: 'Emergency Leave',
    unpaid: 'Unpaid Leave',
  };

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #DC2626; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Leave Request Escalation</h1>
        <p style="color: white; margin: 10px 0 0 0;">Requires Your Immediate Attention</p>
      </div>

      <div style="background-color: white; padding: 25px; border: 1px solid #E6E6E4;">
        <p>Hello,</p>
        <p>A leave request has been escalated to you for approval after <strong>${daysPending} days</strong> without response from the previous approver.</p>

        <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
          <p style="margin: 0; color: #92400E;">
            <strong>Action Required:</strong> Please review and approve/deny this request as soon as possible.
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Employee:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${request.employee_name}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Leave Type:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${leaveTypeLabels[request.leave_type] || request.leave_type}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Dates:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${request.start_date} to ${request.end_date}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Duration:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${request.total_days} working days</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Reason:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${request.reason || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Submitted:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${new Date(request.created_at).toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #666;"><strong>Escalated From:</strong></td>
            <td style="padding: 10px 0;">${escalatedFrom}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${dashboardUrl}"
             style="display: inline-block; background-color: #0C5536; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            Review Leave Request
          </a>
        </div>
      </div>

      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          This is an automated escalation from the HR Management System.
        </p>
      </div>
    </div>
  `;
}

function generateHRDigestHtml(
  escalations: EscalationResult[],
  dashboardUrl: string
): string {
  const rows = escalations
    .map((e) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${e.employee_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${e.escalated_from}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${e.escalated_to}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
          <span style="color: #DC2626; font-weight: bold;">${e.days_pending} days</span>
        </td>
      </tr>
    `)
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background-color: #F59E0B; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Leave Escalation Digest</h1>
        <p style="color: white; margin: 10px 0 0 0;">${escalations.length} request(s) escalated today</p>
      </div>

      <div style="background-color: white; padding: 25px; border: 1px solid #E6E6E4;">
        <p>Hi HR Team,</p>
        <p>The following leave requests have been automatically escalated due to delayed approvals:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f9f9f9;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Employee</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">From</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">To</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Pending</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${dashboardUrl}"
             style="display: inline-block; background-color: #0C5536; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            Go to Leave Management
          </a>
        </div>
      </div>

      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          This is an automated escalation digest from the HR Management System.
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

    console.log('Starting leave escalation processing...');

    // Get all active approval rules
    const { data: rules, error: rulesError } = await supabase
      .from('leave_approval_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (rulesError) {
      throw new Error(`Failed to fetch approval rules: ${rulesError.message}`);
    }

    if (!rules || rules.length === 0) {
      console.log('No active approval rules found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active approval rules', escalations: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get pending leave requests
    const { data: pendingRequests, error: requestsError } = await supabase
      .from('leave_requests')
      .select(`
        *,
        employees!inner(full_name, email, manager_id)
      `)
      .eq('status', 'pending');

    if (requestsError) {
      throw new Error(`Failed to fetch pending requests: ${requestsError.message}`);
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      console.log('No pending leave requests');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending requests', escalations: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingRequests.length} pending leave requests`);

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';
    const adminEmail = 'aw736024@gmail.com'; // For testing

    let resend: Resend | null = null;
    if (resendApiKey) {
      resend = new Resend(resendApiKey);
    } else {
      console.warn('RESEND_API_KEY not configured, emails will be skipped');
    }

    const escalations: EscalationResult[] = [];
    const now = new Date();

    for (const request of pendingRequests) {
      // Find applicable rule
      const applicableRule = rules.find((rule: ApprovalRule) => {
        const typeMatch = rule.leave_type === null || rule.leave_type === request.leave_type;
        const minMatch = request.total_days >= rule.min_days;
        const maxMatch = rule.max_days === null || request.total_days <= rule.max_days;
        return typeMatch && minMatch && maxMatch;
      });

      if (!applicableRule) {
        console.log(`No applicable rule for request ${request.id}`);
        continue;
      }

      // Calculate days pending
      const createdAt = new Date(request.created_at);
      const lastEscalatedAt = request.last_escalated_at ? new Date(request.last_escalated_at) : createdAt;
      const daysSinceLastAction = Math.floor((now.getTime() - lastEscalatedAt.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`Request ${request.id}: ${daysSinceLastAction} days since last action, escalation threshold: ${applicableRule.escalation_days}`);

      // Check if escalation is needed
      if (daysSinceLastAction < applicableRule.escalation_days) {
        continue;
      }

      // Determine escalation target
      let escalatedFrom = 'Unknown';
      let escalatedTo = 'HR';
      let targetEmail = adminEmail;

      const currentStep = request.current_approval_step || 1;
      const totalSteps = request.total_approval_steps || 1;

      if (currentStep === 1 && applicableRule.requires_manager_approval) {
        escalatedFrom = 'Manager';
        if (applicableRule.requires_hr_approval) {
          escalatedTo = 'HR';
        } else if (applicableRule.requires_director_approval) {
          escalatedTo = 'Director';
        }
      } else if (currentStep === 2 && applicableRule.requires_hr_approval) {
        escalatedFrom = 'HR';
        if (applicableRule.requires_director_approval) {
          escalatedTo = 'Director';
        }
      }

      // Get HR users for notification
      const { data: hrUsers } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(email, full_name)')
        .eq('role', 'hr');

      // Update the request
      const newStep = Math.min(currentStep + 1, totalSteps);
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({
          current_approval_step: newStep,
          escalation_count: (request.escalation_count || 0) + 1,
          last_escalated_at: now.toISOString(),
        })
        .eq('id', request.id);

      if (updateError) {
        console.error(`Failed to update request ${request.id}:`, updateError);
        continue;
      }

      // Record escalation step
      await supabase.from('leave_approval_steps').insert({
        leave_request_id: request.id,
        step_order: currentStep,
        approver_type: escalatedFrom.toLowerCase(),
        status: 'escalated',
        escalated_at: now.toISOString(),
      });

      const employeeName = request.employees?.full_name || 'Unknown Employee';
      const totalDaysPending = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      escalations.push({
        request_id: request.id,
        employee_name: employeeName,
        escalated_from: escalatedFrom,
        escalated_to: escalatedTo,
        days_pending: totalDaysPending,
        notified: false,
      });

      // Send escalation notification
      if (resend && hrUsers && hrUsers.length > 0) {
        const requestWithName = {
          ...request,
          employee_name: employeeName,
        };

        const html = generateEscalationEmailHtml(
          requestWithName,
          escalatedFrom,
          totalDaysPending,
          `${appUrl}/hr/leave`
        );

        try {
          await resend.emails.send({
            from: fromEmail,
            to: adminEmail, // Use admin for testing
            subject: `Escalation: Leave Request from ${employeeName} (${totalDaysPending} days pending)`,
            html,
          });

          // Update notification status
          escalations[escalations.length - 1].notified = true;

          // Log the notification
          await supabase.from('email_notification_logs').insert({
            notification_type: 'leave_escalation',
            recipient_email: adminEmail,
            subject: `Escalation: Leave Request from ${employeeName}`,
            status: 'sent',
            metadata: {
              request_id: request.id,
              escalated_from: escalatedFrom,
              escalated_to: escalatedTo,
              days_pending: totalDaysPending,
            },
          });
        } catch (emailError) {
          console.error('Failed to send escalation email:', emailError);
          
          await supabase.from('email_notification_logs').insert({
            notification_type: 'leave_escalation',
            recipient_email: adminEmail,
            subject: `Escalation: Leave Request from ${employeeName}`,
            status: 'failed',
            error_message: emailError instanceof Error ? emailError.message : 'Unknown error',
          });
        }
      }
    }

    // Send HR digest if there were escalations
    if (escalations.length > 0 && resend) {
      const digestHtml = generateHRDigestHtml(escalations, `${appUrl}/hr/leave`);

      try {
        await resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `Leave Escalation Digest: ${escalations.length} request(s) escalated`,
          html: digestHtml,
        });

        await supabase.from('email_notification_logs').insert({
          notification_type: 'leave_escalation_digest',
          recipient_email: adminEmail,
          subject: `Leave Escalation Digest: ${escalations.length} request(s)`,
          status: 'sent',
          metadata: { escalation_count: escalations.length },
        });
      } catch (emailError) {
        console.error('Failed to send escalation digest:', emailError);
      }
    }

    console.log(`Escalation processing complete. Escalated: ${escalations.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${pendingRequests.length} pending requests`,
        escalations: escalations.length,
        details: escalations,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing leave escalations:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
