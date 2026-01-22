-- Create table for user identity documents managed by admins
CREATE TABLE IF NOT EXISTS public.user_identity_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('passport', 'visa', 'emirates_id')),
  document_path TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_size INTEGER NOT NULL,
  document_mime TEXT NOT NULL,
  passport_number TEXT,
  emirates_id_number TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by_admin_id UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, document_type)
);

-- Enable RLS
ALTER TABLE public.user_identity_documents ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all user documents
CREATE POLICY "Admins can read all user documents"
ON public.user_identity_documents
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert user documents
CREATE POLICY "Admins can insert user documents"
ON public.user_identity_documents
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update user documents
CREATE POLICY "Admins can update user documents"
ON public.user_identity_documents
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete user documents
CREATE POLICY "Admins can delete user documents"
ON public.user_identity_documents
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow users to read their own documents
CREATE POLICY "Users can read their own documents"
ON public.user_identity_documents
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX idx_user_identity_documents_user_id ON public.user_identity_documents(user_id);
CREATE INDEX idx_user_identity_documents_type ON public.user_identity_documents(user_id, document_type);

-- Add storage policies for user documents in wills bucket
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Admins can upload user documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read user documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete user documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own identity documents" ON storage.objects;

-- Allow admins to upload user documents
CREATE POLICY "Admins can upload user documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wills' AND
  (storage.foldername(name))[1] = 'user-documents' AND
  public.has_role(auth.uid(), 'admin')
);

-- Allow admins to read user documents
CREATE POLICY "Admins can read user documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'wills' AND
  (storage.foldername(name))[1] = 'user-documents' AND
  public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete user documents
CREATE POLICY "Admins can delete user documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'wills' AND
  (storage.foldername(name))[1] = 'user-documents' AND
  public.has_role(auth.uid(), 'admin')
);

-- Allow users to view their own documents
CREATE POLICY "Users can view their own identity documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'wills' AND
  (storage.foldername(name))[1] = 'user-documents' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
