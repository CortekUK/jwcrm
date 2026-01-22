-- Migration: Create storage bucket for proposals and invoices PDFs
-- Created: 2026-01-08

-- Create the storage bucket for proposals
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'proposals',
    'proposals',
    false,
    10485760, -- 10MB limit
    ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: lead_management can upload files
CREATE POLICY "lead_management_upload_proposals"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'proposals'
    AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'lead_management'
    )
);

-- Storage policy: lead_management can view files
CREATE POLICY "lead_management_view_proposals"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'proposals'
    AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'lead_management'
    )
);

-- Storage policy: lead_management can update files
CREATE POLICY "lead_management_update_proposals"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'proposals'
    AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'lead_management'
    )
)
WITH CHECK (
    bucket_id = 'proposals'
    AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'lead_management'
    )
);

-- Storage policy: lead_management can delete files
CREATE POLICY "lead_management_delete_proposals"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'proposals'
    AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'lead_management'
    )
);

-- Storage policy: admin can upload files
CREATE POLICY "admin_upload_proposals"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'proposals'
    AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Storage policy: admin can view files
CREATE POLICY "admin_view_proposals"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'proposals'
    AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Storage policy: admin can update files
CREATE POLICY "admin_update_proposals"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'proposals'
    AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
)
WITH CHECK (
    bucket_id = 'proposals'
    AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Storage policy: admin can delete files
CREATE POLICY "admin_delete_proposals"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'proposals'
    AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);
