-- Migration: backfill employee_leave_balances from the legacy leave_balances columns
--
-- Copies every existing row's annual_* figures into leave_type_slug = 'annual'
-- and its sick_* figures into leave_type_slug = 'sick'.
--
-- Idempotent: ON CONFLICT DO NOTHING on the (employee_id, year, leave_type_slug)
-- unique constraint, so re-running it will never duplicate or overwrite a row
-- that the application has since updated.
--
-- SAFETY: reads leave_balances only. No column on it is dropped, renamed or altered.

INSERT INTO employee_leave_balances (employee_id, year, leave_type_slug, entitled, used, pending)
SELECT
    lb.employee_id,
    lb.year,
    'annual',
    COALESCE(lb.annual_entitled, 30),
    COALESCE(lb.annual_used, 0),
    COALESCE(lb.annual_pending, 0)
FROM leave_balances lb
ON CONFLICT (employee_id, year, leave_type_slug) DO NOTHING;

-- leave_balances has no sick_pending column, so pending starts at 0 for sick.
INSERT INTO employee_leave_balances (employee_id, year, leave_type_slug, entitled, used, pending)
SELECT
    lb.employee_id,
    lb.year,
    'sick',
    COALESCE(lb.sick_entitled, 90),
    COALESCE(lb.sick_used, 0),
    0
FROM leave_balances lb
ON CONFLICT (employee_id, year, leave_type_slug) DO NOTHING;
