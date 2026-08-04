import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '@/config/email';

interface SupportEmailRequest {
  name: string;
  email: string;
  issueType: string;
  priority: string;
  message: string;
  userId?: string;
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

    const body: SupportEmailRequest = await request.json();
    const {
      name,
      email,
      issueType,
      priority,
      message,
      userId,
      attachment,
    } = body;

    // Validate required fields
    if (!name || !email || !issueType || !priority || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers });
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    const adminEmail = EMAIL_REPLY_TO;
    const fromEmail = EMAIL_FROM;

    console.log('Sending support email from:', email);

    const priorityColors: Record<string, string> = {
      low: '#22C55E',
      medium: '#F59E0B',
      high: '#EF4444',
      urgent: '#DC2626',
    };

    // Prepare admin email
    const adminEmailData: any = {
      from: fromEmail,
      to: adminEmail,
      replyTo: email,
      subject: `[Support - ${priority.toUpperCase()}] ${issueType} - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Support Request</h1>
          </div>

          <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #E6E6E4;">
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
              <span style="background-color: ${priorityColors[priority] || '#6B7280'}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                ${priority.toUpperCase()}
              </span>
              <span style="background-color: #E5E7EB; color: #374151; padding: 4px 12px; border-radius: 4px; font-size: 12px;">
                ${issueType}
              </span>
            </div>

            <h2 style="color: #0C5536; margin-top: 0;">Client Information</h2>
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
              ${userId ? `<p style="margin: 5px 0;"><strong>User ID:</strong> ${userId}</p>` : ''}
            </div>

            <h2 style="color: #0C5536; margin-top: 20px;">Message</h2>
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <p style="white-space: pre-wrap; color: #333; margin: 0;">${message}</p>
            </div>

            ${attachment ? '<div style="background-color: #FFF9E6; padding: 10px; border-radius: 5px; margin: 10px 0;"><p style="color: #C6A03B; margin: 0;"><strong>Attachment included</strong></p></div>' : ''}

            <div style="margin-top: 20px; padding: 15px; background-color: #E6F7F1; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #0C5536;">
                <strong>Action Required:</strong> Please respond to this support request promptly.
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
      return NextResponse.json({ error: `Failed to send email: ${adminResult.error.message}` }, { status: 500, headers });
    }

    console.log('Support email sent to admin, ID:', adminResult.data?.id);

    // Send confirmation email to client. This used to be redirected to the
    // staff inbox while the sending domain was unverified, so the client who
    // raised the request received nothing.
    const clientEmailAddress = email;

    const clientResult = await resend.emails.send({
      from: fromEmail,
      to: clientEmailAddress,
      replyTo: EMAIL_REPLY_TO,
      subject: `We received your support request`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Thank You</h1>
          </div>

          <div style="background-color: white; padding: 30px; border: 1px solid #E6E6E4;">
            <p>Dear ${name},</p>

            <p>We have received your support request and our team will review it shortly.</p>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #C6A03B;">
              <p style="margin: 5px 0;"><strong>Issue Type:</strong> ${issueType}</p>
              <p style="margin: 5px 0;"><strong>Priority:</strong> ${priority}</p>
              <p style="margin: 10px 0 5px 0;"><strong>Your message:</strong></p>
              <p style="white-space: pre-wrap; color: #555; margin: 5px 0;">${message}</p>
            </div>

            <div style="background-color: #E6F7F1; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #0C5536; margin-top: 0;">What happens next?</h3>
              <ul style="color: #333; margin: 10px 0; padding-left: 20px;">
                <li>Our support team will review your request</li>
                <li>We typically respond within 1 business day</li>
                <li>We may contact you if we need any clarification</li>
              </ul>
            </div>

            <p>Thank you for contacting Just Wills support.</p>

            <p style="color: #0C5536; margin-top: 30px;"><strong>Just Wills Support Team</strong></p>
          </div>

          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an automated confirmation from Just Wills. Please do not reply to this email.
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

    return NextResponse.json({
      success: true,
      message: 'Support request sent successfully',
      adminEmailId: adminResult.data?.id,
      clientEmailId: clientResult.data?.id,
    }, { headers });
  } catch (error) {
    console.error('Error sending support email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500, headers });
  }
}
