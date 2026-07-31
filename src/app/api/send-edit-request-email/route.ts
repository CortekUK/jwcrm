import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

interface EditRequestEmailRequest {
  willId: string;
  clientName: string;
  clientEmail: string;
  subject: string;
  message: string;
  documentName: string;
  documentType: 'draft' | 'final';
  attachment?: {
    content: string;
    filename: string;
    contentType: string;
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export async function POST(request: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401, headers });
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401, headers });
    }

    // Get Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500, headers });
    }

    const body: EditRequestEmailRequest = await request.json();
    const {
      willId,
      clientName,
      clientEmail,
      subject,
      message,
      documentName,
      documentType,
      attachment,
    } = body;

    // Validate required fields
    if (!willId || !clientName || !clientEmail || !subject || !message || !documentName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers });
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    const adminEmail = 'ilyasghulam32@gmail.com';
    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

    console.log('Sending edit request email for will:', willId);

    // Prepare admin email
    const adminEmailData: any = {
      from: fromEmail,
      to: adminEmail,
      replyTo: clientEmail,
      subject: `[Edit Request] ${subject} - Will #${willId.slice(0, 8)}`,
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

            ${attachment ? '<div style="background-color: #FFF9E6; padding: 10px; border-radius: 5px; margin: 10px 0;"><p style="color: #C6A03B; margin: 0;"><strong>Attachment included</strong></p></div>' : ''}

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
    const adminResult = await resend.emails.send(adminEmailData);

    if (adminResult.error) {
      console.error('Resend API error (admin):', adminResult.error);
      return NextResponse.json({ error: `Failed to send email to admin: ${adminResult.error.message}` }, { status: 500, headers });
    }

    console.log('Edit request email sent to admin, ID:', adminResult.data?.id);

    // Send confirmation email to client
    const clientEmailAddress = adminEmail;

    const clientResult = await resend.emails.send({
      from: fromEmail,
      to: clientEmailAddress,
      subject: `[Client Confirmation - Original: ${clientEmail}] We received your edit request`,
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

    if (clientResult.error) {
      console.warn('Failed to send confirmation to client:', clientResult.error);
    } else {
      console.log('Confirmation email sent to client, ID:', clientResult.data?.id);
    }

    // Log the edit request in the database
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // will_status_events.new_status is NOT NULL, so the old `new_status: null`
    // insert failed with 23502 on every single edit request and the error was
    // never checked — the "logged for the legal team" promise was empty.
    // An edit request is an annotation, not a transition, so record the will's
    // current status with no previous_status: the timeline then renders one
    // badge plus the note instead of a fake status change.
    const { data: willRow } = await supabaseAdmin
      .from('wills')
      .select('status')
      .eq('id', willId)
      .single();

    const { error: logError } = await supabaseAdmin
      .from('will_status_events')
      .insert({
        will_id: willId,
        previous_status: null,
        new_status: willRow?.status ?? 'in_progress',
        actor_user_id: user.id,
        is_internal: true,
        notes: `Client requested edits: ${subject}\n\n${message}`,
      });

    if (logError) {
      console.error('Failed to log edit request to will_status_events:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Edit request sent successfully',
      adminEmailId: adminResult.data?.id,
      clientEmailId: clientResult.data?.id,
    }, { headers });
  } catch (error) {
    console.error('Error sending edit request email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500, headers });
  }
}
