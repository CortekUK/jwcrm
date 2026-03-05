-- Rollback: Create proposals table for Lead Management module
-- Created: 2026-01-08
-- Use this to undo the migration

-- Drop RLS policies
DROP POLICY IF EXISTS "lead_management_full_access" ON proposals;
DROP POLICY IF EXISTS "admin_full_access" ON proposals;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_proposals_updated_at ON proposals;
DROP TRIGGER IF EXISTS trigger_generate_invoice_number ON proposals;

-- Drop functions
DROP FUNCTION IF EXISTS update_proposals_updated_at();
DROP FUNCTION IF EXISTS generate_invoice_number();

-- Drop indexes
DROP INDEX IF EXISTS idx_proposals_lead_id;
DROP INDEX IF EXISTS idx_proposals_status;
DROP INDEX IF EXISTS idx_proposals_invoice_number;
DROP INDEX IF EXISTS idx_proposals_stripe_session;

-- Drop table
DROP TABLE IF EXISTS proposals;

-- Drop enum type
DROP TYPE IF EXISTS proposal_status;
