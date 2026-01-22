-- Create trigger to delete auth user when profile is deleted
CREATE OR REPLACE FUNCTION public.delete_auth_user_on_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the auth user (this will cascade to user_roles due to foreign key)
  DELETE FROM auth.users WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_delete_auth_user_on_profile_delete ON public.profiles;

CREATE TRIGGER trigger_delete_auth_user_on_profile_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_auth_user_on_profile_delete();
