-- Rollback: 20260105000005_add_kpi_notification_types.sql
-- NOTE: PostgreSQL does not support removing enum values directly
--
-- If you need to fully remove these enum values, you would need to:
-- 1. Create a new enum type without these values
-- 2. Update all tables using the enum
-- 3. Drop the old enum and rename the new one
--
-- For now, the enum values will remain but be unused.
-- This is a known PostgreSQL limitation.

-- Document that these enum values are deprecated
COMMENT ON TYPE notification_type IS 'Types of email notifications. Note: kpi_quarterly_report and kpi_incomplete_reminder may be deprecated if KPI feature is rolled back';
