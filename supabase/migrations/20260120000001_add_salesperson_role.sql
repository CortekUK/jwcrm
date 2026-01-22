-- Migration: Add salesperson role to app_role enum
-- Created: 2026-01-20
-- Description: Adds the salesperson role for lead assignment functionality

-- Add salesperson value to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'salesperson';

-- Add comment for documentation
COMMENT ON TYPE public.app_role IS 'Application roles: client, admin, superadmin, hr, finance, lead_management, salesperson';
