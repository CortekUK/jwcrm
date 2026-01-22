-- Migration: Setup lead reminder cron job
-- Created: 2026-01-21
-- Description: Creates a cron job to process lead reminders every 5 minutes

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create the cron job to process lead reminders every 5 minutes
-- Note: Update the URL and API key based on your environment
SELECT cron.schedule(
  'send-lead-reminders',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://gyikimtqsasryewwawgs.supabase.co/functions/v1/send-lead-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aWtpbXRxc2Fzcnlld3dhd2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzkzMDUsImV4cCI6MjA3NTAxNTMwNX0.IhOHh-vkpo8ssA2ktOiP7sGQshXMU2WqNhL_BFxFU7c'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) AS request_id;
  $$
);

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for Postgres - used for lead reminder notifications';
