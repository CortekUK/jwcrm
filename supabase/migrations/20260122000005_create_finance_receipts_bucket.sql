-- Migration: Create storage bucket for finance receipts
-- Created: 2026-01-22

-- Create the finance-receipts bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'finance-receipts',
    'finance-receipts',
    false,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for finance-receipts bucket

-- Policy: finance, admin, superadmin can upload receipts
CREATE POLICY "finance_upload_receipts" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'finance-receipts' AND
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('finance', 'admin', 'superadmin')
        )
    );

-- Policy: finance, admin, superadmin can view receipts
CREATE POLICY "finance_view_receipts" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'finance-receipts' AND
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('finance', 'admin', 'superadmin')
        )
    );

-- Policy: finance, admin, superadmin can update receipts
CREATE POLICY "finance_update_receipts" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'finance-receipts' AND
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('finance', 'admin', 'superadmin')
        )
    );

-- Policy: finance, admin, superadmin can delete receipts
CREATE POLICY "finance_delete_receipts" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'finance-receipts' AND
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('finance', 'admin', 'superadmin')
        )
    );
