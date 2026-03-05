-- Create a new storage bucket for change request images
INSERT INTO storage.buckets (id, name, public)
VALUES ('change-requests', 'change-requests', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their change request images
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload change request images' AND tablename = 'objects') THEN
    CREATE POLICY "Users can upload change request images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'change-requests');
  END IF;
END $$;

-- Allow authenticated users to view change request images
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view change request images' AND tablename = 'objects') THEN
    CREATE POLICY "Users can view change request images"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'change-requests');
  END IF;
END $$;

-- Allow users to delete their own change request images
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete change request images' AND tablename = 'objects') THEN
    CREATE POLICY "Users can delete change request images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'change-requests');
  END IF;
END $$;
