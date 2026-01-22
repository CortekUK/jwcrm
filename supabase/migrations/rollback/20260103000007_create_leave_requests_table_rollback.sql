-- Rollback: Create leave_requests table
-- Run this to undo the migration

-- Drop policies first
DROP POLICY IF EXISTS "HR can manage leave_requests" ON leave_requests;
DROP POLICY IF EXISTS "Admin can manage leave_requests" ON leave_requests;

-- Drop indexes
DROP INDEX IF EXISTS idx_leave_requests_employee_id;
DROP INDEX IF EXISTS idx_leave_requests_status;
DROP INDEX IF EXISTS idx_leave_requests_start_date;
DROP INDEX IF EXISTS idx_leave_requests_leave_type;

-- Drop the table
DROP TABLE IF EXISTS leave_requests;

-- Drop the enum types
DROP TYPE IF EXISTS leave_request_status;
DROP TYPE IF EXISTS leave_type;
