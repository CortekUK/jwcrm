-- Rollback for 20260731000006_set_leave_approval_plan_trigger.sql
--
-- Removes the BEFORE INSERT trigger that stamps the approval plan onto new
-- leave requests. Requests already stamped keep their approval_rule_id and
-- total_approval_steps — this only stops NEW requests from being stamped.
--
-- get_applicable_approval_rule is NOT dropped: it predates this migration
-- (20260128000004) and is not ours to remove.
--
-- Kept in supabase/migrations/rollback/ on purpose: a rollback file sitting in
-- the migrations root gets picked up by the migration sweep and immediately
-- undoes its own migration.

DROP TRIGGER IF EXISTS trg_set_leave_approval_plan ON leave_requests;
DROP FUNCTION IF EXISTS set_leave_approval_plan();
