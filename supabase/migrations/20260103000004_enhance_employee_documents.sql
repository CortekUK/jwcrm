-- Migration: Enhance employee_documents table with renewal tracking
-- Description: Adds columns for tracking document renewal status, submission dates, and reminder history

-- Add renewal tracking columns to employee_documents
ALTER TABLE employee_documents
ADD COLUMN IF NOT EXISTS renewal_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS renewal_submitted_at DATE,
ADD COLUMN IF NOT EXISTS renewal_expected_at DATE,
ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;

-- Add check constraint for renewal_status
ALTER TABLE employee_documents
ADD CONSTRAINT employee_documents_renewal_status_check
CHECK (renewal_status IN ('none', 'in_progress', 'completed'));

-- Add comment for documentation
COMMENT ON COLUMN employee_documents.renewal_status IS 'Document renewal status: none, in_progress, or completed';
COMMENT ON COLUMN employee_documents.renewal_submitted_at IS 'Date when renewal was submitted to authorities';
COMMENT ON COLUMN employee_documents.renewal_expected_at IS 'Expected date for renewed document return';
COMMENT ON COLUMN employee_documents.last_reminder_at IS 'Timestamp of last expiry reminder sent';
COMMENT ON COLUMN employee_documents.reminder_count IS 'Number of expiry reminders sent for this document';
