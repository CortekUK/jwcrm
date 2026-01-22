-- Migration: Setup pg_cron for quarterly KPI notifications
-- Description: Creates scheduled job to trigger KPI notifications Edge Function at end of each quarter
--
-- PREREQUISITES (must be done in Supabase Dashboard BEFORE running this migration):
-- 1. Enable pg_cron extension: Database > Extensions > pg_cron
-- 2. Enable pg_net extension: Database > Extensions > pg_net
-- 3. Vault secrets should already be configured from document expiry notifications

-- Create function to check if it's time to send KPI notifications and invoke Edge Function
CREATE OR REPLACE FUNCTION invoke_kpi_quarterly_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  settings_record JSONB;
  current_time_in_tz TEXT;
  current_day INTEGER;
  current_month INTEGER;
  scheduled_time TEXT;
  tz TEXT;
  days_before INTEGER;
  quarter_end_day INTEGER;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Get KPI notification settings
  SELECT setting_value INTO settings_record
  FROM system_settings
  WHERE setting_key = 'hr_kpi_notifications';

  -- If no settings found or notifications disabled, exit
  IF settings_record IS NULL OR NOT (settings_record->>'enabled')::boolean THEN
    RAISE NOTICE 'KPI notifications are disabled or not configured';
    RETURN;
  END IF;

  -- Get timezone and scheduled time from settings
  tz := COALESCE(settings_record->>'timezone', 'Asia/Dubai');
  scheduled_time := COALESCE(settings_record->>'send_time', '09:00');
  days_before := COALESCE((settings_record->>'days_before_quarter_end')::integer, 7);

  -- Get current time in configured timezone
  current_time_in_tz := to_char(now() AT TIME ZONE tz, 'HH24:MI');
  current_day := EXTRACT(DAY FROM now() AT TIME ZONE tz)::integer;
  current_month := EXTRACT(MONTH FROM now() AT TIME ZONE tz)::integer;

  -- Check if current hour matches scheduled hour
  IF LEFT(current_time_in_tz, 2) != LEFT(scheduled_time, 2) THEN
    RAISE NOTICE 'Not scheduled time. Current: %, Scheduled: %', current_time_in_tz, scheduled_time;
    RETURN;
  END IF;

  -- Quarter end months: March(3), June(6), September(9), December(12)
  -- Only trigger in quarter-end months
  IF current_month NOT IN (3, 6, 9, 12) THEN
    RAISE NOTICE 'Not a quarter-end month. Current month: %', current_month;
    RETURN;
  END IF;

  -- Get last day of current month (quarter end day)
  SELECT EXTRACT(DAY FROM (DATE_TRUNC('month', now() AT TIME ZONE tz) + INTERVAL '1 month - 1 day'))::integer
  INTO quarter_end_day;

  -- Check if we're within the notification window (last X days of quarter)
  IF current_day < (quarter_end_day - days_before) THEN
    RAISE NOTICE 'Not within notification window. Current day: %, Window starts: %', current_day, (quarter_end_day - days_before);
    RETURN;
  END IF;

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
    url := supabase_url || '/functions/v1/send-kpi-quarterly-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'trigger', 'cron',
      'timestamp', now()
    )
  );

  RAISE NOTICE 'KPI quarterly notifications triggered at %', now();
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION invoke_kpi_quarterly_notifications() IS
  'Checks if it is end of quarter and time to send KPI notifications, then invokes the Edge Function via HTTP';

-- Schedule the cron job to run every hour at minute 0
-- The function internally checks if it's the configured time and quarter-end
SELECT cron.schedule(
  'kpi-quarterly-notifications',  -- job name
  '0 * * * *',                    -- run at minute 0 of every hour
  'SELECT invoke_kpi_quarterly_notifications()'
);

-- Log that the job was scheduled
DO $$
BEGIN
  RAISE NOTICE 'Cron job "kpi-quarterly-notifications" scheduled to run hourly';
END $$;
