-- Allow users to insert their own documents
CREATE POLICY "Users can insert their own documents"
ON public.user_identity_documents
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow users to update their own documents
CREATE POLICY "Users can update their own documents"
ON public.user_identity_documents
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Allow users to delete their own documents
CREATE POLICY "Users can delete their own documents"
ON public.user_identity_documents
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Allow users to upload their own documents to storage
CREATE POLICY "Users can upload their own identity documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wills' AND
  (storage.foldername(name))[1] = 'user-documents' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to delete their own documents from storage
CREATE POLICY "Users can delete their own identity documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'wills' AND
  (storage.foldername(name))[1] = 'user-documents' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
