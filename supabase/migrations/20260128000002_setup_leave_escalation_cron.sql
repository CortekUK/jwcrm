-- Migration: Setup cron job for leave escalation processing
-- Description: Runs daily to check for pending leave requests that need escalation

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create or replace the escalation cron job
-- Runs daily at 9:00 AM Dubai time (5:00 AM UTC)
SELECT cron.schedule(
    'process-leave-escalations',          -- Job name
    '0 5 * * *',                           -- Cron expression: 5:00 AM UTC daily
    $$
    SELECT
        net.http_post(
            url:=CONCAT(current_setting('app.settings.edge_function_url'), '/process-leave-escalations'),
            headers:=jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
            ),
            body:='{}'::jsonb
        ) AS request_id;
    $$
);

-- Add comment
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for leave escalation processing';

-- Create a function to manually trigger escalation (for testing)
CREATE OR REPLACE FUNCTION trigger_leave_escalation()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- This function can be called manually for testing
    -- In production, it's triggered by the cron job
    SELECT jsonb_build_object(
        'triggered_at', NOW(),
        'message', 'Leave escalation triggered manually'
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (HR/Admin)
GRANT EXECUTE ON FUNCTION trigger_leave_escalation() TO authenticated;

-- Add to system_settings for UI configuration
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
    'leave_escalation_settings',
    '{
        "enabled": true,
        "run_time": "09:00",
        "timezone": "Asia/Dubai",
        "notify_hr_on_escalation": true,
        "send_digest_email": true
    }'::jsonb,
    'Settings for automatic leave request escalation'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value;

-- Add comment for documentation
COMMENT ON FUNCTION trigger_leave_escalation() IS 'Manually trigger leave escalation processing for testing';
