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

// ---------------------------------------------------------------------------
// Approval chain
//
// Mirrors src/lib/hr/leaveApproval.ts. `app_role` has no 'manager' and no
// 'director' member, so the three requires_* switches map onto what exists:
//   manager  -> the employee's own manager (employees.manager_id)
//   hr       -> app_role 'hr' (plus admin/superadmin, who administer everything)
//   director -> app_role 'admin'/'superadmin'
// ---------------------------------------------------------------------------

type ApproverRole = 'manager' | 'hr' | 'director';

const APPROVER_LADDER: ApproverRole[] = ['manager', 'hr', 'director'];

const ROLE_LABELS: Record<ApproverRole, string> = {
  manager: 'Manager',
  hr: 'HR',
  director: 'Director',
};

const ROLE_APP_ROLES: Record<ApproverRole, string[]> = {
  manager: [],
  hr: ['hr', 'admin', 'superadmin'],
  director: ['admin', 'superadmin'],
};

const MANAGER_FALLBACK_APP_ROLES = ['hr', 'admin', 'superadmin'];

/**
 * Same ordering as the SQL function get_applicable_approval_rule: a
 * leave-type-specific rule beats a generic one, then priority ASC. The previous
 * inline `.find()` took whatever happened to come first, which is why an
 * "unpaid" rule could lose to a generic one.
 */
function matchApprovalRule(
  rules: ApprovalRule[],
  leaveType: string,
  totalDays: number
): ApprovalRule | null {
  const candidates = rules.filter((rule) => {
    const typeMatch = rule.leave_type === null || rule.leave_type === leaveType;
    const minMatch = totalDays >= (rule.min_days ?? 1);
    const maxMatch = rule.max_days === null || totalDays <= rule.max_days;
    return typeMatch && minMatch && maxMatch;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aSpecific = a.leave_type !== null ? 0 : 1;
    const bSpecific = b.leave_type !== null ? 0 : 1;
    if (aSpecific !== bSpecific) return aSpecific - bSpecific;
    return (a.priority ?? 100) - (b.priority ?? 100);
  });

  return candidates[0];
}

function chainForRule(rule: ApprovalRule | null): ApproverRole[] {
  if (!rule) return [];
  const chain: ApproverRole[] = [];
  if (rule.requires_manager_approval) chain.push('manager');
  if (rule.requires_hr_approval) chain.push('hr');
  if (rule.requires_director_approval) chain.push('director');
  return chain;
}

interface Recipient {
  email: string;
  name: string | null;
}

/**
 * Intended recipients for an approver role.
 *
 * NOTE: emails come from `employees`, not `profiles`. The previous code did
 * `user_roles.select('user_id, profiles!inner(email, full_name)')` — `profiles`
 * has no `email` column, so that select errored, `hrUsers` came back null, and
 * the `if (resend && hrUsers && hrUsers.length > 0)` guard meant NO escalation
 * email was ever sent.
 */
async function recipientsForRole(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  role: ApproverRole,
  employeeId: string
): Promise<Recipient[]> {
  if (role === 'manager') {
    const { data: employee } = await supabase
      .from('employees')
      .select('manager_id')
      .eq('id', employeeId)
      .maybeSingle();

    if (employee?.manager_id) {
      const { data: manager } = await supabase
        .from('employees')
        .select('email, full_name')
        .eq('id', employee.manager_id)
        .maybeSingle();

      if (manager?.email) {
        return [{ email: manager.email, name: manager.full_name ?? null }];
      }
    }

    // No manager on file: fall back so an escalation is never addressed to
    // nobody.
    return await recipientsForAppRoles(supabase, MANAGER_FALLBACK_APP_ROLES);
  }

  return await recipientsForAppRoles(supabase, ROLE_APP_ROLES[role]);
}

async function recipientsForAppRoles(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  appRoles: string[]
): Promise<Recipient[]> {
  if (appRoles.length === 0) return [];

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', appRoles);

  const userIds = Array.from(
    new Set(((roleRows || []) as { user_id: string }[]).map((r) => r.user_id))
  );
  if (userIds.length === 0) return [];

  const { data: staff } = await supabase
    .from('employees')
    .select('email, full_name, user_id')
    .in('user_id', userIds);

  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const row of (staff || []) as { email: string | null; full_name: string | null }[]) {
    if (!row.email || seen.has(row.email)) continue;
    seen.add(row.email);
    out.push({ email: row.email, name: row.full_name });
  }
  return out;
}

