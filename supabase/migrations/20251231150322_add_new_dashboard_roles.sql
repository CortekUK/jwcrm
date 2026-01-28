-- Migration: Add new dashboard roles to app_role enum
-- Adds: hr, finance, lead_management roles

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'hr';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'lead_management';
