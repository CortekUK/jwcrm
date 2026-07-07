-- Migration: Employee self-service foundation
-- Created: 2026-07-07
-- Client request: employees log in themselves; login drives attendance; and
-- employees submit their own leave.
--
-- Employees are NOT a separate role — they are the existing staff who already
-- log in (admin / hr / finance / lead_management / salesperson). So we simply
-- link each employee record to its existing auth user by email, and self-service
-- attendance/leave is keyed off that link.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_id
  ON employees(user_id)
  WHERE user_id IS NOT NULL;

-- Backfill the link from matching emails (case-insensitive).
UPDATE employees e
SET user_id = u.id
FROM auth.users u
WHERE e.user_id IS NULL
  AND lower(u.email) = lower(e.email);

COMMENT ON COLUMN employees.user_id IS 'Linked auth user (matched by email) for employee self-service: login-driven attendance and leave requests';
