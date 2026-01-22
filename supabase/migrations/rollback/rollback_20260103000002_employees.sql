-- ROLLBACK: Remove employees table
-- Run this if you need to revert the employees migration

-- Drop policies first
DROP POLICY IF EXISTS "HR can view employees" ON employees;
DROP POLICY IF EXISTS "HR can insert employees" ON employees;
DROP POLICY IF EXISTS "HR can update employees" ON employees;
DROP POLICY IF EXISTS "HR can delete employees" ON employees;

-- Drop indexes
DROP INDEX IF EXISTS idx_employees_department;
DROP INDEX IF EXISTS idx_employees_status;
DROP INDEX IF EXISTS idx_employees_manager;

-- Drop the table (this will fail if employee_documents exists)
-- You must run rollback_employee_documents first if it exists
DROP TABLE IF EXISTS employees CASCADE;

-- Note: CASCADE will also drop any dependent objects including employee_documents
