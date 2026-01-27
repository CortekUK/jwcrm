-- Migration: Set up cron job for document threshold alerts
-- Description: Schedule daily execution of the threshold alerts edge function

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create the function to invoke the threshold alerts edge function
CREATE OR REPLACE FUNCTION invoke_document_threshold_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  response_status integer;
  response_body text;
BEGIN
  -- Get the Supabase project URL from environment or use a placeholder
  -- The actual URL will be set in the Edge Function environment
  
  -- Make HTTP request to the Edge Function
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-document-threshold-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) INTO request_id;
    
  -- Log the invocation
  RAISE NOTICE 'Document threshold alerts function invoked, request_id: %', request_id;
  
EXCEPTION WHEN OTHERS THEN
  -- Log any errors but don't fail
  RAISE WARNING 'Error invoking threshold alerts: %', SQLERRM;
END;
$$;

-- Schedule the cron job to run daily at 8:00 AM UTC
-- This will check all documents and send alerts for any that have crossed a threshold
SELECT cron.schedule(
  'document-threshold-alerts-daily',
  '0 8 * * *',  -- Run at 8:00 AM UTC every day
  $$SELECT invoke_document_threshold_alerts()$$
);

-- Add comment for documentation
COMMENT ON FUNCTION invoke_document_threshold_alerts() IS 
'Invokes the send-document-threshold-alerts Edge Function to send alerts for documents reaching expiry thresholds (90, 60, 30, 14, 7 days)';

-- Note: The cron job can be manually triggered for testing:
-- SELECT invoke_document_threshold_alerts();

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('document-threshold-alerts-daily');
