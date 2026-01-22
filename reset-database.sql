-- ========================================
-- RESET DATABASE AND CREATE ADMIN USER
-- ========================================
-- Run this script in Supabase SQL Editor
-- This will delete ALL data and create only one admin user
-- Email: admin@justwills.com
-- Password: admin123
-- ========================================

-- Step 1: Clear all data from application tables
TRUNCATE TABLE public.will_status_events CASCADE;
TRUNCATE TABLE public.user_identity_documents CASCADE;
TRUNCATE TABLE public.wills CASCADE;
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.profiles CASCADE;

-- Step 2: Delete all users from auth schema
-- IMPORTANT: This uses the Supabase admin API, so you need to run this carefully
-- You may need to delete users manually from the Supabase Dashboard > Authentication > Users

-- For local development, you can use:
DELETE FROM auth.users;

-- Step 3: Create admin user
-- You'll need to create this user via Supabase Dashboard or use the script below

-- For local development with direct SQL access:
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Create auth user
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
    crypt('admin123', gen_salt('bf')), -- This uses pgcrypto to hash the password
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
  )
  RETURNING id INTO admin_user_id;

  -- Create profile for admin
  INSERT INTO public.profiles (user_id, full_name, created_at, updated_at)
  VALUES (admin_user_id, 'Admin User', NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = 'Admin User', updated_at = NOW();

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (admin_user_id, 'admin', NOW())
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Admin user created successfully with email: admin@justwills.com';
END $$;

-- Verify the admin was created
SELECT
  u.email,
  p.full_name,
  ur.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id;
