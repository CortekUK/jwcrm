-- Create storage bucket for will documents
-- This includes asset photos and documents

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'will-documents',
  'will-documents',
  true, -- Make files publicly accessible via signed URLs
  10485760, -- 10MB file size limit
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload will documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own will documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own will documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own will documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all will documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete any will documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can read will documents" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload will documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'will-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read their own will documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'will-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their own will documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'will-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own will documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'will-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access (since bucket is public)
CREATE POLICY "Public can read will documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'will-documents');
