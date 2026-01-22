-- Delete user by email
-- Replace 'user@example.com' with the actual email address

-- First, find the user_id
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Delete from profiles table (cascade will handle this automatically)
DELETE FROM public.profiles WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- Delete from auth.users (this will cascade delete the profile due to foreign key)
DELETE FROM auth.users WHERE email = 'user@example.com';

-- Verify deletion
SELECT id, email FROM auth.users WHERE email = 'user@example.com';
SELECT * FROM public.profiles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
