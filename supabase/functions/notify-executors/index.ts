import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Person {
  level: number;
  name: string;
  relation?: string;
  relationship?: string;
  email: string;
  contact_number?: string;
}

interface NotifyRequest {
  willId: string;
  clientName: string;
  executors?: Person[];
  persons?: Person[];
  role?: 'executor' | 'trustee' | 'interim_guardian' | 'permanent_guardian';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    // Verify admin role
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      console.error('Unauthorized: Admin access required');
      throw new Error('Unauthorized: Admin access required');
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Parse request body
    const { willId, clientName, executors, persons, role = 'executor' }: NotifyRequest = await req.json();

    // Determine which array to use
    const peopleToNotify = executors || persons || [];

    // Validate required fields
    if (!willId || !clientName || peopleToNotify.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Role configuration
    const roleConfig = {
      executor: {
        title: 'Executor',
        designation: (level: number) => level === 1 ? 'the primary executor' : `a level ${level} executor`,
        responsibilities: [
          'Managing and distributing the estate according to the will',
          'Paying any outstanding debts and taxes',
          'Obtaining probate (if required)',
          'Ensuring the wishes of the deceased are carried out',
          'Communicating with beneficiaries and legal authorities',
        ],
      },
      trustee: {
        title: 'Trustee',
        designation: (level: number) => level === 1 ? 'the primary trustee' : `a level ${level} trustee`,
        responsibilities: [
          'Managing trust assets in the best interest of beneficiaries',
          'Making distributions according to the trust terms',
          'Keeping accurate records of all transactions',
          'Acting with loyalty and in good faith',
          'Communicating with beneficiaries regularly',
        ],
      },
      interim_guardian: {
        title: 'Interim Guardian',
        designation: (level: number) => level === 1 ? 'the primary interim guardian' : `a level ${level} interim guardian`,
        responsibilities: [
          'Providing temporary care and custody of minor children',
          'Making day-to-day decisions for the children',
          'Ensuring the children\'s safety and well-being',
          'Managing routine healthcare and educational needs',
          'Acting in the best interests of the children',
        ],
      },
      permanent_guardian: {
        title: 'Permanent Guardian',
        designation: (level: number) => level === 1 ? 'the primary permanent guardian' : `a level ${level} permanent guardian`,
        responsibilities: [
          'Providing long-term care and custody of minor children',
          'Making major life decisions for the children',
          'Ensuring the children\'s safety, education, and well-being',
          'Managing healthcare and financial matters',
          'Raising the children as your own',
        ],
      },
    };

    const config = roleConfig[role];

    // Initialize Resend
    const resend = new Resend(resendApiKey);
    const fromEmail = EMAIL_FROM;

    console.log(`Sending ${config.title} notification emails for will:`, willId);
    console.log(`Number of ${config.title}s:`, peopleToNotify.length);
    console.log('Sending from:', fromEmail);

    const emailResults = [];

    // Send email to each person
    for (const person of peopleToNotify) {
      if (!person.email) {
        console.log(`Skipping ${person.name} - no email provided`);
        continue;
      }

      const relationshipField = person.relation || person.relationship || 'N/A';
      const responsibilitiesHtml = config.responsibilities.map(r => `<li>${r}</li>`).join('');

      try {
        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: person.email,
          replyTo: EMAIL_REPLY_TO,
          subject: `Important: You have been appointed as ${role === 'executor' ? 'an' : 'a'} ${config.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Just Wills</h1>
                <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">Professional Will Drafting Services</p>
              </div>

              <div style="background-color: white; padding: 30px; border: 1px solid #E6E6E4;">
                <h2 style="color: #0C5536; margin-top: 0;">${config.title} Appointment Notification</h2>

                <p>Dear ${person.name},</p>

                <p>We are writing to inform you that <strong>${clientName}</strong> has appointed you as ${config.designation(person.level)} in their Last Will and Testament.</p>

                <div style="background-color: #E6F7F1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0C5536;">
                  <h3 style="color: #0C5536; margin-top: 0; font-size: 16px;">${config.title} Details:</h3>
                  <p style="margin: 5px 0;"><strong>Name:</strong> ${person.name}</p>
                  <p style="margin: 5px 0;"><strong>Email:</strong> ${person.email}</p>
                  <p style="margin: 5px 0;"><strong>Relationship:</strong> ${relationshipField}</p>
                  <p style="margin: 5px 0;"><strong>Role:</strong> Level ${person.level} ${config.title}</p>
                </div>

                <h3 style="color: #0C5536;">What does being ${role === 'executor' ? 'an' : 'a'} ${config.title} mean?</h3>
                <p>As ${role === 'executor' ? 'an' : 'a'} ${config.title}, you would be responsible for:</p>
                <ul style="color: #333; line-height: 1.8;">
                  ${responsibilitiesHtml}
                </ul>

                <div style="background-color: #FFF9E6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C6A03B;">
                  <h3 style="color: #C6A03B; margin-top: 0; font-size: 16px;">Important Notes:</h3>
                  <ul style="color: #6B6B6B; margin: 10px 0; padding-left: 20px;">
                    <li>This is for your information only</li>
                    <li>You are not obligated to accept this role</li>
                    <li>You can decline the appointment if you wish</li>
                    <li>If you have concerns, please contact ${clientName} directly</li>
                  </ul>
                </div>

                <h3 style="color: #0C5536;">Need More Information?</h3>
                <p>If you have any questions about your role as ${role === 'executor' ? 'an' : 'a'} ${config.title} or would like more information about your responsibilities, please feel free to contact us.</p>

                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                  <p style="margin: 5px 0; color: #0C5536;"><strong>Just Wills Team</strong></p>
                  <p style="margin: 5px 0; color: #6B6B6B; font-size: 14px;">Professional Will Drafting Services</p>
                </div>

                <p style="color: #6B6B6B; font-size: 12px; margin-top: 30px;">
                  This notification is sent on behalf of ${clientName}, who has chosen you as their ${role}.
                  The client has authorized us to contact you regarding this appointment.
                </p>
              </div>

              <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  This is an automated message from Just Wills. Please do not reply to this email.
                </p>
              </div>
            </div>
          `,
        });

        if (error) {
          console.error(`Failed to send email to ${person.email}:`, error);
          emailResults.push({
            person: person.name,
            email: person.email,
            status: 'failed',
            error: error.message,
          });
        } else {
          console.log(`Email sent successfully to ${person.email}, ID:`, data?.id);
          emailResults.push({
            person: person.name,
            email: person.email,
            status: 'sent',
            emailId: data?.id,
          });
        }
      } catch (error) {
        console.error(`Error sending email to ${person.email}:`, error);
        emailResults.push({
          person: person.name,
          email: person.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Log the notification in the database (activity log)
    const successfulEmails = emailResults.filter(r => r.status === 'sent').length;
    await supabase
      .from('will_status_events')
      .insert({
        will_id: willId,
        previous_status: null,
        new_status: null,
        actor_user_id: user.id,
        notes: `${config.title} notification emails sent to ${successfulEmails} of ${peopleToNotify.length} ${config.title}(s)`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notification emails sent to ${successfulEmails} of ${peopleToNotify.length} ${config.title}(s)`,
        results: emailResults,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending executor notification emails:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
