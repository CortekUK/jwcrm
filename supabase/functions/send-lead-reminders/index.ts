import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';

    // Send to admin for testing (same pattern as other edge functions)
    const adminEmail = 'aw736024@gmail.com';

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
        const subject = `Reminder: ${reminder.title} - ${leadName}`;
        const html = generateReminderEmailHtml(
          reminder as LeadReminder,
          salespersonName,
          appUrl
        );

        console.log(`Sending reminder email for lead "${leadName}" to ${salespersonEmail} (via ${adminEmail})`);

        if (fromEmail === 'onboarding@resend.dev') {
          console.warn('Using test email domain - email will only be sent to verified addresses');
        }

        // Send email (to admin for testing with Resend test account)
        const { data: emailResult, error: emailError } = await resend.emails.send({
          from: fromEmail,
          to: adminEmail, // Send to admin for testing
          subject: subject,
          html: html,
        });

        if (emailError) {
          console.error(`Failed to send email for reminder ${reminder.id}:`, emailError);
          emailsFailed++;
        } else {
          console.log(`Email sent successfully for reminder ${reminder.id}, Resend ID: ${emailResult?.id}`);
          emailsSent++;
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
