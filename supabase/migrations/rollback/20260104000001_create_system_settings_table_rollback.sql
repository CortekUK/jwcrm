-- Rollback Migration: Drop system_settings table
-- Run this to undo the 20260104000001_create_system_settings_table migration

-- Drop trigger first
DROP TRIGGER IF EXISTS update_system_settings_timestamp ON system_settings;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_system_settings_updated_at();

-- Drop the table (CASCADE will drop policies and indexes)
DROP TABLE IF EXISTS system_settings CASCADE;
