-- Rollback: 20260105000004_add_job_role_to_employees.sql
-- This removes the job_role_id column from employees

-- Drop index
DROP INDEX IF EXISTS idx_employees_job_role;

-- Remove column
ALTER TABLE employees DROP COLUMN IF EXISTS job_role_id;

-- Note: This does NOT restore job_title values that may have been modified
-- The original job_title column is preserved during migration
