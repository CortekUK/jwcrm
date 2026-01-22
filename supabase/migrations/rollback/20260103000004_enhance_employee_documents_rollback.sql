-- Rollback: Enhance employee_documents table with renewal tracking
-- Run this to undo the migration

-- Remove the check constraint first
ALTER TABLE employee_documents
DROP CONSTRAINT IF EXISTS employee_documents_renewal_status_check;

-- Remove the added columns
ALTER TABLE employee_documents
DROP COLUMN IF EXISTS renewal_status,
DROP COLUMN IF EXISTS renewal_submitted_at,
DROP COLUMN IF EXISTS renewal_expected_at,
DROP COLUMN IF EXISTS last_reminder_at,
DROP COLUMN IF EXISTS reminder_count;
