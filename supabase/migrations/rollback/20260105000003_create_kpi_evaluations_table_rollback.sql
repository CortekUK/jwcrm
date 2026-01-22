-- Rollback: 20260105000003_create_kpi_evaluations_table.sql
-- WARNING: This will delete all KPI evaluation data!

-- Drop policies first
DROP POLICY IF EXISTS "HR can view kpi_evaluations" ON kpi_evaluations;
DROP POLICY IF EXISTS "HR can insert kpi_evaluations" ON kpi_evaluations;
DROP POLICY IF EXISTS "HR can update kpi_evaluations" ON kpi_evaluations;
DROP POLICY IF EXISTS "HR can delete kpi_evaluations" ON kpi_evaluations;

-- Drop indexes
DROP INDEX IF EXISTS idx_kpi_evaluations_employee;
DROP INDEX IF EXISTS idx_kpi_evaluations_kpi;
DROP INDEX IF EXISTS idx_kpi_evaluations_year_month;
DROP INDEX IF EXISTS idx_kpi_evaluations_status;

-- Drop table
DROP TABLE IF EXISTS kpi_evaluations CASCADE;
