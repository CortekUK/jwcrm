-- Rollback: 20260105000007_setup_kpi_cron_notifications.sql
-- Remove the KPI quarterly notifications cron job

-- Unschedule the cron job
SELECT cron.unschedule('kpi-quarterly-notifications');

-- Drop the function
DROP FUNCTION IF EXISTS invoke_kpi_quarterly_notifications();
