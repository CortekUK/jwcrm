# Reset Database - Step by Step Instructions

## Option 1: Using Supabase Dashboard (Recommended for Production)

### Step 1: Clear All Data
Go to your Supabase Dashboard → SQL Editor and run:

```sql
-- Clear all application data
TRUNCATE TABLE public.user_identity_documents CASCADE;
TRUNCATE TABLE public.will_file_metadata CASCADE;
TRUNCATE TABLE public.wills CASCADE;
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
```

### Step 2: Delete All Users
1. Go to Authentication → Users
2. Select all users
3. Click "Delete selected users"

### Step 3: Create Admin User
1. Go to Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter:
   - Email: `admin@justwills.com`
   - Password: `admin123`
   - Auto Confirm User: ✓ (checked)
4. Click "Create user"

### Step 4: Assign Admin Role
Copy the user ID from the newly created user, then go to SQL Editor and run:

```sql
-- Replace 'USER_ID_HERE' with the actual user ID
DO $$
DECLARE
  admin_user_id UUID := 'USER_ID_HERE'; -- REPLACE THIS
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, created_at, updated_at)
  VALUES (admin_user_id, 'Admin User', NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET full_name = 'Admin User';

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (admin_user_id, 'admin', NOW())
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
```

---

## Option 2: Using SQL Script (For Local Development)

If you're running Supabase locally with Docker:

1. Start Docker Desktop
2. Start Supabase: `npx supabase start`
3. Run the reset script: `npx supabase db reset`

The `seed.sql` file will automatically create the admin user.

---

## Verify Admin User

Run this query to verify the admin was created:

```sql
SELECT
  u.id,
  u.email,
  p.full_name,
  ur.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@justwills.com';
```

You should see:
- Email: admin@justwills.com
- Full Name: Admin User
- Role: admin

---

## Login Credentials

- **Email**: admin@justwills.com
- **Password**: admin123

⚠️ **IMPORTANT**: Change the password after first login in production!
