import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '../_shared/email.ts';
import { getAdminFallbackEmail } from '../_shared/accountManager.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadReminder {
  id: string;
  lead_id: string;
  salesperson_id: string;
  title: string;
  description: string | null;
  remind_at: string;
  status: 'pending' | 'triggered' | 'done' | 'dismissed';
  lead?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    company_name: string | null;
    status: string;
  };
  salesperson?: {
    full_name: string;
    email?: string;
  };
}

const TEAM_TIMEZONE = 'Asia/Dubai';

interface LeadEmailTemplate {
  id: string;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

const escHtml = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** `{{variable}}` substitution, limited to the names the template declares. */
function renderTemplateText(
  text: string,
  variables: string[],
  values: Record<string, string>
): string {
  let out = text || '';
  for (const name of variables) {
    out = out.split(`{{${name}}}`).join(values[name] ?? '');
  }
  return out;
}

/**
 * Same branded shell the app-side builder uses (green header / gold accent /
 * dark footer). Templates supply prose only, so an edited template can never
 * produce an unbranded wall of text.
 */
function buildBrandedHtml(bodyText: string, extraHtml = ''): string {
  const paragraphs = (bodyText || '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map(
      (b) =>
        `<p style="color:#222222;line-height:1.6;margin:0 0 16px 0;">${escHtml(b).replace(/\n/g, '<br/>')}</p>`
    )
    .join('');
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0C5536; padding: 20px; text-align: center;">
        <h1 style="color: #C6A03B; margin: 0;">Just Wills</h1>
        <p style="color: #E6E6E4; margin: 5px 0 0 0; font-size: 12px;">Professional Will Drafting Services</p>
      </div>
      <div style="padding: 30px; background-color: #FAFAF8;">
        ${paragraphs}
        ${extraHtml}
      </div>
      <div style="background-color: #222222; padding: 15px; text-align: center;">
        <p style="color: #E6E6E4; margin: 0; font-size: 12px;">&copy; ${new Date().getFullYear()} Just Wills. All rights reserved.</p>
        <p style="color: #666666; margin: 5px 0 0 0; font-size: 11px;">Questions? Contact us at support@justwills.ae</p>
      </div>
    </div>`;
}

function minutesOf(hhmm: string | undefined, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Working-hours window from the Team tab, evaluated in Asia/Dubai. An
 * inverted/empty window counts as "always open" so a misconfiguration can
 * never silently swallow every reminder.
 */
function isWithinWorkingHours(team: { workingHoursStart?: string; workingHoursEnd?: string }): boolean {
  const start = minutesOf(team.workingHoursStart, 0);
  const end = minutesOf(team.workingHoursEnd, 24 * 60);
  if (start >= end) return true;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TEAM_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const now = hour * 60 + minute;
  return now >= start && now < end;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function generateReminderEmailHtml(
  reminder: LeadReminder,
  salespersonName: string,
  dashboardUrl: string
): string {
  const leadName = reminder.lead?.full_name || 'Unknown Lead';
  const leadCompany = reminder.lead?.company_name ? ` (${reminder.lead.company_name})` : '';
  const leadStatus = reminder.lead?.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Lead Reminder</h1>
        <p style="color: #C6A03B; margin: 10px 0 0 0; font-weight: bold;">${reminder.title}</p>
      </div>

      <div style="background-color: white; padding: 25px; border: 1px solid #E6E6E4;">
        <p>Hi ${salespersonName},</p>
        <p>This is a reminder for your lead follow-up:</p>

        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #0C5536;">Lead Information</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 5px 0; color: #666; width: 120px;">Name:</td>
              <td style="padding: 5px 0; font-weight: bold;">${leadName}${leadCompany}</td>
            </tr>
            ${reminder.lead?.email ? `
            <tr>
              <td style="padding: 5px 0; color: #666;">Email:</td>
              <td style="padding: 5px 0;"><a href="mailto:${reminder.lead.email}" style="color: #0C5536;">${reminder.lead.email}</a></td>
            </tr>
            ` : ''}
            ${reminder.lead?.phone ? `
            <tr>
              <td style="padding: 5px 0; color: #666;">Phone:</td>
              <td style="padding: 5px 0;"><a href="tel:${reminder.lead.phone}" style="color: #0C5536;">${reminder.lead.phone}</a></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 5px 0; color: #666;">Status:</td>
              <td style="padding: 5px 0;">
                <span style="background-color: #E0F2FE; color: #0369A1; padding: 3px 10px; border-radius: 12px; font-size: 12px;">
                  ${leadStatus}
                </span>
              </td>
            </tr>
          </table>
        </div>

        <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B;">
          <p style="margin: 0 0 5px 0; font-weight: bold; color: #92400E;">Reminder Due:</p>
          <p style="margin: 0; color: #92400E;">${formatDate(reminder.remind_at)}</p>
        </div>

        ${reminder.description ? `
        <div style="margin: 20px 0;">
          <p style="margin: 0 0 5px 0; font-weight: bold; color: #333;">Notes:</p>
          <p style="margin: 0; color: #666; white-space: pre-wrap;">${reminder.description}</p>
        </div>
        ` : ''}

        <div style="text-align: center; margin: 25px 0;">
          <a href="${dashboardUrl}/admin/salesperson/leads/${reminder.lead_id}"
             style="display: inline-block; background-color: #0C5536; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px;">
            View Lead Details
          </a>
          <a href="${dashboardUrl}/admin/salesperson/leads"
             style="display: inline-block; background-color: #C6A03B; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            My Leads
          </a>
        </div>
      </div>

      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          This is an automated reminder from the Lead Management System.
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

    const now = new Date().toISOString();
    console.log(`Processing lead reminders at ${now}`);

    // Settings from the lead-management Settings page decide whether the
    // reminder EMAIL goes out, and when. The reminder itself is always
    // triggered so the in-app bell stays truthful.
    const { data: settingRows } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['lead_notifications', 'lead_team', 'lead_email_templates']);
    const settingsByKey = new Map<string, Record<string, unknown>>();
    for (const row of settingRows || []) {
      settingsByKey.set(row.setting_key, (row.setting_value ?? {}) as Record<string, unknown>);
    }
    const notificationSettings = settingsByKey.get('lead_notifications') || {};
    const teamSettings = (settingsByKey.get('lead_team') || {}) as {
      workingHoursStart?: string;
      workingHoursEnd?: string;
    };
    // The editable "Reminder Email" template. Inactive or missing => the
    // original hardcoded builder below is used, so an empty email is
    // impossible.
    const templateList = (settingsByKey.get('lead_email_templates')?.templates ||
      []) as LeadEmailTemplate[];
    const reminderTemplate = Array.isArray(templateList)
      ? templateList.find((t) => t?.id === 'reminder' && t.isActive && t.subject?.trim() && t.body?.trim())
      : undefined;

