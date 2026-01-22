-- ROLLBACK: Remove departments table
-- Run this if you need to revert the departments migration

-- Drop policies first
DROP POLICY IF EXISTS "HR can view departments" ON departments;
DROP POLICY IF EXISTS "HR can insert departments" ON departments;
DROP POLICY IF EXISTS "HR can delete departments" ON departments;

-- Drop the table (this will fail if employees table exists with references)
-- You must run rollback_employees first if it exists
DROP TABLE IF EXISTS departments CASCADE;

-- Note: CASCADE will also drop any dependent objects
