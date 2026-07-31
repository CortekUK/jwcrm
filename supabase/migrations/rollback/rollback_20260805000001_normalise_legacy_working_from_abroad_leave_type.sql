-- Rollback for 20260805000001_normalise_legacy_working_from_abroad_leave_type.sql
--
-- Restores the exact rows that migration rewrote, using the ids it recorded.
-- Rows that already carried 'working_abroad' before the migration are untouched.

UPDATE leave_requests lr
SET leave_type = b.old_leave_type
FROM leave_requests_legacy_leave_type_backup b
WHERE lr.id = b.leave_request_id
  AND lr.leave_type = 'working_abroad';

DROP TABLE IF EXISTS leave_requests_legacy_leave_type_backup;
