-- Add storage policies for clients to upload change request images to will-documents bucket

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Clients can upload change request images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view change request images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete change request images" ON storage.objects;

-- Allow authenticated users to INSERT (upload) to change-requests folder
CREATE POLICY "Clients can upload change request images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'will-documents'
  AND (storage.foldername(name))[1] = 'change-requests'
);

-- Allow authenticated users to SELECT (read) change request images
CREATE POLICY "Users can view change request images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'will-documents'
  AND (storage.foldername(name))[1] = 'change-requests'
);

-- Allow users to DELETE their own change request images (optional, for cleanup)
CREATE POLICY "Users can delete change request images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'will-documents'
  AND (storage.foldername(name))[1] = 'change-requests'
);
