-- Create a new storage bucket for change request images
INSERT INTO storage.buckets (id, name, public)
VALUES ('change-requests', 'change-requests', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their change request images
CREATE POLICY "Users can upload change request images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'change-requests');

-- Allow authenticated users to view change request images
CREATE POLICY "Users can view change request images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'change-requests');

-- Allow users to delete their own change request images
CREATE POLICY "Users can delete change request images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'change-requests');
