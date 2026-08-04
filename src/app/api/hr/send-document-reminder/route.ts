import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '@/config/email';

interface DocumentReminderRequest {
  employeeName: string;
  employeeEmail: string;
  documentType: string;
  expiryDate: string;
  daysRemaining: number;
  customMessage?: string;
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

    const body: DocumentReminderRequest = await request.json();
    const {
      employeeName,
      employeeEmail,
      documentType,
      expiryDate,
      daysRemaining,
      customMessage,
    } = body;

    // Validate required fields
    if (!employeeName || !employeeEmail || !documentType || !expiryDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers });
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    console.log('Sending document reminder for:', employeeName, documentType);

    // Determine urgency styling
    const isExpired = daysRemaining < 0;
    const isUrgent = daysRemaining <= 7;
    const urgencyColor = isExpired ? '#DC2626' : isUrgent ? '#F59E0B' : '#0C5536';
    const urgencyText = isExpired
      ? `EXPIRED (${Math.abs(daysRemaining)} days ago)`
      : `${daysRemaining} days remaining`;

    // Default message if no custom message provided
    const messageContent = customMessage || `Your ${documentType} expires on ${expiryDate}. Please renew and provide a copy to HR as soon as possible.`;

    const emailResult = await resend.emails.send({
      from: EMAIL_FROM,
      to: employeeEmail,
      replyTo: EMAIL_REPLY_TO,
      subject: `Document Expiry Reminder - ${documentType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Document Expiry Reminder</h1>
          </div>

          <div style="background-color: white; padding: 30px; border: 1px solid #E6E6E4;">
            <p>Dear ${employeeName},</p>

            <div style="background-color: ${isExpired ? '#FEE2E2' : isUrgent ? '#FEF3C7' : '#E6F7F1'}; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${urgencyColor};">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <p style="margin: 0; font-weight: bold; color: ${urgencyColor}; font-size: 18px;">${documentType}</p>
                  <p style="margin: 5px 0 0 0; color: #555;">Expiry Date: ${expiryDate}</p>
                </div>
                <div style="background-color: ${urgencyColor}; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold;">
                  ${urgencyText}
                </div>
              </div>
            </div>

            <p style="color: #333; line-height: 1.6;">${messageContent}</p>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #0C5536; margin-top: 0;">Required Action</h3>
              <ul style="color: #333; margin: 10px 0; padding-left: 20px;">
                <li>Renew your ${documentType} before it expires</li>
                <li>Provide a copy of the renewed document to HR</li>
                <li>Contact HR if you need assistance with the renewal process</li>
              </ul>
            </div>

            <p>If you have already renewed this document, please ignore this reminder and submit the updated document to HR.</p>

            <p style="color: #0C5536; margin-top: 30px;"><strong>HR Department</strong></p>
          </div>

          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an automated reminder from the HR Management System.
            </p>
          </div>
        </div>
      `,
    });

    if (emailResult.error) {
      console.error('Resend API error:', emailResult.error);
      return NextResponse.json({ error: `Failed to send email: ${emailResult.error.message}` }, { status: 500, headers });
    }

    console.log('Document reminder email sent, ID:', emailResult.data?.id);

    return NextResponse.json({
      success: true,
      message: 'Reminder email sent successfully',
      emailId: emailResult.data?.id,
    }, { headers });
  } catch (error) {
    console.error('Error sending document reminder:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500, headers });
  }
}
