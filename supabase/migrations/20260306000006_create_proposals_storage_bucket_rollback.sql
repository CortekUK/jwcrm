-- Rollback: Create storage bucket for proposals and invoices PDFs
-- Created: 2026-01-08
-- Use this to undo the migration

-- Drop storage policies for lead_management
DROP POLICY IF EXISTS "lead_management_upload_proposals" ON storage.objects;
DROP POLICY IF EXISTS "lead_management_view_proposals" ON storage.objects;
DROP POLICY IF EXISTS "lead_management_update_proposals" ON storage.objects;
DROP POLICY IF EXISTS "lead_management_delete_proposals" ON storage.objects;

-- Drop storage policies for admin
DROP POLICY IF EXISTS "admin_upload_proposals" ON storage.objects;
DROP POLICY IF EXISTS "admin_view_proposals" ON storage.objects;
DROP POLICY IF EXISTS "admin_update_proposals" ON storage.objects;
DROP POLICY IF EXISTS "admin_delete_proposals" ON storage.objects;

-- Delete all files in the bucket first (required before deleting bucket)
DELETE FROM storage.objects WHERE bucket_id = 'proposals';

-- Delete the bucket
DELETE FROM storage.buckets WHERE id = 'proposals';
