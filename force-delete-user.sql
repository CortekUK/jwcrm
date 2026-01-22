-- ========================================
-- FORCE DELETE USER BY DISABLING TRIGGERS
-- ========================================
-- This disables triggers temporarily to delete the user
-- ========================================

-- Disable triggers on profiles table
ALTER TABLE public.profiles DISABLE TRIGGER ALL;

-- Delete the specific user
DO $$
DECLARE
  target_user_id UUID := 'ebb6e56e-d184-4c04-af50-767ee8f93fc6';
BEGIN
  -- Delete from user_roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  -- Delete from user_identity_documents
  DELETE FROM public.user_identity_documents WHERE user_id = target_user_id;

  -- Delete from will_status_events
  DELETE FROM public.will_status_events
  WHERE will_id IN (SELECT id FROM public.wills WHERE user_id = target_user_id);

  -- Delete from wills
  DELETE FROM public.wills WHERE user_id = target_user_id;

  -- Delete from profiles
  DELETE FROM public.profiles WHERE user_id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;

  RAISE NOTICE 'User deleted successfully: %', target_user_id;
END $$;

-- Re-enable triggers on profiles table
ALTER TABLE public.profiles ENABLE TRIGGER ALL;

-- Verify deletion
SELECT
  COUNT(*) as remaining_users,
  string_agg(email, ', ') as emails
FROM auth.users;
