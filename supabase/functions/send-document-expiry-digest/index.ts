import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { EMAIL_FROM, EMAIL_REPLY_TO } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExpiringDocument {
  id: string;
  employee_id: string;
  document_type: string;
  expiry_date: string;
  employee_name: string;
  employee_email: string;
  days_until_expiry: number;
  urgency_level: 'expired' | 'critical' | 'urgent';
}

interface NotificationSettings {
  enabled: boolean;
  send_time: string;
  timezone: string;
  recipient_email: string;
  recipient_name: string;
  include_expired: boolean;
  include_critical: boolean;
  include_urgent: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    passport: 'Passport',
    employment_visa: 'Work Permit',
    emirates_id: 'Emirates ID',
    employment_contract: 'Employment Contract',
    certification: 'Certification',
  };
  return labels[type] || type;
}

function generateEmailHtml(
  recipientName: string,
  expiredDocs: ExpiringDocument[],
  criticalDocs: ExpiringDocument[],
  urgentDocs: ExpiringDocument[],
  dashboardUrl: string
): string {
  const totalCount = expiredDocs.length + criticalDocs.length + urgentDocs.length;

  const renderDocumentList = (
    docs: ExpiringDocument[],
    label: string,
    color: string,
    bgColor: string
  ) => {
    if (docs.length === 0) return '';

    const items = docs
      .map((doc) => {
        const daysText =
          doc.days_until_expiry < 0
            ? `${Math.abs(doc.days_until_expiry)} days overdue`
            : doc.days_until_expiry === 0
              ? 'Expires today'
              : `${doc.days_until_expiry} days`;

        return `<li style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <strong>${doc.employee_name}</strong> - ${getDocumentTypeLabel(doc.document_type)}
        <br><span style="color: ${color}; font-size: 14px;">
          Expires: ${formatDate(doc.expiry_date)} (${daysText})
        </span>
      </li>`;
      })
      .join('');

    return `
      <div style="background-color: ${bgColor}; border-left: 4px solid ${color}; padding: 15px; margin: 15px 0; border-radius: 4px;">
        <h3 style="color: ${color}; margin: 0 0 10px 0; font-size: 16px;">${label}</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">${items}</ul>
      </div>
    `;
  };

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Document Expiry Alert</h1>
      </div>

      <div style="background-color: white; padding: 25px; border: 1px solid #E6E6E4;">
        <p>Hi ${recipientName},</p>
        <p>You have <strong>${totalCount} document${totalCount !== 1 ? 's' : ''}</strong> requiring attention:</p>

        ${renderDocumentList(expiredDocs, 'EXPIRED - Immediate Action Required', '#DC2626', '#FEE2E2')}
        ${renderDocumentList(criticalDocs, 'CRITICAL (Expiring in 0-7 days)', '#F59E0B', '#FEF3C7')}
        ${renderDocumentList(urgentDocs, 'URGENT (Expiring in 8-14 days)', '#EA580C', '#FFEDD5')}

        <div style="text-align: center; margin: 25px 0;">
          <a href="${dashboardUrl}"
             style="display: inline-block; background-color: #0C5536; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            View HR Dashboard
          </a>
        </div>
      </div>

      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          This is an automated alert from the HR Management System.
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

    // Get notification settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'hr_document_notifications')
      .single();

    if (settingsError || !settingsData) {
      console.log('No notification settings found, using defaults');
      // Use defaults if no settings exist
    }

    const settings: NotificationSettings = settingsData?.setting_value || {
      enabled: true,
      send_time: '08:00',
      timezone: 'Asia/Dubai',
      recipient_email: '',
      recipient_name: 'HR Manager',
      include_expired: true,
      include_critical: true,
      include_urgent: true,
    };

    if (!settings.enabled) {
      console.log('Document expiry notifications are disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Notifications disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range - get all documents expiring in next 14 days + expired
    const today = new Date();
    const fourteenDaysFromNow = new Date();
    fourteenDaysFromNow.setDate(today.getDate() + 14);

    // Query expiring documents (only active documents, not archived versions)
    const { data: documents, error: docsError } = await supabase
      .from('employee_documents')
      .select(
        `
        id,
        employee_id,
        document_type,
        expiry_date,
        renewal_status,
        employees!inner(full_name, email)
      `
      )
      .eq('is_active', true) // Only query active documents
      .not('expiry_date', 'is', null)
      .lte('expiry_date', fourteenDaysFromNow.toISOString().split('T')[0])
      .neq('renewal_status', 'in_progress')
      .order('expiry_date', { ascending: true });

    if (docsError) {
      throw new Error(`Failed to query documents: ${docsError.message}`);
    }

    if (!documents || documents.length === 0) {
      console.log('No expiring documents found');

      // Log skipped notification
      await supabase.from('email_notification_logs').insert({
        notification_type: 'document_expiry_digest',
        recipient_email: settings.recipient_email,
        subject: 'Document Expiry Digest',
        documents_included: [],
        status: 'skipped',
        error_message: 'No documents requiring attention',
      });

      return new Response(
        JSON.stringify({ success: true, message: 'No expiring documents' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Categorize documents by urgency
    const expiredDocs: ExpiringDocument[] = [];
    const criticalDocs: ExpiringDocument[] = [];
    const urgentDocs: ExpiringDocument[] = [];

    documents.forEach((doc: any) => {
      const expiryDate = new Date(doc.expiry_date);
      const daysUntilExpiry = Math.floor(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const expiringDoc: ExpiringDocument = {
        id: doc.id,
        employee_id: doc.employee_id,
        document_type: doc.document_type,
        expiry_date: doc.expiry_date,
        employee_name: doc.employees.full_name,
        employee_email: doc.employees.email || '',
        days_until_expiry: daysUntilExpiry,
        urgency_level:
          daysUntilExpiry < 0
            ? 'expired'
            : daysUntilExpiry <= 7
              ? 'critical'
              : 'urgent',
      };

      if (daysUntilExpiry < 0 && settings.include_expired) {
        expiredDocs.push(expiringDoc);
      } else if (daysUntilExpiry >= 0 && daysUntilExpiry <= 7 && settings.include_critical) {
        criticalDocs.push(expiringDoc);
      } else if (daysUntilExpiry > 7 && daysUntilExpiry <= 14 && settings.include_urgent) {
        urgentDocs.push(expiringDoc);
      }
    });

    const totalDocs = expiredDocs.length + criticalDocs.length + urgentDocs.length;

    if (totalDocs === 0) {
      console.log('No documents match filter criteria');

      await supabase.from('email_notification_logs').insert({
        notification_type: 'document_expiry_digest',
        recipient_email: settings.recipient_email,
        subject: 'Document Expiry Digest',
        documents_included: [],
        status: 'skipped',
        error_message: 'No documents match configured criteria',
      });

      return new Response(
        JSON.stringify({ success: true, message: 'No documents match criteria' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = EMAIL_FROM;
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';

    // The recipient is configured on the HR settings page. With no address
    // configured there is nobody to send to — do not guess one.
    const recipientEmail = (settings.recipient_email || '').trim();
    if (!recipientEmail) {
      console.warn('hr_document_notifications.recipient_email is not configured; skipping send');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No recipient_email configured for hr_document_notifications',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine subject based on highest urgency
    let subjectEmoji = '';
    let urgencyText = '';
    if (expiredDocs.length > 0) {
      subjectEmoji = '🔴';
      urgencyText = 'EXPIRED';
    } else if (criticalDocs.length > 0) {
      subjectEmoji = '🟠';
      urgencyText = 'CRITICAL';
    } else {
      subjectEmoji = '🟡';
      urgencyText = 'URGENT';
    }

    const subject = `${subjectEmoji} ${urgencyText}: ${totalDocs} Document${totalDocs !== 1 ? 's' : ''} Requiring Attention`;

    const emailHtml = generateEmailHtml(
      settings.recipient_name,
      expiredDocs,
      criticalDocs,
      urgentDocs,
      `${appUrl}/hr`
    );

    console.log(`Sending document expiry digest to ${settings.recipient_email}`);
    console.log(`Documents: ${expiredDocs.length} expired, ${criticalDocs.length} critical, ${urgentDocs.length} urgent`);

    // Send email
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      replyTo: EMAIL_REPLY_TO,
      subject: subject,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Resend API error:', emailError);

      // Log failed notification
      await supabase.from('email_notification_logs').insert({
        notification_type: 'document_expiry_digest',
        recipient_email: settings.recipient_email,
        subject: subject,
        documents_included: [...expiredDocs, ...criticalDocs, ...urgentDocs].map((d) => ({
          id: d.id,
          employee_name: d.employee_name,
          document_type: d.document_type,
          expiry_date: d.expiry_date,
          urgency_level: d.urgency_level,
        })),
        status: 'failed',
        error_message: emailError.message,
      });

      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    // Log successful notification
    await supabase.from('email_notification_logs').insert({
      notification_type: 'document_expiry_digest',
      recipient_email: settings.recipient_email,
      subject: subject,
      documents_included: [...expiredDocs, ...criticalDocs, ...urgentDocs].map((d) => ({
        id: d.id,
        employee_name: d.employee_name,
        document_type: d.document_type,
        expiry_date: d.expiry_date,
        urgency_level: d.urgency_level,
      })),
      status: 'sent',
      resend_email_id: emailResult?.id,
    });

    console.log(`Document expiry digest sent successfully. Email ID: ${emailResult?.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Digest email sent',
        emailId: emailResult?.id,
        documentCount: totalDocs,
        breakdown: {
          expired: expiredDocs.length,
          critical: criticalDocs.length,
          urgent: urgentDocs.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending document expiry digest:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
