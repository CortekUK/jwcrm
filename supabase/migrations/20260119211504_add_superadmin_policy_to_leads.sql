-- Migration: Add superadmin RLS policy to leads table
-- Allows superadmin full access to all leads

CREATE POLICY "superadmin_full_access"
ON leads FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'superadmin'::app_role
  )
);
