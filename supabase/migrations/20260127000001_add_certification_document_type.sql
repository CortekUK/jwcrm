-- Migration: Add certification document type
-- Description: Add 'certification' to the employee_documents document_type constraint
-- to support professional certifications, training certificates, etc.

-- Drop the existing CHECK constraint on document_type
ALTER TABLE employee_documents 
DROP CONSTRAINT IF EXISTS employee_documents_document_type_check;

-- Recreate the CHECK constraint to include 'certification'
ALTER TABLE employee_documents 
ADD CONSTRAINT employee_documents_document_type_check 
CHECK (document_type IN (
  'passport',
  'employment_visa', 
  'emirates_id',
  'employment_contract',
  'certification'
));

-- Add comment for documentation
COMMENT ON CONSTRAINT employee_documents_document_type_check ON employee_documents IS 
'Allowed document types: passport, employment_visa, emirates_id, employment_contract, certification';
