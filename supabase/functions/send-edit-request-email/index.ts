import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { resolveStaffRecipient, applyTestModeSwap } from '../_shared/accountManager.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EditRequestEmailRequest {
  willId: string;
  clientName: string;
  clientEmail: string;
  subject: string;
  message: string;
  documentName: string;
  documentType: 'draft' | 'final';
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

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Parse request body
    const {
      willId,
      clientName,
      clientEmail,
      subject,
      message,
      documentName,
      documentType,
      attachment,
    }: EditRequestEmailRequest = await req.json();

    // Validate required fields
    if (!willId || !clientName || !clientEmail || !subject || !message || !documentName) {
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

    // Route to the account manager assigned to this will; falls back to the
    // admin address when the case is unassigned.
    const staff = await resolveStaffRecipient(supabase, willId);
    const adminEmail = staff.email;
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';

    console.log('Sending edit request email for will:', willId);
    console.log('From client:', clientEmail);
    console.log(
      'Routing to:', staff.email,
      staff.isAccountManager ? `(account manager: ${staff.name})` : '(admin fallback)'
    );
    console.log('Sending to client:', clientEmail);

    // Real recipient is the resolved account manager; the swap redirects the
    // actual delivery while the Resend trial is in use.
    const staffRouted = applyTestModeSwap(
      staff.email,
      `[Edit Request] ${subject} - Will #${willId.slice(0, 8)}`
    );

    // Prepare email data for the assigned staff member
    const adminEmailData: any = {
      from: fromEmail,
      to: staffRouted.to,
      replyTo: clientEmail,
      subject: staffRouted.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Edit Request Received</h1>
          </div>

          <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #E6E6E4;">
            <h2 style="color: #0C5536; margin-top: 0;">Client Information</h2>
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <p style="margin: 5px 0;"><strong>Client Name:</strong> ${clientName}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${clientEmail}</p>
              <p style="margin: 5px 0;"><strong>Will ID:</strong> ${willId}</p>
              <p style="margin: 5px 0;"><strong>Document:</strong> ${documentName} (${documentType})</p>
            </div>

            <h2 style="color: #0C5536; margin-top: 20px;">Edit Request Details</h2>
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
              <div style="margin-top: 15px;">
                <strong>Message:</strong>
                <p style="white-space: pre-wrap; margin-top: 10px; color: #333;">${message}</p>
              </div>
            </div>

            ${attachment ? '<div style="background-color: #FFF9E6; padding: 10px; border-radius: 5px; margin: 10px 0;"><p style="color: #C6A03B; margin: 0;"><strong>📎 Attachment included</strong></p></div>' : ''}

            <div style="margin-top: 20px; padding: 15px; background-color: #E6F7F1; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #0C5536;">
                <strong>Action Required:</strong> Please review this edit request and respond to the client promptly.
              </p>
            </div>
          </div>

          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an automated message from Just Wills client portal.
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

    // Send email to admin
    const { data: adminData, error: adminError } = await resend.emails.send(adminEmailData);

    if (adminError) {
      console.error('Resend API error (admin):', adminError);
      throw new Error(`Failed to send email to admin: ${adminError.message}`);
    }

    console.log('Edit request email sent to admin, ID:', adminData?.id);

    // Send confirmation email to client
    const clientRouted = applyTestModeSwap(clientEmail, 'We received your edit request');
    const { data: clientData, error: clientError } = await resend.emails.send({
      from: fromEmail,
      to: clientRouted.to,
      subject: clientRouted.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Thank You</h1>
          </div>

          <div style="background-color: white; padding: 30px; border: 1px solid #E6E6E4;">
            <p>Dear ${clientName},</p>

            <p>We have received your edit request for your will document and our legal team will review it shortly.</p>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #C6A03B;">
              <p style="margin: 5px 0;"><strong>Document:</strong> ${documentName}</p>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin: 10px 0 5px 0;"><strong>Your message:</strong></p>
              <p style="white-space: pre-wrap; color: #555; margin: 5px 0;">${message}</p>
            </div>

            <div style="background-color: #E6F7F1; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #0C5536; margin-top: 0;">What happens next?</h3>
              <ul style="color: #333; margin: 10px 0; padding-left: 20px;">
                <li>Our legal team will review your request within 1 business day</li>
                <li>We'll prepare the necessary revisions to your document</li>
                <li>You'll receive an updated draft for your review</li>
                <li>We may contact you if we need any clarification</li>
              </ul>
            </div>

            <p>Thank you for trusting Just Wills with your important legal documents.</p>

            <p style="color: #0C5536; margin-top: 30px;"><strong>Just Wills Legal Team</strong></p>
          </div>

          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an automated confirmation from Just Wills. Please do not reply to this email.
            </p>
            <p style="color: #999; font-size: 12px; margin: 5px 0;">
              For urgent matters, please contact us at ${adminEmail}
            </p>
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

    // Log the edit request in the database (activity log)
    await supabase
      .from('will_status_events')
      .insert({
        will_id: willId,
        previous_status: null,
        new_status: null,
        actor_user_id: user.id,
        notes: `Client requested edits: ${subject}\n\n${message}`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Edit request sent successfully',
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
    console.error('Error sending edit request email:', error);
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
