-- FULL ROLLBACK: All KPI-related tables and features
-- WARNING: This will delete ALL KPI data permanently!
-- Run these in order if you need to completely remove the KPI feature

-- 1. Unschedule cron job
SELECT cron.unschedule('kpi-quarterly-notifications');

-- 2. Drop the cron function
DROP FUNCTION IF EXISTS invoke_kpi_quarterly_notifications();

-- 3. Remove KPI settings
DELETE FROM system_settings WHERE setting_key = 'hr_kpi_notifications';

-- 4. Drop kpi_evaluations table (depends on kpis and employees)
DROP POLICY IF EXISTS "HR can view kpi_evaluations" ON kpi_evaluations;
DROP POLICY IF EXISTS "HR can insert kpi_evaluations" ON kpi_evaluations;
DROP POLICY IF EXISTS "HR can update kpi_evaluations" ON kpi_evaluations;
DROP POLICY IF EXISTS "HR can delete kpi_evaluations" ON kpi_evaluations;
DROP INDEX IF EXISTS idx_kpi_evaluations_employee;
DROP INDEX IF EXISTS idx_kpi_evaluations_kpi;
DROP INDEX IF EXISTS idx_kpi_evaluations_year_month;
DROP INDEX IF EXISTS idx_kpi_evaluations_status;
DROP TABLE IF EXISTS kpi_evaluations CASCADE;

-- 5. Remove job_role_id from employees
DROP INDEX IF EXISTS idx_employees_job_role;
ALTER TABLE employees DROP COLUMN IF EXISTS job_role_id;

-- 6. Drop kpis table (depends on job_roles)
DROP POLICY IF EXISTS "HR can view kpis" ON kpis;
DROP POLICY IF EXISTS "HR can insert kpis" ON kpis;
DROP POLICY IF EXISTS "HR can update kpis" ON kpis;
DROP POLICY IF EXISTS "HR can delete kpis" ON kpis;
DROP INDEX IF EXISTS idx_kpis_job_role;
DROP TABLE IF EXISTS kpis CASCADE;

-- 7. Drop job_roles table
DROP POLICY IF EXISTS "HR can view job_roles" ON job_roles;
DROP POLICY IF EXISTS "HR can insert job_roles" ON job_roles;
DROP POLICY IF EXISTS "HR can update job_roles" ON job_roles;
DROP POLICY IF EXISTS "HR can delete job_roles" ON job_roles;
DROP INDEX IF EXISTS idx_job_roles_department;
DROP TABLE IF EXISTS job_roles CASCADE;

-- Note: Enum values (kpi_quarterly_report, kpi_incomplete_reminder) cannot be removed
-- They will remain in the notification_type enum but be unused
