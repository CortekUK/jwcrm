-- Rollback: Create leads table for Lead Management module
-- Created: 2026-01-08
-- Use this to undo the migration

-- Drop RLS policies
DROP POLICY IF EXISTS "lead_management_full_access" ON leads;
DROP POLICY IF EXISTS "admin_full_access" ON leads;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_leads_updated_at ON leads;

-- Drop function
DROP FUNCTION IF EXISTS update_leads_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_leads_status;
DROP INDEX IF EXISTS idx_leads_email;
DROP INDEX IF EXISTS idx_leads_created_at;

-- Drop table
DROP TABLE IF EXISTS leads;

-- Drop enum type
DROP TYPE IF EXISTS lead_status;
