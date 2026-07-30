-- Rollback for 20260802000001_add_document_threshold_alert_notification_type.sql
--
-- NOTE: Postgres has no `ALTER TYPE ... DROP VALUE`. An enum value can only be
-- removed by recreating the type, which means dropping and re-adding every
-- column that uses it. That is not worth doing for an additive value that
-- nothing else depends on, so this rollback deliberately does NOT remove
-- 'document_threshold_alert' from the enum — leaving it in place is harmless.
--
-- What it does instead is remove the rows the feature produced, so the
-- Threshold Alert History card and the EmailLogsTable filter go back to being
-- empty, and restore the enum comment.

DELETE FROM email_notification_logs
WHERE notification_type = 'document_threshold_alert';

COMMENT ON TYPE notification_type IS
  'Types of email notifications: document_expiry_digest, individual_reminder, leave_approval, leave_denial, kpi_quarterly_report, kpi_incomplete_reminder, kpi_monthly_reminder';

-- If the enum value genuinely must go, do it manually and standalone:
--   ALTER TABLE email_notification_logs ALTER COLUMN notification_type TYPE text;
--   DROP TYPE notification_type;
--   CREATE TYPE notification_type AS ENUM (... original values ...);
--   ALTER TABLE email_notification_logs
--     ALTER COLUMN notification_type TYPE notification_type
--     USING notification_type::notification_type;
