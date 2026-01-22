-- Migration: Setup pg_cron for automated document expiry notifications
-- Description: Creates scheduled job to trigger the document expiry digest Edge Function
--
-- PREREQUISITES (must be done in Supabase Dashboard BEFORE running this migration):
-- 1. Enable pg_cron extension: Database > Extensions > pg_cron
-- 2. Enable pg_net extension: Database > Extensions > pg_net
-- 3. Note your project URL and service role key from Settings > API
--
-- After running this migration, you need to manually set the secrets:
-- SELECT vault.create_secret('supabase_url', 'https://your-project.supabase.co');
-- SELECT vault.create_secret('service_role_key', 'your-service-role-key');

-- Create function to check if it's time to send notifications and invoke Edge Function
CREATE OR REPLACE FUNCTION invoke_document_expiry_notifications()
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
  -- Get notification settings
  SELECT setting_value INTO settings_record
  FROM system_settings
  WHERE setting_key = 'hr_document_notifications';

  -- If no settings found or notifications disabled, exit
  IF settings_record IS NULL OR NOT (settings_record->>'enabled')::boolean THEN
    RAISE NOTICE 'Document expiry notifications are disabled or not configured';
    RETURN;
  END IF;

  -- Get timezone and scheduled time from settings
  tz := COALESCE(settings_record->>'timezone', 'Asia/Dubai');
  scheduled_time := COALESCE(settings_record->>'send_time', '08:00');

  -- Get current time in configured timezone
  current_time_in_tz := to_char(now() AT TIME ZONE tz, 'HH24:MI');

  -- Check if current hour matches scheduled hour (compare just the hour)
  IF LEFT(current_time_in_tz, 2) != LEFT(scheduled_time, 2) THEN
    RAISE NOTICE 'Not scheduled time. Current: %, Scheduled: %', current_time_in_tz, scheduled_time;
    RETURN;
  END IF;

  -- Get secrets from vault (you need to set these up)
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
    url := supabase_url || '/functions/v1/send-document-expiry-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );

  RAISE NOTICE 'Document expiry notification triggered at %', now();
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION invoke_document_expiry_notifications() IS
  'Checks if it is time to send document expiry notifications and invokes the Edge Function via HTTP';

-- Schedule the cron job to run every hour at minute 0
-- The function internally checks if it's the configured time to send
-- This is done because pg_cron doesn't support dynamic scheduling
SELECT cron.schedule(
  'document-expiry-notifications',  -- job name
  '0 * * * *',                      -- run at minute 0 of every hour
  'SELECT invoke_document_expiry_notifications()'
);

-- Log that the job was scheduled
DO $$
BEGIN
  RAISE NOTICE 'Cron job "document-expiry-notifications" scheduled to run hourly';
END $$;
