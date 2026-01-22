-- Migration: Setup cron job for proposal follow-up reminders
-- Created: 2026-01-22
-- Description: Creates a cron job that runs every 5 minutes to send 6-hour follow-up emails
--              for unpaid proposals. Only calls Edge Function when there are proposals to process.

-- Create a function to check and process proposal follow-ups efficiently
-- This avoids calling the Edge Function when there are no proposals needing follow-up
CREATE OR REPLACE FUNCTION process_proposal_followups()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  pending_count INTEGER;
BEGIN
  -- Check if there are any sent proposals that need follow-up
  -- Criteria: status='sent', sent 6+ hours ago, no follow-up sent yet, has payment link
  SELECT COUNT(*) INTO pending_count
  FROM proposals
  WHERE status = 'sent'
    AND followup_sent_at IS NULL
    AND stripe_payment_link IS NOT NULL
    AND sent_at <= NOW() - INTERVAL '6 hours';

  -- Only call the Edge Function if there are proposals to process
  IF pending_count > 0 THEN
    PERFORM net.http_post(
      url := 'https://gyikimtqsasryewwawgs.supabase.co/functions/v1/send-proposal-followups',
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
COMMENT ON FUNCTION process_proposal_followups() IS 'Checks for proposals needing 6-hour follow-up and triggers the Edge Function only when needed';

-- Schedule cron job to run every 5 minutes
-- This is frequent enough to catch proposals promptly after the 6-hour window
SELECT cron.schedule(
  'send-proposal-followups',
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT process_proposal_followups();'
);
