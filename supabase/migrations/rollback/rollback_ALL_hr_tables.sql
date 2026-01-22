-- ROLLBACK ALL: Remove all HR employee management tables
-- Run this to completely revert all HR-related schema changes
-- Execute this single file to undo everything

-- =============================================
-- STEP 1: Drop employee_documents table first
-- =============================================
DROP POLICY IF EXISTS "HR can view employee documents" ON employee_documents;
DROP POLICY IF EXISTS "HR can insert employee documents" ON employee_documents;
DROP POLICY IF EXISTS "HR can update employee documents" ON employee_documents;
DROP POLICY IF EXISTS "HR can delete employee documents" ON employee_documents;
DROP INDEX IF EXISTS idx_employee_documents_expiry;
DROP INDEX IF EXISTS idx_employee_documents_employee;
DROP TABLE IF EXISTS employee_documents;

-- =============================================
-- STEP 2: Drop employees table second
-- =============================================
DROP POLICY IF EXISTS "HR can view employees" ON employees;
DROP POLICY IF EXISTS "HR can insert employees" ON employees;
DROP POLICY IF EXISTS "HR can update employees" ON employees;
DROP POLICY IF EXISTS "HR can delete employees" ON employees;
DROP INDEX IF EXISTS idx_employees_department;
DROP INDEX IF EXISTS idx_employees_status;
DROP INDEX IF EXISTS idx_employees_manager;
DROP TABLE IF EXISTS employees;

-- =============================================
-- STEP 3: Drop departments table last
-- =============================================
DROP POLICY IF EXISTS "HR can view departments" ON departments;
DROP POLICY IF EXISTS "HR can insert departments" ON departments;
DROP POLICY IF EXISTS "HR can delete departments" ON departments;
DROP TABLE IF EXISTS departments;

-- =============================================
-- VERIFICATION: Check tables are removed
-- =============================================
-- Run this query to verify:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('departments', 'employees', 'employee_documents');
-- Should return 0 rows if rollback successful
