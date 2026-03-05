-- Migration: Setup pg_cron for monthly KPI notifications
-- Description: Creates scheduled job to trigger monthly KPI notifications Edge Function
--              when 7 days are left before the end of each month
--
-- PREREQUISITES (must be done in Supabase Dashboard BEFORE running this migration):
-- 1. Enable pg_cron extension: Database > Extensions > pg_cron
-- 2. Enable pg_net extension: Database > Extensions > pg_net
-- 3. Vault secrets should already be configured from previous notification setups

-- Add monthly notification type to the enum if not exists
DO $$
BEGIN
  -- Check if the notification type already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'kpi_monthly_reminder'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kpi_monthly_reminder';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'kpi_monthly_reminder already exists in notification_type enum';
END $$;

-- Insert default settings for monthly KPI notifications
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
  'hr_kpi_monthly_notifications',
  '{
    "enabled": true,
    "send_time": "09:00",
    "timezone": "Asia/Dubai",
    "hr_recipient_email": "aw736024@gmail.com",
    "hr_recipient_name": "HR Manager",
    "days_before_month_end": 7
  }'::jsonb,
  'Configuration for monthly KPI evaluation reminder notifications to HR'
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = now();

-- Create function to check if it's time to send monthly KPI notifications and invoke Edge Function
CREATE OR REPLACE FUNCTION invoke_kpi_monthly_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  settings_record JSONB;
  current_time_in_tz TEXT;
  current_day INTEGER;
  last_day_of_month INTEGER;
  days_remaining INTEGER;
  scheduled_time TEXT;
  tz TEXT;
  days_before INTEGER;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Get KPI monthly notification settings
  SELECT setting_value INTO settings_record
  FROM system_settings
  WHERE setting_key = 'hr_kpi_monthly_notifications';

  -- If no settings found or notifications disabled, exit
  IF settings_record IS NULL OR NOT (settings_record->>'enabled')::boolean THEN
    RAISE NOTICE 'KPI monthly notifications are disabled or not configured';
    RETURN;
  END IF;

  -- Get timezone and scheduled time from settings
  tz := COALESCE(settings_record->>'timezone', 'Asia/Dubai');
  scheduled_time := COALESCE(settings_record->>'send_time', '09:00');
  days_before := COALESCE((settings_record->>'days_before_month_end')::integer, 7);

  -- Get current time in configured timezone
  current_time_in_tz := to_char(now() AT TIME ZONE tz, 'HH24:MI');
  current_day := EXTRACT(DAY FROM now() AT TIME ZONE tz)::integer;

  -- Check if current hour matches scheduled hour
  IF LEFT(current_time_in_tz, 2) != LEFT(scheduled_time, 2) THEN
    RAISE NOTICE 'Not scheduled time. Current: %, Scheduled: %', current_time_in_tz, scheduled_time;
    RETURN;
  END IF;

  -- Get last day of current month
  SELECT EXTRACT(DAY FROM (DATE_TRUNC('month', now() AT TIME ZONE tz) + INTERVAL '1 month - 1 day'))::integer
  INTO last_day_of_month;

  -- Calculate days remaining in month
  days_remaining := last_day_of_month - current_day;

  -- Check if we're within the notification window (last X days of month)
  IF days_remaining > days_before THEN
    RAISE NOTICE 'Not within notification window. Days remaining: %, Window starts when: % days left', days_remaining, days_before;
    RETURN;
  END IF;

  RAISE NOTICE 'Within notification window. Days remaining: %', days_remaining;

  -- Get secrets from vault
  BEGIN
    SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  EXCEPTION WHEN OTHERS THEN
    -- If vault is not set up, try environment variable approach
    supabase_url := current_setting('app.supabase_url', true);
    service_key := current_setting('app.service_role_key', true);
  END;

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'Supabase URL or service role key not configured. Please set up vault secrets.';
    RETURN;
  END IF;

  -- Call the Edge Function using pg_net
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-kpi-monthly-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'trigger', 'cron',
      'timestamp', now(),
      'days_remaining', days_remaining
    )
  );

  RAISE NOTICE 'KPI monthly notifications triggered at %', now();
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION invoke_kpi_monthly_notifications() IS
  'Checks if it is within the last 7 days of the month and time to send monthly KPI notifications, then invokes the Edge Function via HTTP';

-- Schedule the cron job to run every hour at minute 0
-- The function internally checks if it's the configured time and within the notification window
DO $$
BEGIN
  -- Unschedule if it already exists to avoid duplicate error
  PERFORM cron.unschedule('kpi-monthly-notifications');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist yet, that's fine
  NULL;
END $$;

SELECT cron.schedule(
  'kpi-monthly-notifications',  -- job name
  '0 * * * *',                  -- run at minute 0 of every hour
  'SELECT invoke_kpi_monthly_notifications()'
);

-- Log that the job was scheduled
DO $$
BEGIN
  RAISE NOTICE 'Cron job "kpi-monthly-notifications" scheduled to run hourly';
  RAISE NOTICE 'Notifications will be sent when 7 days or less are remaining in the month';
END $$;
