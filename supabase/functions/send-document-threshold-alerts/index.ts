import { Resend } from 'npm:resend@6.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default thresholds in days
const DEFAULT_THRESHOLDS = [90, 60, 30, 14, 7];

// The `send-document-threshold-alerts` cron ticks every 15 minutes (see
// supabase/migrations/20260802000002_setup_document_threshold_alerts_cron.sql).
// Each run is a no-op unless the wall clock in the configured timezone lands in
// the CRON_TICK_MINUTES-wide window that opens at the configured send time, so
// the Settings page — not the cron expression — decides when the alert goes
// out. Same shape as the working-hours gate in send-lead-notification-digest.
const CRON_TICK_MINUTES = 15;
const DEFAULT_SEND_TIME = '08:00';
const DEFAULT_TIMEZONE = 'Asia/Dubai';

function parseHhMm(value: string | undefined, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value || '').trim());
  if (!m) return fallback;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

function nowMinutesInTz(timeZone: string): number {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
  } catch {
    // An unknown timezone string must not wedge the job forever — fall back to
    // the default rather than throwing.
    console.warn(`Unknown timezone "${timeZone}", falling back to ${DEFAULT_TIMEZONE}`);
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: DEFAULT_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
  }
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return (hour % 24) * 60 + minute;
}

// True on exactly one cron tick per day: the one inside
// [send_time, send_time + 15min) in the configured timezone.
function isWithinSendWindow(sendTime: string | undefined, timezone: string | undefined): boolean {
  const target = parseHhMm(sendTime, parseHhMm(DEFAULT_SEND_TIME, 8 * 60));
  const now = nowMinutesInTz(timezone || DEFAULT_TIMEZONE);
  const delta = (now - target + 24 * 60) % (24 * 60);
  return delta < CRON_TICK_MINUTES;
}

interface ThresholdSettings {
  enabled: boolean;
  thresholds: number[];
  send_time: string;
  timezone: string;
  recipient_email: string;
  recipient_name: string;
  send_individual_alerts: boolean;
}

interface DocumentAlert {
  id: string;
  employee_id: string;
  document_type: string;
  expiry_date: string;
  employee_name: string;
  employee_email: string;
  days_until_expiry: number;
  threshold_crossed: number;
  alert_thresholds_sent: number[];
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
    employment_visa: 'Employment Visa',
    emirates_id: 'Emirates ID',
    employment_contract: 'Employment Contract',
    certification: 'Certification',
  };
  return labels[type] || type;
}

function getThresholdLabel(days: number): string {
  if (days === 90) return '3 months';
  if (days === 60) return '2 months';
  if (days === 30) return '1 month';
  if (days === 14) return '2 weeks';
  if (days === 7) return '1 week';
  return `${days} days`;
}

function getUrgencyColor(days: number): { color: string; bgColor: string } {
  if (days <= 7) return { color: '#DC2626', bgColor: '#FEE2E2' };
  if (days <= 14) return { color: '#EA580C', bgColor: '#FFEDD5' };
  if (days <= 30) return { color: '#F59E0B', bgColor: '#FEF3C7' };
  if (days <= 60) return { color: '#3B82F6', bgColor: '#DBEAFE' };
  return { color: '#6B7280', bgColor: '#F3F4F6' };
}