    // Missing row => defaults, and reminder emails ship enabled.
    const remindersEmailOn = notificationSettings.emailReminders !== false;
    const frequency = (notificationSettings.notificationFrequency as string) || 'immediate';

    // What happens to each reminder's email, decided once for this run:
    //   suppressed  the "Reminders Due" switch is off
    //   digest      frequency is daily/weekly — the digest cron batches it
    //   pending     immediate, but outside working hours — the flush cron
    //               sends it at the next working-hours start
    //   sent        immediate and inside working hours — sent right now
    let emailPlan: 'sent' | 'pending' | 'digest' | 'suppressed';
    if (!remindersEmailOn) emailPlan = 'suppressed';
    else if (frequency !== 'immediate') emailPlan = 'digest';
    else if (!isWithinWorkingHours(teamSettings)) emailPlan = 'pending';
    else emailPlan = 'sent';
    console.log(`Reminder email plan for this run: ${emailPlan}`);

    // Fetch all pending reminders that are due (remind_at <= now)
    const { data: reminders, error: remindersError } = await supabase
      .from('lead_reminders')
      .select(`
        id,
        lead_id,
        salesperson_id,
        title,
        description,
        remind_at,
        status,
        lead:leads(id, full_name, email, phone, company_name, status)
      `)
      .eq('status', 'pending')
      .lte('remind_at', now)
      .order('remind_at', { ascending: true });

    if (remindersError) {
      throw new Error(`Failed to fetch reminders: ${remindersError.message}`);
    }

