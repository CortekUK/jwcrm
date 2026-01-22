-- Rollback: Create leave_balances table
-- Run this to undo the migration

-- Drop policies first
DROP POLICY IF EXISTS "HR can manage leave_balances" ON leave_balances;
DROP POLICY IF EXISTS "Admin can manage leave_balances" ON leave_balances;

-- Drop indexes
DROP INDEX IF EXISTS idx_leave_balances_employee_id;
DROP INDEX IF EXISTS idx_leave_balances_year;

-- Drop the table
DROP TABLE IF EXISTS leave_balances;
