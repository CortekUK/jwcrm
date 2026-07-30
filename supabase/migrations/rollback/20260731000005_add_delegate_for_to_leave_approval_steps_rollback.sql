-- Rollback for 20260731000005_add_delegate_for_to_leave_approval_steps.sql
-- WARNING: this DESTROYS the record of which approvals were made under a
-- delegation. Only run it if you are reverting the multi-step approval feature.
--
-- Kept in supabase/migrations/rollback/ on purpose: a rollback file sitting in
-- the migrations root gets picked up by the migration sweep and immediately
-- undoes its own migration.

DROP INDEX IF EXISTS idx_leave_approval_steps_delegate_for;

ALTER TABLE leave_approval_steps
    DROP COLUMN IF EXISTS delegate_for;
