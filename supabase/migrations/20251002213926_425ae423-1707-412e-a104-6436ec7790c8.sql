-- Fix infinite recursion in user_roles RLS policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Users can always view their own roles (no recursion)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all roles (direct check, no recursion)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::app_role
  )
);

-- Add pdf_generated_at column to wills table
ALTER TABLE public.wills
ADD COLUMN IF NOT EXISTS pdf_generated_at timestamp with time zone;