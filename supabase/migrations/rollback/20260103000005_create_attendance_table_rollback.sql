-- Rollback: Create attendance table
-- Run this to undo the migration

-- Drop policies first
DROP POLICY IF EXISTS "HR can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Admin can manage attendance" ON attendance;

-- Drop indexes
DROP INDEX IF EXISTS idx_attendance_employee_id;
DROP INDEX IF EXISTS idx_attendance_date;
DROP INDEX IF EXISTS idx_attendance_status;

-- Drop the table
DROP TABLE IF EXISTS attendance;

-- Drop the enum type
DROP TYPE IF EXISTS attendance_status;