function generateThresholdAlertHtml(
  recipientName: string,
  alerts: DocumentAlert[],
  dashboardUrl: string
): string {
  const alertsByThreshold = new Map<number, DocumentAlert[]>();
  
  alerts.forEach(alert => {
    const existing = alertsByThreshold.get(alert.threshold_crossed) || [];
    existing.push(alert);
    alertsByThreshold.set(alert.threshold_crossed, existing);
  });

  let sectionsHtml = '';
  
  // Sort thresholds in ascending order (most urgent first)
  const sortedThresholds = Array.from(alertsByThreshold.keys()).sort((a, b) => a - b);
  
  sortedThresholds.forEach(threshold => {
    const docs = alertsByThreshold.get(threshold) || [];
    const { color, bgColor } = getUrgencyColor(threshold);
    const thresholdLabel = getThresholdLabel(threshold);
    
    const items = docs.map(doc => `
      <li style="padding: 10px 0; border-bottom: 1px solid #eee;">
        <strong style="color: #222;">${doc.employee_name}</strong> - ${getDocumentTypeLabel(doc.document_type)}
        <br><span style="color: ${color}; font-size: 14px;">
          Expires: ${formatDate(doc.expiry_date)} (${doc.days_until_expiry} days remaining)
        </span>
      </li>
    `).join('');

    sectionsHtml += `
      <div style="background-color: ${bgColor}; border-left: 4px solid ${color}; padding: 15px; margin: 15px 0; border-radius: 4px;">
        <h3 style="color: ${color}; margin: 0 0 10px 0; font-size: 16px;">
          ⏰ ${thresholdLabel} Warning (${docs.length} document${docs.length !== 1 ? 's' : ''})
        </h3>
        <ul style="list-style: none; padding: 0; margin: 0;">${items}</ul>
      </div>
    `;
  });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0C5536; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Document Expiry Threshold Alert</h1>
      </div>

      <div style="background-color: white; padding: 25px; border: 1px solid #E6E6E4;">
        <p>Hi ${recipientName},</p>
        <p>The following documents have reached their expiry warning thresholds:</p>

        ${sectionsHtml}

        <div style="text-align: center; margin: 25px 0;">
          <a href="${dashboardUrl}"
             style="display: inline-block; background-color: #0C5536; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            View HR Dashboard
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666;">
          Please ensure these documents are renewed before their expiry dates to avoid any compliance issues.
        </p>
      </div>

      <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          This is an automated threshold alert from the HR Management System.
          <br>You will not receive another alert for these specific thresholds.
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
    // Parse request body for force option
    let forceRun = false;
    try {
      const body = await req.json();
      forceRun = body?.force === true;
    } catch {
      // No body or invalid JSON, continue with defaults
    }

    // Create Supabase client with service role for full access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get threshold alert settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'hr_document_threshold_alerts')
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error fetching settings:', settingsError);
    }

    const settings: ThresholdSettings = settingsData?.setting_value || {
      enabled: true,
      thresholds: DEFAULT_THRESHOLDS,
      send_time: '08:00',
      timezone: 'Asia/Dubai',
      recipient_email: '',
      recipient_name: 'HR Manager',
      send_individual_alerts: true,
    };

    if (!settings.enabled && !forceRun) {
      console.log('Document threshold alerts are disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Threshold alerts disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Time gate. `forceRun` is what the "Test Notification" button on the HR
    // Settings page sends, so a manual test must never be blocked by it.
    if (!forceRun && !isWithinSendWindow(settings.send_time, settings.timezone)) {
      console.log(
        `Outside configured send window (${settings.send_time || DEFAULT_SEND_TIME} ${settings.timezone || DEFAULT_TIMEZONE})`
      );
      return new Response(
        JSON.stringify({ success: true, skipped: 'outside configured send window' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.recipient_email) {
      console.log('No recipient email configured for threshold alerts');
      return new Response(
        JSON.stringify({ success: false, message: 'No recipient email configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const thresholds = settings.thresholds || DEFAULT_THRESHOLDS;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all active documents with expiry dates
    const { data: documents, error: docsError } = await supabase
      .from('employee_documents')
      .select(`
        id,
        employee_id,
        document_type,
        expiry_date,
        alert_thresholds_sent,
        renewal_status,
        employees!inner(full_name, email)
      `)
      .eq('is_active', true)
      .not('expiry_date', 'is', null)
      .neq('renewal_status', 'in_progress')
      .order('expiry_date', { ascending: true });

    if (docsError) {
      throw new Error(`Failed to query documents: ${docsError.message}`);
    }

    if (!documents || documents.length === 0) {
      console.log('No documents found');
      return new Response(
        JSON.stringify({ success: true, message: 'No documents to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find documents that have crossed a threshold but haven't been notified
    const alertsToSend: DocumentAlert[] = [];

    for (const doc of documents) {
      const expiryDate = new Date(doc.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.floor(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Skip expired documents (handled by daily digest)
      if (daysUntilExpiry < 0) continue;

      // Get already sent thresholds
      const alreadySent: number[] = doc.alert_thresholds_sent || [];

      // Find which threshold this document has crossed (if any)
      // We want the highest threshold that is >= daysUntilExpiry
      // E.g., if 85 days remaining, check if 90-day alert was sent
      for (const threshold of thresholds) {
        // Document should be notified when days remaining <= threshold
        // But only if this specific threshold hasn't been sent
        // Allow a 1-day buffer for daily cron execution
        if (daysUntilExpiry <= threshold && daysUntilExpiry > threshold - 2) {
          if (!alreadySent.includes(threshold)) {
            alertsToSend.push({
              id: doc.id,
              employee_id: doc.employee_id,
              document_type: doc.document_type,
              expiry_date: doc.expiry_date,
              employee_name: (doc as any).employees.full_name,
              employee_email: (doc as any).employees.email || '',
              days_until_expiry: daysUntilExpiry,
              threshold_crossed: threshold,
              alert_thresholds_sent: alreadySent,
            });
          }
        }
      }
    }

    if (alertsToSend.length === 0) {
      console.log('No threshold alerts needed');
      return new Response(
        JSON.stringify({ success: true, message: 'No threshold alerts needed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${alertsToSend.length} documents needing threshold alerts`);

    // Initialize Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }
    const resend = new Resend(resendApiKey);

    // Generate and send email
    const dashboardUrl = `${Deno.env.get('SITE_URL') || 'http://localhost:3000'}/hr`;
    const emailHtml = generateThresholdAlertHtml(
      settings.recipient_name,
      alertsToSend,
      dashboardUrl
    );

    const subject = `Document Expiry Alert: ${alertsToSend.length} document${alertsToSend.length !== 1 ? 's' : ''} reaching threshold`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: Deno.env.get('RESEND_FROM_EMAIL') || 'HR System <noreply@resend.dev>',
      to: settings.recipient_email,
      subject: subject,
      html: emailHtml,
    });

    if (emailError) {
      console.error('Failed to send email:', emailError);

      // Log failed notification
      await supabase.from('email_notification_logs').insert({
        notification_type: 'document_threshold_alert',
        recipient_email: settings.recipient_email,
        subject: subject,
        documents_included: alertsToSend.map(a => ({
          id: a.id,
          type: a.document_type,
          employee: a.employee_name,
          threshold: a.threshold_crossed,
        })),
        status: 'failed',
        error_message: emailError.message,
      });

      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    console.log('Threshold alert email sent successfully:', emailData?.id);

    // Update each document's alert_thresholds_sent array
    for (const alert of alertsToSend) {
      const updatedThresholds = [...alert.alert_thresholds_sent, alert.threshold_crossed];
      
      const { error: updateError } = await supabase
        .from('employee_documents')
        .update({ alert_thresholds_sent: updatedThresholds })
        .eq('id', alert.id);

      if (updateError) {
        console.error(`Failed to update threshold tracking for doc ${alert.id}:`, updateError);
      }
    }

    // Log successful notification
    await supabase.from('email_notification_logs').insert({
      notification_type: 'document_threshold_alert',
      recipient_email: settings.recipient_email,
      subject: subject,
      documents_included: alertsToSend.map(a => ({
        id: a.id,
        type: a.document_type,
        employee: a.employee_name,
        threshold: a.threshold_crossed,
        days_remaining: a.days_until_expiry,
      })),
      status: 'sent',
      resend_email_id: emailData?.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent threshold alerts for ${alertsToSend.length} documents`,
        alerts: alertsToSend.map(a => ({
          employee: a.employee_name,
          document: a.document_type,
          threshold: a.threshold_crossed,
          days: a.days_until_expiry,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in threshold alerts function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
