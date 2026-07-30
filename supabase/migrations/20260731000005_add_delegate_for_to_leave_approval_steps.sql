-- Migration: record delegated approvals on the leave approval audit trail
-- Description:
--   `leave_approval_delegations` lets an approver hand their authority to
--   somebody else while they are away. When the delegate acts, the audit trail
--   must show BOTH who clicked (approver_id / response_by) and whose authority
--   they were exercising. `leave_approval_steps` had nowhere to put the latter.
--
--   Additive only: one nullable column plus an index. No existing column is
--   dropped, renamed or altered, and no existing row changes meaning
--   (delegate_for IS NULL == acted in their own right, which is what every
--   pre-existing row was).

ALTER TABLE leave_approval_steps
    ADD COLUMN IF NOT EXISTS delegate_for UUID REFERENCES auth.users(id);

COMMENT ON COLUMN leave_approval_steps.delegate_for IS
    'When the acting approver was standing in under an active leave_approval_delegations row, the user id of the approver they acted for. NULL = acted in their own right.';

-- Lets HR answer "what did person X approve on my behalf?" without a seq scan.
CREATE INDEX IF NOT EXISTS idx_leave_approval_steps_delegate_for
    ON leave_approval_steps(delegate_for)
    WHERE delegate_for IS NOT NULL;
