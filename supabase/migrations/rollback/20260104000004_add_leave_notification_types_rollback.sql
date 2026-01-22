-- Rollback: Remove leave notification types from notification_type enum
-- Note: PostgreSQL doesn't support removing enum values directly
-- This would require recreating the enum, which is complex if data exists

-- If no data references these values, you could:
-- 1. Delete rows with these notification_types
-- 2. Recreate the enum without these values
-- 3. Update the column to use the new enum

-- For safety, this rollback is a no-op
-- Manual intervention required if rollback is needed

SELECT 'Manual intervention required to rollback enum changes' AS warning;
