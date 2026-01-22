-- Phase 1: Critical Security Fix - Separate user roles table
-- Create app_role enum (if not exists, this will error but that's ok)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('client', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all roles (using recursive check for bootstrap)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Drop old RLS policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create new RLS policies on profiles using has_role()
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update profiles trigger to also create user_roles entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, locale)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'en'
  );
  
  -- Create default client role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$;

-- Phase 2: Extend wills table
-- Create will_status enum
CREATE TYPE public.will_status AS ENUM (
  'in_progress',
  'awaiting_pdf',
  'draft_generated',
  'in_review',
  'finalized'
);

-- Add new columns to wills table
ALTER TABLE public.wills
  ADD COLUMN IF NOT EXISTS status will_status NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS upload_files JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Drop old RLS policies on wills
DROP POLICY IF EXISTS "Admins can view all wills" ON public.wills;
DROP POLICY IF EXISTS "Users can view own wills" ON public.wills;
DROP POLICY IF EXISTS "Users can create own wills" ON public.wills;
DROP POLICY IF EXISTS "Users can update own wills" ON public.wills;

-- Create new RLS policies on wills using has_role()
CREATE POLICY "Users can view own wills"
  ON public.wills
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own wills"
  ON public.wills
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wills"
  ON public.wills
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wills"
  ON public.wills
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Remove role column from profiles (after migration complete)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;