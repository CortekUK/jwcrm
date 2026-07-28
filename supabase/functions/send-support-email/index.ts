import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { resolveStaffRecipient, applyTestModeSwap } from '../_shared/accountManager.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SupportEmailRequest {
  name: string;
  email: string;
  /** Will this message is about. Null/absent = general enquiry → admin. */
  willId?: string | null;
  subject: string;
  message: string;
  attachment?: {
    content: string; // base64 encoded file content
    filename: string;
    contentType: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Parse request body
    const { name, email, willId, subject, message, attachment }: SupportEmailRequest = await req.json();

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Route to the account manager handling the selected will. A general
    // enquiry (no willId) or an unassigned will falls back to admin.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const staff = await resolveStaffRecipient(supabase, willId);

    // Get sender email - use onboarding@resend.dev for testing or verified domain
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';

    console.log('Using FROM_EMAIL:', fromEmail);
    console.log(
      'Routing to:', staff.email,
      staff.isAccountManager ? `(account manager: ${staff.name})` : '(admin fallback)'
    );
    console.log('Sending to client:', email);

    // Real recipient is the resolved account manager; the swap redirects the
    // actual delivery while the Resend trial is in use.
    const staffRouted = applyTestModeSwap(staff.email, `[Support Request] ${subject}`);

    // Prepare email data for the assigned staff member
    const adminEmailData: any = {
      from: fromEmail,
      to: staffRouted.to,
      replyTo: email,
      subject: staffRouted.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header with Branding -->
          <div style="background: linear-gradient(135deg, #0C5536 0%, #128277 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <div style="display: inline-block; background-color: #C6A03B; width: 60px; height: 60px; border-radius: 50%; line-height: 60px; margin-bottom: 10px;">
              <span style="color: white; font-size: 28px; font-weight: bold; font-family: 'Playfair Display', serif;">JW</span>
            </div>
            <h1 style="color: white; margin: 10px 0 5px 0; font-size: 28px; font-family: 'Playfair Display', serif; font-weight: 600;">JUST WILLS</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 0; font-size: 14px; letter-spacing: 1px;">Professional Will Drafting Services</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 20px; background-color: #ffffff; border-left: 1px solid #E6E6E4; border-right: 1px solid #E6E6E4;">
            <h2 style="color: #0C5536; margin-top: 0; font-family: 'Playfair Display', serif; font-size: 22px;">New Support Request</h2>

            <div style="background-color: #F8F6EC; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C6A03B;">
              <p style="margin: 8px 0; color: #333;"><strong style="color: #0C5536;">From:</strong> ${name}</p>
              <p style="margin: 8px 0; color: #333;"><strong style="color: #0C5536;">Email:</strong> ${email}</p>
              <p style="margin: 8px 0; color: #333;"><strong style="color: #0C5536;">Subject:</strong> ${subject}</p>
              <p style="margin: 8px 0; color: #333;"><strong style="color: #0C5536;">Regarding:</strong> ${willId ? `Will #${String(willId).slice(0, 8).toUpperCase()}` : 'General enquiry'}</p>
              <p style="margin: 8px 0; color: #333;"><strong style="color: #0C5536;">Assigned to:</strong> ${staff.name}${staff.isAccountManager ? '' : ' (unassigned — admin fallback)'}</p>
            </div>

            <div style="margin: 25px 0;">
              <h3 style="color: #0C5536; font-size: 18px; margin-bottom: 10px;">Message:</h3>
              <div style="background-color: #ffffff; padding: 20px; border: 1px solid #E6E6E4; border-radius: 8px;">
                <p style="white-space: pre-wrap; color: #333; line-height: 1.6; margin: 0;">${message}</p>
              </div>
            </div>

            ${attachment ? '<div style="background-color: #FFF9E6; padding: 15px; border-radius: 8px; border-left: 4px solid #C6A03B;"><p style="color: #C6A03B; margin: 0; font-weight: 600;">📎 Attachment included</p></div>' : ''}
          </div>

          <!-- Footer -->
          <div style="background-color: #FAFAF8; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #E6E6E4; border-top: 2px solid #C6A03B;">
            <p style="color: #999; font-size: 12px; margin: 5px 0;">
              This is an automated message from <strong style="color: #0C5536;">Just Wills</strong> support system.
            </p>
            <p style="color: #999; font-size: 11px; margin: 5px 0;">
              Professional Will Drafting Services | Trusted Legal Documentation
            </p>
          </div>
        </div>
      `,
    };

    // Add attachment if provided
    if (attachment) {
      adminEmailData.attachments = [
        {
          content: attachment.content,
          filename: attachment.filename,
        },
      ];
    }

    console.log('Sending support email from:', email, 'Subject:', subject);

    // Send email to admin
    const { data: adminData, error: adminError } = await resend.emails.send(adminEmailData);

    if (adminError) {
      console.error('Resend API error (staff):', adminError);
      throw new Error(`Failed to send email to staff: ${adminError.message}`);
    }

    console.log('Email sent successfully to staff, ID:', adminData?.id);

    // Send confirmation email to client
    const clientRouted = applyTestModeSwap(email, 'We received your support request - Just Wills');
    const { data: clientData, error: clientError } = await resend.emails.send({
      from: fromEmail,
      to: clientRouted.to,
      subject: clientRouted.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header with Branding -->
          <div style="background: linear-gradient(135deg, #0C5536 0%, #128277 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <div style="display: inline-block; background-color: #C6A03B; width: 60px; height: 60px; border-radius: 50%; line-height: 60px; margin-bottom: 10px;">
              <span style="color: white; font-size: 28px; font-weight: bold; font-family: 'Playfair Display', serif;">JW</span>
            </div>
            <h1 style="color: white; margin: 10px 0 5px 0; font-size: 28px; font-family: 'Playfair Display', serif; font-weight: 600;">JUST WILLS</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 0; font-size: 14px; letter-spacing: 1px;">Professional Will Drafting Services</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 20px; background-color: #ffffff; border-left: 1px solid #E6E6E4; border-right: 1px solid #E6E6E4;">
            <div style="text-align: center; margin-bottom: 25px;">
              <h2 style="color: #0C5536; margin: 0; font-size: 24px; font-family: 'Playfair Display', serif;">Thank You!</h2>
              <p style="color: #777; margin: 10px 0 0 0;">We've received your message</p>
            </div>

            <p style="color: #333; line-height: 1.6;">Dear ${name},</p>

            <p style="color: #333; line-height: 1.6;">Thank you for contacting <strong style="color: #0C5536;">Just Wills</strong>. We have received your support request and our team will review it shortly.</p>

            <div style="background-color: #F8F6EC; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #C6A03B;">
              <p style="margin: 0 0 10px 0; color: #0C5536; font-weight: 600;">Your Request Summary:</p>
              <p style="margin: 8px 0; color: #333;"><strong>Subject:</strong> ${subject}</p>
              <div style="margin-top: 15px;">
                <p style="margin: 0 0 8px 0; color: #0C5536; font-weight: 600;">Your message:</p>
                <p style="white-space: pre-wrap; color: #555; line-height: 1.6; margin: 0;">${message}</p>
              </div>
            </div>

            <div style="background-color: #E6F7F1; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #0C5536;">
              <p style="margin: 0 0 10px 0; color: #0C5536; font-weight: 600;">⏱️ What happens next?</p>
              <p style="color: #333; line-height: 1.6; margin: 0;">Our team will review your request and respond within <strong>1 business day</strong>. We appreciate your patience and look forward to assisting you.</p>
            </div>

            <p style="color: #333; line-height: 1.6; margin-top: 25px;">Best regards,</p>
            <p style="color: #0C5536; font-weight: 600; margin: 5px 0; font-size: 16px;">The Just Wills Team</p>
            <p style="color: #777; font-size: 14px; margin: 0;">Professional Will Drafting Services</p>
          </div>

          <!-- Footer -->
          <div style="background-color: #FAFAF8; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #E6E6E4; border-top: 2px solid #C6A03B;">
            <p style="color: #999; font-size: 12px; margin: 5px 0;">
              This is an automated confirmation from <strong style="color: #0C5536;">Just Wills</strong>.
            </p>
            <p style="color: #999; font-size: 11px; margin: 5px 0;">
              Please do not reply to this email. For urgent matters, please use our support portal.
            </p>
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #E6E6E4;">
              <p style="color: #C6A03B; font-size: 11px; margin: 0; font-weight: 600;">
                Trusted Legal Documentation | Secure & Confidential
              </p>
            </div>
          </div>
        </div>
      `,
    });

    if (clientError) {
      console.warn('Failed to send confirmation to client:', clientError);
      // Don't throw error, admin email was sent successfully
    } else {
      console.log('Confirmation email sent to client, ID:', clientData?.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Support email sent successfully',
        routedTo: staff.email,
        routedToName: staff.name,
        isAccountManager: staff.isAccountManager,
        testMode: staffRouted.isTestMode,
        adminEmailId: adminData?.id,
        clientEmailId: clientData?.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending support email:', error);
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
