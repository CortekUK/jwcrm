-- Add arabic_name and english_name columns to user_identity_documents table
-- These columns store names extracted from Emirates ID using AI
ALTER TABLE public.user_identity_documents
ADD COLUMN IF NOT EXISTS arabic_name TEXT,
ADD COLUMN IF NOT EXISTS english_name TEXT;

-- Add comments to describe the columns
COMMENT ON COLUMN public.user_identity_documents.arabic_name IS 'Arabic name extracted from Emirates ID via AI (الاسم العربي)';
COMMENT ON COLUMN public.user_identity_documents.english_name IS 'English name extracted from Emirates ID via AI';
