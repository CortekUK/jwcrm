-- Migration: Optimize lead reminder cron job
-- Created: 2026-01-21
-- Description: Optimizes the cron job to only call Edge Function when there are pending reminders

-- Create a function to check and process reminders efficiently
-- This avoids calling the Edge Function when there are no reminders due
CREATE OR REPLACE FUNCTION process_lead_reminders()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pending_count INTEGER;
BEGIN
  -- Check if there are any pending reminders that are due
  SELECT COUNT(*) INTO pending_count
  FROM lead_reminders
  WHERE status = 'pending' AND remind_at <= NOW();

  -- Only call the Edge Function if there are reminders to process
  IF pending_count > 0 THEN
    PERFORM net.http_post(
      url := 'https://gyikimtqsasryewwawgs.supabase.co/functions/v1/send-lead-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aWtpbXRxc2Fzcnlld3dhd2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzkzMDUsImV4cCI6MjA3NTAxNTMwNX0.IhOHh-vkpo8ssA2ktOiP7sGQshXMU2WqNhL_BFxFU7c'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  END IF;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION process_lead_reminders() IS 'Checks for pending lead reminders and triggers the Edge Function only when needed';

-- Unschedule the old cron job
SELECT cron.unschedule('send-lead-reminders');

-- Create new optimized cron job that runs every minute
-- but only calls the Edge Function when there are pending reminders
SELECT cron.schedule(
  'send-lead-reminders',
  '* * * * *',  -- Every minute for near real-time notifications
  'SELECT process_lead_reminders();'
);