function generateEscalationEmailHtml(
  request: LeaveRequest,
  escalatedFrom: string,
  escalatedTo: string,
  currentStep: number,
  totalSteps: number,
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
        <p>A leave request has been escalated to <strong>${escalatedTo}</strong> after <strong>${daysPending} days</strong> without a response from ${escalatedFrom}.</p>

        <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
          <p style="margin: 0; color: #92400E;">
            <strong>Action Required:</strong> Please review and approve/deny this request as soon as possible.
            The request is still <strong>pending</strong> — nothing has been decided automatically.
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
            <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Approval Step:</strong></td>
            <td style="padding: 10px 0; border-bottom: 1px solid #eee;">Awaiting ${escalatedFrom} — step ${currentStep} of ${totalSteps}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #666;"><strong>Escalated From / To:</strong></td>
            <td style="padding: 10px 0;">${escalatedFrom} &rarr; ${escalatedTo}</td>
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
      // Prefer the rule persisted on the request when it was created; fall back
      // to live matching for requests that predate the approval plan.
      const applicableRule: ApprovalRule | null = request.approval_rule_id
        ? (rules as ApprovalRule[]).find((r) => r.id === request.approval_rule_id) ??
          matchApprovalRule(rules as ApprovalRule[], request.leave_type, request.total_days)
        : matchApprovalRule(rules as ApprovalRule[], request.leave_type, request.total_days);

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

      // Determine the CURRENT step's role and who the escalation goes up to.
      //
      // Nothing is auto-decided: the request stays pending and
      // current_approval_step is NOT advanced. Escalation only widens who is
      // being asked — a human still makes the call.
      const chain = chainForRule(applicableRule);
      const effectiveChain: ApproverRole[] = chain.length > 0 ? chain : ['hr'];
      const totalSteps = request.approval_rule_id
        ? Math.max(1, request.total_approval_steps || effectiveChain.length)
        : 1;
      const currentStep = Math.min(
        Math.max(1, request.current_approval_step || 1),
        totalSteps
      );

      // Requests created before the approval plan existed have no persisted
      // rule; they are single-step and escalate as an HR step.
      const currentRole: ApproverRole = request.approval_rule_id
        ? effectiveChain[currentStep - 1] ?? 'hr'
        : 'hr';

      // Next role up: the next approver in THIS request's chain, otherwise the
      // next rung of the manager -> hr -> director ladder, otherwise the same
      // role again (already at the top).
      const nextInChain = request.approval_rule_id
        ? effectiveChain[currentStep]
        : undefined;
      const ladderIndex = APPROVER_LADDER.indexOf(currentRole);
      const escalationRole: ApproverRole =
        nextInChain ?? APPROVER_LADDER[ladderIndex + 1] ?? currentRole;

      const escalatedFrom = ROLE_LABELS[currentRole];
      const escalatedTo = ROLE_LABELS[escalationRole];

      // Who this escalation is actually for. Test-mode routing below still
      // sends everything to the admin address, with these addresses recorded in
      // the subject as [Original: ...].
      const targetRecipients = await recipientsForRole(
        supabase,
        escalationRole,
        request.employee_id
      );

      // Update the request. The step deliberately does NOT advance — only the
      // escalation bookkeeping changes, and the request stays pending.
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({
          escalation_count: (request.escalation_count || 0) + 1,
          last_escalated_at: now.toISOString(),
        })
        .eq('id', request.id)
        .eq('status', 'pending');

      if (updateError) {
        console.error(`Failed to update request ${request.id}:`, updateError);
        continue;
      }

      // No `leave_approval_steps` row is written here any more. That table has
      // UNIQUE(leave_request_id, step_order), and now that escalation no longer
      // advances the step, a second escalation — or the eventual approval — at
      // the same step would collide with it. The escalation is recorded on the
      // request (escalation_count / last_escalated_at) and in
      // email_notification_logs.metadata below.

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

      // Send escalation notification to the NEXT ROLE UP in this request's
      // chain, rather than a blanket email to everyone in HR.
      if (resend) {
        const requestWithName = {
          ...request,
          employee_name: employeeName,
        };

        const html = generateEscalationEmailHtml(
          requestWithName,
          escalatedFrom,
          escalatedTo,
          currentStep,
          totalSteps,
          totalDaysPending,
          `${appUrl}/hr/leave`
        );

        const intended = targetRecipients.map((r) => r.email).join(', ') || 'no-recipient';
        // Test-mode routing, unchanged: everything goes to the admin address,
        // with the intended recipients recorded in the subject.
        const subject =
          `[Original: ${intended}] Escalation to ${escalatedTo}: Leave Request from ${employeeName} (${totalDaysPending} days pending)`;

        try {
          await resend.emails.send({
            from: fromEmail,
            to: adminEmail, // Use admin for testing
            subject,
            html,
          });

          // Update notification status
          escalations[escalations.length - 1].notified = true;

          // Log the notification
          await supabase.from('email_notification_logs').insert({
            notification_type: 'leave_escalation',
            recipient_email: adminEmail,
            subject,
            status: 'sent',
            metadata: {
              request_id: request.id,
              escalated_from: escalatedFrom,
              escalated_to: escalatedTo,
              current_step: currentStep,
              total_steps: totalSteps,
              intended_recipients: targetRecipients.map((r) => r.email),
              days_pending: totalDaysPending,
            },
          });
        } catch (emailError) {
          console.error('Failed to send escalation email:', emailError);

          await supabase.from('email_notification_logs').insert({
            notification_type: 'leave_escalation',
            recipient_email: adminEmail,
            subject,
            status: 'failed',
            error_message: emailError instanceof Error ? emailError.message : 'Unknown error',
          });
        }
      }
    }

    // Send HR digest if there were escalations
    if (escalations.length > 0 && resend) {
      const digestHtml = generateHRDigestHtml(escalations, `${appUrl}/hr/leave`);

      // The digest has always been an HR-team summary. Recipients are unchanged
      // (admin address only, test mode); the intended HR addresses are now
      // recorded in the subject, matching the convention everywhere else.
      const digestRecipients = await recipientsForAppRoles(supabase, ['hr']);
      const digestIntended =
        digestRecipients.map((r) => r.email).join(', ') || 'no-recipient';
      const digestSubject =
        `[Original: ${digestIntended}] Leave Escalation Digest: ${escalations.length} request(s) escalated`;

      try {
        await resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: digestSubject,
          html: digestHtml,
        });

        await supabase.from('email_notification_logs').insert({
          notification_type: 'leave_escalation_digest',
          recipient_email: adminEmail,
          subject: digestSubject,
          status: 'sent',
          metadata: {
            escalation_count: escalations.length,
            intended_recipients: digestRecipients.map((r) => r.email),
          },
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
