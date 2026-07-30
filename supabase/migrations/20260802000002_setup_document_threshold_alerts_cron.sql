-- Migration: Schedule the document expiry threshold alerts job.
--
-- WHY THIS EXISTS
-- ---------------
-- No cron job for `send-document-threshold-alerts` has ever existed on this
-- project. `20260127000003_setup_threshold_alerts_cron.sql` defines
-- `invoke_document_threshold_alerts()` and calls `cron.schedule` on it, but the
-- schedule was never created here, and that helper reads
-- `current_setting('app.settings.supabase_url')` / `app.settings.service_role_key`
-- which are not set on this project — so even if it had been scheduled it would
-- have posted to `/functions/v1/...` with a NULL host. Every other working job
-- on this project posts the literal URL + anon key inline instead
-- (see 20260730000003_setup_lead_notification_crons.sql), so this follows that
-- shape rather than the broken helper.
--
-- SCHEDULE / SEND TIME
-- --------------------
-- The job runs every 15 minutes and the edge function no-ops unless the current
-- wall clock in the configured timezone falls in the 15-minute window starting
-- at the configured send time. That is what makes `send_time` / `timezone` in
-- system_settings -> 'hr_document_threshold_alerts' authoritative: the HR
-- Settings page governs when the alert goes out, and nothing has to rewrite the
-- cron schedule from application code.
--
-- This mirrors `flush-lead-notifications`, which is also `*/15` and also gates
-- itself on a time setting inside the function. A 15-minute tick (rather than
-- hourly) is what lets the minute component of `send_time` — the Settings page
-- exposes a full HH:MM time input — actually be honoured.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Idempotent: drop any previous schedule before recreating it.
SELECT cron.unschedule('send-document-threshold-alerts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-document-threshold-alerts');

-- Also retire the never-installed legacy name from 20260127000003 so the two
-- can never both be live and double-send.
SELECT cron.unschedule('document-threshold-alerts-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'document-threshold-alerts-daily');

SELECT cron.schedule(
  'send-document-threshold-alerts',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gyikimtqsasryewwawgs.supabase.co/functions/v1/send-document-threshold-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aWtpbXRxc2Fzcnlld3dhd2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzkzMDUsImV4cCI6MjA3NTAxNTMwNX0.IhOHh-vkpo8ssA2ktOiP7sGQshXMU2WqNhL_BFxFU7c'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

-- Keep the enum documentation honest now that 20260802000001 has landed.
COMMENT ON TYPE notification_type IS
  'Types of email notifications: document_expiry_digest, individual_reminder, leave_approval, leave_denial, kpi_quarterly_report, kpi_incomplete_reminder, kpi_monthly_reminder, document_threshold_alert';
