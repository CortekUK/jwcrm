-- Harden handle_new_user: make the user_roles insert conflict-safe.
--
-- Admin-created users go through the create-dashboard-user edge function, which
-- both (a) sets user_metadata.role so this trigger inserts the primary role and
-- (b) upserts the full role set afterwards. Without ON CONFLICT, the trigger's
-- insert and the function's insert collided on UNIQUE (user_id, role), throwing
-- a duplicate-key error and aborting user creation. DO NOTHING makes the trigger
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
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en')
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
