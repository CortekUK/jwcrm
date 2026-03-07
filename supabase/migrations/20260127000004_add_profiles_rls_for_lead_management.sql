-- Migration: Add RLS policies for profiles table to allow lead_management and salesperson roles to view profiles
-- This is needed for displaying assigned salesperson names in the lead management module

-- Allow lead_management role to view all profiles (needed for viewing assigned salespeople)
CREATE POLICY "Lead management can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'lead_management'::app_role));

-- Allow salesperson role to view all profiles (needed for viewing lead assignments)
CREATE POLICY "Salesperson can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'salesperson'::app_role));

-- Allow superadmin to view all profiles
CREATE POLICY "Superadmin can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));
