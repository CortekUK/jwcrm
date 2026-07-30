-- Migration: storage policies for leave certificates
--
-- Leave certificates live in the existing PRIVATE `wills` bucket (public = false,
-- created in 20251002213115) under the `leave-certificates/` prefix, mirroring
-- how `employee-documents/` is handled in 20260128000001. No new bucket is
-- created, so nothing has to exist before the feature works.
--
-- NOTE ON THE ACCESS MODEL: the application reaches these objects exclusively
-- through /api/hr/leave/self and /api/hr/leave/attachment, which use the
-- service-role key and authorise the caller themselves (owning employee, or
-- hr/admin/superadmin). Service role bypasses RLS, so the feature does not
-- depend on these policies. They are here as defence in depth and so that the
-- intended access rule is expressed in the database rather than only in code —
-- the same reason the employee-documents policies exist.
--
-- Path shape: leave-certificates/<employee_id>/<timestamp>-<filename>
--   foldername(name)[1] = 'leave-certificates'
--   foldername(name)[2] = employees.id

-- HR/admin can read every certificate.
CREATE POLICY "HR can view leave certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'wills'
  AND (storage.foldername(name))[1] = 'leave-certificates'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('hr', 'admin', 'superadmin')
  )
);

-- HR/admin can attach a certificate handed in on paper.
CREATE POLICY "HR can upload leave certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wills'
  AND (storage.foldername(name))[1] = 'leave-certificates'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('hr', 'admin', 'superadmin')
  )
);

-- HR/admin can replace/remove a certificate.
CREATE POLICY "HR can update leave certificates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'wills'
  AND (storage.foldername(name))[1] = 'leave-certificates'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('hr', 'admin', 'superadmin')
  )
);

CREATE POLICY "HR can delete leave certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'wills'
  AND (storage.foldername(name))[1] = 'leave-certificates'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('hr', 'admin', 'superadmin')
  )
);

-- An employee may upload into, and read back, only their OWN folder — the
-- folder segment must be the employees row linked to their auth user.
CREATE POLICY "Employees can upload their own leave certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wills'
  AND (storage.foldername(name))[1] = 'leave-certificates'
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id::text = (storage.foldername(name))[2]
    AND employees.user_id = auth.uid()
  )
);

CREATE POLICY "Employees can view their own leave certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'wills'
  AND (storage.foldername(name))[1] = 'leave-certificates'
  AND EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id::text = (storage.foldername(name))[2]
    AND employees.user_id = auth.uid()
  )
);
