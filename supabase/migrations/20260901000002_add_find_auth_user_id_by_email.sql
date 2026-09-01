-- The Stripe webhook creates the client portal account. When the address is
-- already registered it currently logs "user already exists" and moves on --
-- silently skipping the user_roles insert, so that client never gets portal
-- access. It cannot do better because auth.users is not reachable over
-- PostgREST and createUser does not return the existing id.
--
-- SECURITY DEFINER so the service role can resolve an address to its user id.
-- Revoked from every client-facing role: only the service key may call it.
CREATE OR REPLACE FUNCTION public.find_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_auth_user_id_by_email(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_auth_user_id_by_email(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.find_auth_user_id_by_email(TEXT) FROM authenticated;

COMMENT ON FUNCTION public.find_auth_user_id_by_email(TEXT) IS
  'Service-role only. Resolves an email to its auth.users id so portal provisioning can link an existing account instead of silently skipping it.';
