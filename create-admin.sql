-- ========================================
-- CREATE ADMIN USER PROFILE AND ROLE
-- ========================================
-- First, create the user in Supabase Dashboard:
-- 1. Go to Authentication > Users > Add User
-- 2. Email: admin@justwills.com
-- 3. Password: admin123
-- 4. Check "Auto Confirm User"
-- 5. Click "Create user"
-- 6. Copy the user ID
-- 7. Replace 'PASTE_USER_ID_HERE' below with the actual user ID
-- 8. Run this script
-- ========================================

DO $$
DECLARE
  admin_user_id UUID := 'PASTE_USER_ID_HERE'; -- REPLACE THIS WITH ACTUAL USER ID
BEGIN
  -- Create profile for admin
  INSERT INTO public.profiles (user_id, full_name, created_at, updated_at)
  VALUES (admin_user_id, 'Admin User', NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = 'Admin User', updated_at = NOW();

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (admin_user_id, 'admin', NOW())
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Admin user setup completed for user ID: %', admin_user_id;
END $$;

-- Verify the admin was created
SELECT
  u.id,
  u.email,
  p.full_name,
  ur.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@justwills.com';
