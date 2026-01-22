-- ROLLBACK: Remove employee_documents table
-- Run this if you need to revert the employee_documents migration

-- Drop policies first
DROP POLICY IF EXISTS "HR can view employee documents" ON employee_documents;
DROP POLICY IF EXISTS "HR can insert employee documents" ON employee_documents;
DROP POLICY IF EXISTS "HR can update employee documents" ON employee_documents;
DROP POLICY IF EXISTS "HR can delete employee documents" ON employee_documents;

-- Drop indexes
DROP INDEX IF EXISTS idx_employee_documents_expiry;
DROP INDEX IF EXISTS idx_employee_documents_employee;

-- Drop the table
DROP TABLE IF EXISTS employee_documents;
