-- Migration: Add HR storage policies for employee documents
-- This allows HR users to upload/view/update/delete employee documents in the wills bucket

-- HR can upload employee documents
CREATE POLICY "HR can upload employee documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wills'
  AND (storage.foldername(name))[1] = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('hr', 'admin', 'superadmin')
  )
);

-- HR can view employee documents
CREATE POLICY "HR can view employee documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'wills'
  AND (storage.foldername(name))[1] = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('hr', 'admin', 'superadmin')
  )
);

-- HR can update employee documents
CREATE POLICY "HR can update employee documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'wills'
  AND (storage.foldername(name))[1] = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('hr', 'admin', 'superadmin')
  )
);

-- HR can delete employee documents
CREATE POLICY "HR can delete employee documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'wills'
  AND (storage.foldername(name))[1] = 'employee-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('hr', 'admin', 'superadmin')
  )
);
