-- Migration: Setup pg_cron for leave analytics
-- Description: Creates scheduled job to trigger leave pattern analysis Edge Function every 2 days
--
-- PREREQUISITES (must be done in Supabase Dashboard BEFORE running this migration):
-- 1. Enable pg_cron extension: Database > Extensions > pg_cron
-- 2. Enable pg_net extension: Database > Extensions > pg_net
-- 3. Vault secrets should already be configured from previous notification setups

-- Add leave_analytics notification type to the enum if not exists
DO $$
BEGIN
  -- Check if the notification type already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'leave_analytics'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'leave_analytics';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'leave_analytics already exists in notification_type enum';
END $$;

-- Insert default settings for leave analytics
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
  'hr_leave_analytics',
  '{
    "enabled": true,
    "run_time": "06:00",
    "timezone": "Asia/Dubai",
    "analysis_period_months": 12
  }'::jsonb,
  'Configuration for GPT-based leave pattern analysis'
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = now();

-- Create function to invoke leave analytics Edge Function
CREATE OR REPLACE FUNCTION invoke_leave_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  settings_record JSONB;
  current_time_in_tz TEXT;
  scheduled_time TEXT;
  tz TEXT;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Get leave analytics settings
  SELECT setting_value INTO settings_record
  FROM system_settings
  WHERE setting_key = 'hr_leave_analytics';

  -- If no settings found or analytics disabled, exit
  IF settings_record IS NULL OR NOT (settings_record->>'enabled')::boolean THEN
    RAISE NOTICE 'Leave analytics are disabled or not configured';
    RETURN;
  END IF;

  -- Get timezone and scheduled time from settings
  tz := COALESCE(settings_record->>'timezone', 'Asia/Dubai');
  scheduled_time := COALESCE(settings_record->>'run_time', '06:00');

  -- Get current time in configured timezone
  current_time_in_tz := to_char(now() AT TIME ZONE tz, 'HH24:MI');

  -- Check if current hour matches scheduled hour
  IF LEFT(current_time_in_tz, 2) != LEFT(scheduled_time, 2) THEN
    RAISE NOTICE 'Not scheduled time. Current: %, Scheduled: %', current_time_in_tz, scheduled_time;
    RETURN;
  END IF;

  RAISE NOTICE 'Running leave analytics at %', current_time_in_tz;

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
    url := supabase_url || '/functions/v1/analyze-leave-patterns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'trigger', 'cron',
      'timestamp', now()
    )
  );

  RAISE NOTICE 'Leave analytics triggered at %', now();
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION invoke_leave_analytics() IS
  'Invokes the leave analytics Edge Function to analyze employee leave and attendance patterns using GPT';

-- Schedule the cron job to run every 2 days at 6 AM (Dubai time check is done in function)
-- Using "0 * */2 * *" means: minute 0, every hour, every 2nd day
-- The function internally checks if it's the configured time (6 AM Dubai)
SELECT cron.schedule(
  'leave-analytics',           -- job name
  '0 * */2 * *',               -- run at minute 0 of every hour, every 2 days
  'SELECT invoke_leave_analytics()'
);

-- Log that the job was scheduled
DO $$
BEGIN
  RAISE NOTICE 'Cron job "leave-analytics" scheduled to run every 2 days at 6 AM (Dubai time)';
  RAISE NOTICE 'GPT-based leave pattern analysis will detect:';
  RAISE NOTICE '  - Day-of-week patterns (Thursday/Friday syndrome)';
  RAISE NOTICE '  - Sick leave abuse indicators';
  RAISE NOTICE '  - Punctuality issues (chronic lateness)';
  RAISE NOTICE '  - Department anomalies';
  RAISE NOTICE '  - Coverage risks';
END $$;
