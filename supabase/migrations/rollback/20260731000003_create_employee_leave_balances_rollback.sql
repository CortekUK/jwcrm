-- Rollback for 20260731000003_create_employee_leave_balances.sql
--
-- Drops the per-leave-type balance table. The legacy leave_balances columns are
-- untouched by both the forward migration and this rollback, so annual/sick
-- balances survive intact and the app degrades back to reading those columns.
--
-- Balances for CUSTOM leave types exist only in this table and are lost.

DROP INDEX IF EXISTS idx_employee_leave_balances_year_slug;
DROP INDEX IF EXISTS idx_employee_leave_balances_employee_year;
DROP TABLE IF EXISTS employee_leave_balances;
