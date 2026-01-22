-- Update storage policy to allow users to access files in folders matching their will_id
-- This fixes the issue where PDFs uploaded with will_id as folder name couldn't be accessed by clients

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;

-- Recreate policy with improved logic:
-- Users can access files if:
-- 1. They are admin, OR
-- 2. The folder name matches their user_id, OR
-- 3. The folder name matches a will_id that belongs to them
CREATE POLICY "Users can view their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'wills'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM wills
      WHERE wills.id::text = (storage.foldername(name))[1]
      AND wills.user_id = auth.uid()
    )
  )
);
