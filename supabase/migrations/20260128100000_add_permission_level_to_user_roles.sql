-- Add permission_level column to user_roles table
-- This column stores either "head" or "employee" for tiered permissions

-- Create the permission_level enum type
DO $$ BEGIN
  CREATE TYPE public.permission_level AS ENUM ('head', 'employee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add permission_level column to user_roles table
-- Default to 'head' for backward compatibility (existing users get full access)
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS permission_level public.permission_level DEFAULT 'head' NOT NULL;

-- Create a helper function to check if a user has "head" permission for a specific role
CREATE OR REPLACE FUNCTION public.is_head_for_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND permission_level = 'head'
  );
$$;

-- Create a helper function to get the permission level for a user's role
CREATE OR REPLACE FUNCTION public.get_permission_level(_user_id uuid, _role public.app_role)
RETURNS public.permission_level
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT permission_level
  FROM public.user_roles
  WHERE user_id = _user_id
    AND role = _role
  LIMIT 1;
$$;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION public.is_head_for_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_permission_level(uuid, public.app_role) TO authenticated;

-- Add comment for documentation
COMMENT ON COLUMN public.user_roles.permission_level IS 'Permission tier: head (full access) or employee (restricted access). Applies to HR, Finance, Admin, and Lead Management roles.';
