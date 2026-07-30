-- Rollback for 20260801000001_add_leave_certificate_storage_policies.sql
-- Kept OUT of supabase/migrations/ on purpose: a rollback sitting in the
-- migrations root gets picked up by the migration sweep and would immediately
-- undo the migration it belongs to.
--
-- Dropping these policies does not break the leave certificate feature, which
-- goes through service-role API routes, but it removes the database-level
-- expression of who may touch the `leave-certificates/` prefix.

DROP POLICY IF EXISTS "HR can view leave certificates" ON storage.objects;
DROP POLICY IF EXISTS "HR can upload leave certificates" ON storage.objects;
DROP POLICY IF EXISTS "HR can update leave certificates" ON storage.objects;
DROP POLICY IF EXISTS "HR can delete leave certificates" ON storage.objects;
DROP POLICY IF EXISTS "Employees can upload their own leave certificates" ON storage.objects;
DROP POLICY IF EXISTS "Employees can view their own leave certificates" ON storage.objects;
