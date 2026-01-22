-- Clear all data from tables
TRUNCATE TABLE public.user_identity_documents CASCADE;
TRUNCATE TABLE public.will_file_metadata CASCADE;
TRUNCATE TABLE public.wills CASCADE;
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.profiles CASCADE;

-- Delete all users from auth.users (this will cascade to profiles)
DELETE FROM auth.users;

-- Create admin user
-- Password: admin123 (hashed using bcrypt)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@justwills.com',
  '$2a$10$rqiU8xKvXQJvJK5x5yYKOeFKMHJZQqEQvQqVzJQKjqLjqYzLqjYKO', -- bcrypt hash of 'admin123'
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin User"}',
  false,
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  ''
);

-- Get the admin user ID
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@justwills.com';

  -- Create profile for admin
  INSERT INTO public.profiles (user_id, full_name, created_at, updated_at)
  VALUES (admin_user_id, 'Admin User', NOW(), NOW());

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (admin_user_id, 'admin', NOW());
END $$;
