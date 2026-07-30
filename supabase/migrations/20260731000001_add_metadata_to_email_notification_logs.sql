-- Migration: Add metadata column to email_notification_logs
-- Date: 2026-07-31
-- Description:
--   The HR notification routes run in "test mode": every email is delivered to
--   the admin address rather than the intended employee. The audit log had
--   nowhere to record that, so it recorded the employee's address as the
--   recipient and marked the row 'sent' — claiming a delivery to somebody who
--   received nothing.
--
--   This column carries the truth: which address the message really went to,
--   which address it was meant for, and that a test-mode redirection happened.
--   (The EmailLogsTable UI already renders `metadata` when present.)

ALTER TABLE email_notification_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN email_notification_logs.metadata IS
  'Free-form context for the notification. For test-mode redirected mail: { test_mode_redirect, intended_recipient, actual_recipient, note }.';
