-- Rollback for 20260731000004_backfill_employee_leave_balances.sql
--
-- Removes the annual/sick rows the backfill created.
--
-- WARNING: this cannot tell a backfilled row from one the application has since
-- updated, so any annual/sick activity recorded after the backfill is discarded
-- from this table. The legacy leave_balances.annual_*/sick_* columns are
-- dual-written by the app and remain the accurate fallback, so no figure is
-- actually lost — re-running the backfill restores them.

DELETE FROM employee_leave_balances
WHERE leave_type_slug IN ('annual', 'sick');
