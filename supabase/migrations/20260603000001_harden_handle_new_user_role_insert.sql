-- Fix + harden handle_new_user.
--
-- Bug 1 (primary): profiles.locale is the app_locale ENUM, but the trigger
-- inserted raw_user_meta_data->>'locale' as TEXT. Postgres does not implicitly
-- cast text -> enum, so the INSERT threw "column locale is of type app_locale
-- but expression is of type text" and EVERY GoTrue user creation failed with a
-- 500. The ::app_locale cast below fixes it.
--
-- Bug 2 (hardening): admin-created users go through the create-dashboard-user
-- edge function, which both (a) sets user_metadata.role so this trigger inserts
-- the primary role and (b) upserts the full role set afterwards. Without
-- ON CONFLICT, the trigger's insert and the function's insert collided on
-- UNIQUE (user_id, role), aborting user creation. DO NOTHING makes the trigger
-- idempotent and lets the function own the authoritative role/permission rows.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, locale)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en')::public.app_locale
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Get role from user_metadata, default to 'client' if not specified
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client')::app_role;

  -- Create user role based on metadata (conflict-safe)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
