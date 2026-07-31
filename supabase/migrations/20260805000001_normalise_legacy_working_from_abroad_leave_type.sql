-- Normalise the legacy leave_requests.leave_type spelling "working_from_abroad".
--
-- leave_type used to be an enum and was converted to TEXT (driven by the
-- leave_types table). The existing row values were never rewritten, so both
-- "working_abroad" (the slug in leave_types) and "working_from_abroad" (legacy,
-- no matching leave_types row) exist in the data. Anything that filters or
-- groups on the slug therefore sees only part of the data.
--
-- Idempotent: the UPDATE matches nothing once it has run, and the backup insert
-- is skipped for ids already recorded.

-- Record which rows were rewritten so the change can be reversed exactly
CREATE TABLE IF NOT EXISTS leave_requests_legacy_leave_type_backup (
  leave_request_id uuid PRIMARY KEY,
  old_leave_type text NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO leave_requests_legacy_leave_type_backup (leave_request_id, old_leave_type)
SELECT id, leave_type
FROM leave_requests
WHERE leave_type = 'working_from_abroad'
ON CONFLICT (leave_request_id) DO NOTHING;

UPDATE leave_requests
SET leave_type = 'working_abroad'
WHERE leave_type = 'working_from_abroad';
