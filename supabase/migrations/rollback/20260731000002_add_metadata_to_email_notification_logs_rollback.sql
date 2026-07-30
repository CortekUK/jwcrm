-- Rollback for 20260731000001_add_metadata_to_email_notification_logs.sql

ALTER TABLE email_notification_logs
  DROP COLUMN IF EXISTS metadata;
