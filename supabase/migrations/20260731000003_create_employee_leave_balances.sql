-- Migration: create employee_leave_balances (per-leave-type balance tracking)
--
-- Why: `leave_balances` hard-codes one column pair per leave type
-- (annual_entitled/annual_used/annual_pending, sick_entitled/sick_used). HR can
-- create arbitrary leave types in `leave_types` with tracks_balance = true, but
-- there is no column to deduct from, so those writes were silently rejected.
--
-- This table stores one row per (employee, year, leave type slug), so ANY leave
-- type can track a balance.
--
-- SAFETY: the existing `leave_balances` table and every one of its columns are
-- left completely untouched. The application dual-writes annual/sick into both
-- tables so the legacy columns remain an accurate working fallback.

CREATE TABLE IF NOT EXISTS employee_leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,

    -- Matches leave_types.slug (and therefore leave_requests.leave_type).
    -- Intentionally NOT a foreign key: leave types can be archived/renamed and
    -- historic balances must survive that, exactly like leave_requests.leave_type.
    leave_type_slug TEXT NOT NULL,

    entitled NUMERIC(8, 2) NOT NULL DEFAULT 0,
    used NUMERIC(8, 2) NOT NULL DEFAULT 0,
    pending NUMERIC(8, 2) NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT employee_leave_balances_unique_per_type
        UNIQUE (employee_id, year, leave_type_slug)
);

-- Primary lookup: "all balances for this employee in this year"
CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_employee_year
    ON employee_leave_balances (employee_id, year);

-- Secondary lookup: "every employee's balance for this year" (balances page)
CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_year_slug
    ON employee_leave_balances (year, leave_type_slug);

-- RLS: match the sibling table. 20260128000005_disable_rls_policies.sql dropped
-- both leave_balances policies and ran
--   ALTER TABLE leave_balances DISABLE ROW LEVEL SECURITY;
-- Every leave balance read/write in the app goes through the browser anon client,
-- so enabling RLS here (without replicating that decision project-wide) would
-- break the pages this migration exists to support.
ALTER TABLE employee_leave_balances DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE employee_leave_balances IS
    'Per-leave-type yearly leave balances. Supersedes the fixed annual_*/sick_* columns on leave_balances, which are kept as a fallback and dual-written by the app.';
COMMENT ON COLUMN employee_leave_balances.leave_type_slug IS
    'leave_types.slug / leave_requests.leave_type. Not an FK so archived types keep their history.';
COMMENT ON COLUMN employee_leave_balances.entitled IS 'Total days granted for this leave type this year';
COMMENT ON COLUMN employee_leave_balances.used IS 'Days consumed by approved requests';
COMMENT ON COLUMN employee_leave_balances.pending IS 'Days reserved by pending requests';
