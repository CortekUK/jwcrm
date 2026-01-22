-- Rollback: 20260105000002_create_kpis_table.sql
-- WARNING: This will delete all KPIs data!

-- Drop policies first
DROP POLICY IF EXISTS "HR can view kpis" ON kpis;
DROP POLICY IF EXISTS "HR can insert kpis" ON kpis;
DROP POLICY IF EXISTS "HR can update kpis" ON kpis;
DROP POLICY IF EXISTS "HR can delete kpis" ON kpis;

-- Drop index
DROP INDEX IF EXISTS idx_kpis_job_role;

-- Drop table
DROP TABLE IF EXISTS kpis CASCADE;
