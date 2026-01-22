-- Rollback: 20260105000001_create_job_roles_table.sql
-- WARNING: This will delete all job roles data!

-- Drop policies first
DROP POLICY IF EXISTS "HR can view job_roles" ON job_roles;
DROP POLICY IF EXISTS "HR can insert job_roles" ON job_roles;
DROP POLICY IF EXISTS "HR can update job_roles" ON job_roles;
DROP POLICY IF EXISTS "HR can delete job_roles" ON job_roles;

-- Drop index
DROP INDEX IF EXISTS idx_job_roles_department;

-- Drop table
DROP TABLE IF EXISTS job_roles CASCADE;