    if (!reminders || reminders.length === 0) {
      console.log('No pending reminders to process');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending reminders', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${reminders.length} pending reminders to process`);

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = EMAIL_FROM;
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';

    // Fallback only for reminders whose salesperson has no auth email.
    const adminEmail = getAdminFallbackEmail();

    let emailsSent = 0;
    let emailsFailed = 0;
    let remindersTriggered = 0;

    // Process each reminder
    for (const reminder of reminders) {
      try {
        // Get salesperson profile
        const { data: salespersonProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', reminder.salesperson_id)
          .single();

        // Get salesperson email from auth
        const { data: authUser } = await supabase.auth.admin.getUserById(reminder.salesperson_id);

        const salespersonName = salespersonProfile?.full_name || 'Salesperson';
        const salespersonEmail = authUser?.user?.email || adminEmail;

        const leadName = reminder.lead?.full_name || 'Unknown Lead';
        // Configurable template first; hardcoded builder as the fallback.
        const templateValues: Record<string, string> = {
          lead_name: leadName,
          reminder_title: reminder.title,
          reminder_description: reminder.description || '',
          salesperson_name: salespersonName,
        };
        const dashboardCta = `
        <div style="text-align:center;margin:25px 0;">
          <a href="${appUrl}/admin/salesperson/leads/${reminder.lead_id}"
             style="display:inline-block;background-color:#0C5536;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
            View Lead Details
          </a>
        </div>`;

        const subject = reminderTemplate
          ? renderTemplateText(reminderTemplate.subject, reminderTemplate.variables, templateValues)
          : `Reminder: ${reminder.title} - ${leadName}`;
        const html = reminderTemplate
          ? buildBrandedHtml(
              renderTemplateText(reminderTemplate.body, reminderTemplate.variables, templateValues),
              dashboardCta
            )
          : generateReminderEmailHtml(reminder as LeadReminder, salespersonName, appUrl);

        let emailState: string = emailPlan;

        if (emailPlan === 'sent') {
          console.log(`Sending reminder email for lead "${leadName}" to ${salespersonEmail}`);
          const { data: emailResult, error: emailError } = await resend.emails.send({
            from: fromEmail,
            to: salespersonEmail,
            replyTo: EMAIL_REPLY_TO,
            subject: subject,
            html: html,
          });

          if (emailError) {
            console.error(`Failed to send email for reminder ${reminder.id}:`, emailError);
            // Park it so the flush cron retries rather than losing it.
            emailState = 'pending';
            emailsFailed++;
          } else {
            console.log(`Email sent successfully for reminder ${reminder.id}, Resend ID: ${emailResult?.id}`);
            emailsSent++;
          }
        } else {
          console.log(`Reminder ${reminder.id} email not sent now (state: ${emailPlan})`);
        }

        // Record the event either way: the in-app bell and the digests both
        // read this table, and a held email needs its rendered copy stored.
        const { error: eventError } = await supabase.from('lead_notification_events').insert({
          recipient_id: reminder.salesperson_id,
          lead_id: reminder.lead_id,
          event_type: 'reminder_due',
          title: `Reminder due: ${reminder.title}`,
          body: leadName,
          metadata: { reminder_id: reminder.id },
          email_state: emailState,
          email_subject: emailState === 'suppressed' ? null : subject,
          email_html: emailState === 'suppressed' ? null : html,
          email_sent_at: emailState === 'sent' ? new Date().toISOString() : null,
        });
        if (eventError) {
          console.error(`Failed to record reminder event for ${reminder.id}:`, eventError);
        }

        // Update reminder status to 'triggered' regardless of email success
        // This allows in-app notifications to show the reminder
        const { error: updateError } = await supabase
          .from('lead_reminders')
          .update({ status: 'triggered' })
          .eq('id', reminder.id);

        if (updateError) {
          console.error(`Failed to update reminder ${reminder.id} status:`, updateError);
        } else {
          remindersTriggered++;
        }

      } catch (reminderError) {
        console.error(`Error processing reminder ${reminder.id}:`, reminderError);
        emailsFailed++;
      }
    }

    console.log(`Lead reminders processing complete. Triggered: ${remindersTriggered}, Emails Sent: ${emailsSent}, Failed: ${emailsFailed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lead reminders processed',
        summary: {
          totalReminders: reminders.length,
          remindersTriggered,
          emailsSent,
          emailsFailed,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing lead reminders:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
