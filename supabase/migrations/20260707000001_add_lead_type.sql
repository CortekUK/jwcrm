-- Migration: Add corporate vs individual lead type
-- Created: 2026-07-07
-- Client request: "Corp needs to be added to new lead"

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lead_type TEXT NOT NULL DEFAULT 'individual';

-- Constrain to the two supported values
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_lead_type_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_lead_type_check
  CHECK (lead_type IN ('individual', 'corporate'));

-- Index for filtering the leads list by type
CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads(lead_type);

COMMENT ON COLUMN leads.lead_type IS 'Whether the lead is an individual or a corporate (Corp) client';
