-- Create hardcoded superadmin user
-- Email: superadmin@gmail.com
-- Password: superadmin@gmail.com

DO $$
DECLARE
  superadmin_uid UUID;
BEGIN
  -- Check if superadmin already exists
  SELECT id INTO superadmin_uid FROM auth.users WHERE email = 'superadmin@gmail.com';

  IF superadmin_uid IS NULL THEN
    -- Generate a new UUID for the superadmin
    superadmin_uid := gen_random_uuid();

    -- Insert into auth.users
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
    ) VALUES (
      superadmin_uid,
      '00000000-0000-0000-0000-000000000000',
      'superadmin@gmail.com',
      crypt('superadmin@gmail.com', gen_salt('bf', 10)),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"is_active": true}',
      FALSE,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );

    -- Create identity for the user
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      superadmin_uid,
      'superadmin@gmail.com',
      jsonb_build_object('sub', superadmin_uid::text, 'email', 'superadmin@gmail.com', 'email_verified', true),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    -- Create profile
    INSERT INTO public.profiles (user_id, full_name, locale)
    VALUES (superadmin_uid, 'Super Admin', 'en')
    ON CONFLICT (user_id) DO NOTHING;

    -- Assign superadmin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (superadmin_uid, 'superadmin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'Superadmin user created successfully with ID: %', superadmin_uid;
  ELSE
    -- User exists, just ensure they have superadmin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (superadmin_uid, 'superadmin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'Superadmin user already exists with ID: %', superadmin_uid;
  END IF;
END $$;
