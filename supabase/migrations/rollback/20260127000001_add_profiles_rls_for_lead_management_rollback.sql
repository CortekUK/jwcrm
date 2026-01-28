-- Rollback: Remove RLS policies for profiles table for lead_management and salesperson roles

DROP POLICY IF EXISTS "Lead management can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Salesperson can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmin can view all profiles" ON profiles;
