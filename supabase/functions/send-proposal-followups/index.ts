import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Proposal {
  id: string;
  lead_id: string;
  amount: number;
  currency: string;
  invoice_number: string;
  stripe_payment_link: string;
  sent_at: string;
  lead?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    company_name: string | null;
  };
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

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

/** The house branded shell — templates supply prose only. */
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

function generateFollowupEmailHtml(
  proposal: Proposal,
  leadName: string,
  leadEmail: string,
  formattedAmount: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0C5536; padding: 20px; text-align: center;">
        <h1 style="color: #C6A03B; margin: 0;">Just Wills</h1>
        <p style="color: #E6E6E4; margin: 5px 0 0 0; font-size: 12px;">Professional Will Drafting Services</p>
      </div>

      <div style="padding: 30px; background-color: #FAFAF8;">
        <h2 style="color: #0C5536; margin-top: 0;">Dear ${leadName},</h2>

        <p style="color: #222222; line-height: 1.6;">
          We noticed you haven't had a chance to complete your payment yet. We wanted to send you a friendly reminder about your proposal.
        </p>

        <p style="color: #222222; line-height: 1.6;">
          Securing your will is an important step in protecting your loved ones, and we're here to make that process as smooth as possible.
        </p>

        <div style="background-color: #ffffff; border: 1px solid #E6E6E4; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666666;">Invoice Number:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #222222;">${proposal.invoice_number}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666666;">Amount Due:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0C5536; font-size: 18px;">${formattedAmount}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${proposal.stripe_payment_link}" style="background-color: #0C5536; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px; font-weight: bold;">
            Complete Payment
          </a>
        </div>

        <p style="color: #6B6B6B; font-size: 13px; text-align: center;">
          Click the button above to securely complete your payment via Stripe.
        </p>

        <div style="background-color: #FFF8E7; border: 1px solid #C6A03B; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #8B6914; font-size: 14px;">
            <strong>Questions?</strong> If you have any questions about your proposal or need assistance, please don't hesitate to reach out to us at support@justwills.ae
          </p>
        </div>
      </div>

      <div style="background-color: #222222; padding: 15px; text-align: center;">
        <p style="color: #E6E6E4; margin: 0; font-size: 12px;">
          &copy; ${new Date().getFullYear()} Just Wills. All rights reserved.
        </p>
        <p style="color: #666666; margin: 5px 0 0 0; font-size: 11px;">
          Questions? Contact us at support@justwills.ae
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

    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();

    console.log(`Processing proposal follow-ups at ${now.toISOString()}`);
    console.log(`Looking for proposals sent before ${sixHoursAgo}`);

    // Fetch all sent proposals that are 6+ hours old and haven't received a follow-up
    const { data: proposals, error: proposalsError } = await supabase
      .from('proposals')
      .select(`
        id,
        lead_id,
        amount,
        currency,
        invoice_number,
        stripe_payment_link,
        sent_at,
        lead:leads(id, full_name, email, phone, company_name)
      `)
      .eq('status', 'sent')
      .is('followup_sent_at', null)
      .not('stripe_payment_link', 'is', null)
      .lte('sent_at', sixHoursAgo)
      .order('sent_at', { ascending: true });

    if (proposalsError) {
      throw new Error(`Failed to fetch proposals: ${proposalsError.message}`);
    }

    if (!proposals || proposals.length === 0) {
      console.log('No proposals needing follow-up');
      return new Response(
        JSON.stringify({ success: true, message: 'No proposals needing follow-up', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${proposals.length} proposals needing follow-up`);

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';

    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'aw736024@gmail.com';
    const isTestMode = !Deno.env.get('PRODUCTION_EMAIL_MODE');

    // The editable "Follow-up Email" template from the Settings page. This is
    // the follow-up chaser the template describes; inactive or missing means
    // the original hardcoded builder is used, so no empty email can go out.
    const { data: templateRow } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'lead_email_templates')
      .maybeSingle();
    const templateList = (templateRow?.setting_value?.templates || []) as LeadEmailTemplate[];
    const followupTemplate = Array.isArray(templateList)
      ? templateList.find(
          (t) => t?.id === 'followup' && t.isActive && t.subject?.trim() && t.body?.trim()
        )
      : undefined;

    let emailsSent = 0;
    let emailsFailed = 0;
    let followupsUpdated = 0;

    // Process each proposal
    for (const proposal of proposals) {
      try {
        const leadName = proposal.lead?.full_name || 'Valued Customer';
        const leadEmail = proposal.lead?.email || 'unknown@email.com';
        const formattedAmount = formatCurrency(proposal.amount, proposal.currency);

        const paymentCta = `
        <div style="background-color:#ffffff;border:1px solid #E6E6E4;border-radius:8px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#666666;">Invoice Number:</td>
              <td style="padding:8px 0;text-align:right;font-weight:bold;color:#222222;">${proposal.invoice_number}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666666;">Amount Due:</td>
              <td style="padding:8px 0;text-align:right;font-weight:bold;color:#0C5536;font-size:18px;">${formattedAmount}</td>
            </tr>
          </table>
        </div>
        <div style="text-align:center;margin:30px 0;">
          <a href="${proposal.stripe_payment_link}" style="background-color:#0C5536;color:#ffffff;padding:15px 40px;text-decoration:none;border-radius:5px;display:inline-block;font-size:16px;font-weight:bold;">Complete Payment</a>
        </div>`;

        const baseSubject = followupTemplate
          ? renderTemplateText(followupTemplate.subject, followupTemplate.variables, {
              lead_name: leadName,
              salesperson_name: 'The Just Wills Team',
            })
          : `Friendly Reminder: Your Proposal ${proposal.invoice_number} Awaits`;

        // Trial Resend account delivers to one verified address; the intended
        // recipient stays in the subject until PRODUCTION_EMAIL_MODE is set.
        const subject = isTestMode ? `[Original: ${leadEmail}] ${baseSubject}` : baseSubject;

        const html = followupTemplate
          ? buildBrandedHtml(
              renderTemplateText(followupTemplate.body, followupTemplate.variables, {
                lead_name: leadName,
                salesperson_name: 'The Just Wills Team',
              }),
              paymentCta
            )
          : generateFollowupEmailHtml(proposal as Proposal, leadName, leadEmail, formattedAmount);

        console.log(`Sending follow-up for proposal ${proposal.invoice_number} (original: ${leadEmail})`);

        if (fromEmail === 'onboarding@resend.dev') {
          console.warn('Using test email domain - email will only be sent to verified addresses');
        }

        const { data: emailResult, error: emailError } = await resend.emails.send({
          from: fromEmail,
          to: isTestMode ? adminEmail : leadEmail,
          subject: subject,
          html: html,
          headers: {
            'X-Entity-Ref-ID': proposal.id, // Disables click tracking
          },
        });

        if (emailError) {
          console.error(`Failed to send email for proposal ${proposal.id}:`, emailError);
          emailsFailed++;
          continue; // Don't update followup_sent_at if email failed
        }

        console.log(`Email sent successfully for proposal ${proposal.id}, Resend ID: ${emailResult?.id}`);
        emailsSent++;

        // Update followup_sent_at after successful email send
        const { error: updateError } = await supabase
          .from('proposals')
          .update({ followup_sent_at: now.toISOString() })
          .eq('id', proposal.id);

        if (updateError) {
          console.error(`Failed to update proposal ${proposal.id} followup_sent_at:`, updateError);
        } else {
          followupsUpdated++;
        }

      } catch (proposalError) {
        console.error(`Error processing proposal ${proposal.id}:`, proposalError);
        emailsFailed++;
      }
    }

    console.log(`Proposal follow-ups complete. Emails Sent: ${emailsSent}, Updated: ${followupsUpdated}, Failed: ${emailsFailed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Proposal follow-ups processed',
        summary: {
          totalProposals: proposals.length,
          emailsSent,
          followupsUpdated,
          emailsFailed,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing proposal follow-ups:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
