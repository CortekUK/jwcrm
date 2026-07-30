-- Migration: stamp the approval plan onto every new leave request
-- Description:
--   `leave_requests.approval_rule_id` and `total_approval_steps` have existed
--   since 20260128000004 but had ZERO writers, so every reader fell back to
--   `|| 1` and the whole multi-step chain collapsed to a single step.
--
--   The application now writes them (src/lib/hr/leaveApproval.ts), but leave
--   requests are inserted from several places (HR page, /api/hr/leave/self, and
--   anything added later). This BEFORE INSERT trigger makes the plan a property
--   of the row rather than of the code path that created it.
--
--   It is deliberately a no-op when the caller already supplied a plan, so the
--   application-side initialisation and this trigger cannot fight each other.
--
--   Existing rows are NOT backfilled. Requests already in flight keep
--   approval_rule_id = NULL and are treated as single-step by every reader, so
--   nothing pending today changes behaviour.

-- get_applicable_approval_rule (20260128000004) is reused as-is: its matching
-- (active, leave_type NULL = all types, min/max day window, leave-type-specific
-- rules ahead of generic ones, then priority ASC) is correct.

CREATE OR REPLACE FUNCTION set_leave_approval_plan()
RETURNS TRIGGER AS $$
DECLARE
    v_rule_id UUID;
    v_steps INTEGER;
BEGIN
    -- Caller already decided the plan (or this is a legacy import): leave it be.
    IF NEW.approval_rule_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    v_rule_id := get_applicable_approval_rule(NEW.leave_type::text, NEW.total_days);

    -- No rule matches: fall through as a single-step request, exactly like
    -- everything created before this feature existed.
    IF v_rule_id IS NULL THEN
        NEW.current_approval_step := COALESCE(NEW.current_approval_step, 1);
        NEW.total_approval_steps := COALESCE(NEW.total_approval_steps, 1);
        RETURN NEW;
    END IF;

    SELECT (
        CASE WHEN COALESCE(requires_manager_approval, false) THEN 1 ELSE 0 END
      + CASE WHEN COALESCE(requires_hr_approval, false) THEN 1 ELSE 0 END
      + CASE WHEN COALESCE(requires_director_approval, false) THEN 1 ELSE 0 END
    )
    INTO v_steps
    FROM leave_approval_rules
    WHERE id = v_rule_id;

    -- A rule with every switch off still needs a human; treat it as one step
    -- rather than letting the request auto-complete with nobody signing off.
    IF v_steps IS NULL OR v_steps < 1 THEN
        v_steps := 1;
    END IF;

    NEW.approval_rule_id := v_rule_id;
    NEW.total_approval_steps := v_steps;
    NEW.current_approval_step := 1;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_leave_approval_plan ON leave_requests;
CREATE TRIGGER trg_set_leave_approval_plan
    BEFORE INSERT ON leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_leave_approval_plan();

COMMENT ON FUNCTION set_leave_approval_plan() IS
    'BEFORE INSERT on leave_requests: resolves the applicable leave_approval_rules row and stamps approval_rule_id / total_approval_steps / current_approval_step. No-op when the caller already set approval_rule_id.';
