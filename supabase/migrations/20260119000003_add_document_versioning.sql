-- Add document versioning support to employee_documents
-- This allows storing document history while only showing the active version in alerts

-- Step 1: Add is_active column (default true for existing documents)
ALTER TABLE employee_documents
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Step 2: Drop the existing unique constraint on (employee_id, document_type)
-- This constraint prevents storing multiple versions
ALTER TABLE employee_documents
DROP CONSTRAINT IF EXISTS employee_documents_employee_id_document_type_key;

-- Step 3: Create a partial unique index to ensure only ONE active document per type per employee
-- This replaces the old constraint but allows multiple inactive (historical) documents
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_documents_active_unique
ON employee_documents(employee_id, document_type)
WHERE is_active = true;

-- Step 4: Add an index for filtering active documents (improves query performance)
CREATE INDEX IF NOT EXISTS idx_employee_documents_is_active
ON employee_documents(is_active)
WHERE is_active = true;

-- Step 5: Add archived_at column to track when a document was replaced
ALTER TABLE employee_documents
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Comment explaining the versioning system
COMMENT ON COLUMN employee_documents.is_active IS 'Only one document per type can be active per employee. When a new document is uploaded, the old one is set to is_active=false';
COMMENT ON COLUMN employee_documents.archived_at IS 'Timestamp when this document was replaced by a newer version';
