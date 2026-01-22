-- Rollback Migration: Drop email_notification_logs table
-- Run this to undo the 20260104000002_create_email_notification_logs_table migration

-- Drop the table (CASCADE will drop policies and indexes)
DROP TABLE IF EXISTS email_notification_logs CASCADE;

-- Drop the enum types
DROP TYPE IF EXISTS notification_status;
DROP TYPE IF EXISTS notification_type;
