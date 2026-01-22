-- Add extracted_name column to user_identity_documents table
ALTER TABLE public.user_identity_documents
ADD COLUMN IF NOT EXISTS extracted_name TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN public.user_identity_documents.extracted_name IS 'Preferred name extracted from Emirates ID based on user locale (Arabic or English)';
