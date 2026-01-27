-- Migration: Add consultation outcome fields and consultation_completed status
-- Created: 2026-01-29
-- Description: Adds fields to track consultation outcomes (needs, price, next steps) and consultation_completed status

-- Add consultation_completed status to the lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'consultation_completed' AFTER 'consultation';

-- Add consultation outcome columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS needs_identified TEXT,
ADD COLUMN IF NOT EXISTS quoted_price DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS quoted_currency TEXT DEFAULT 'AED',
ADD COLUMN IF NOT EXISTS next_steps TEXT;

-- Add comments for documentation
COMMENT ON COLUMN leads.needs_identified IS 'Client needs identified during consultation';
COMMENT ON COLUMN leads.quoted_price IS 'Price quoted to the client during consultation';
COMMENT ON COLUMN leads.quoted_currency IS 'Currency of the quoted price (default AED)';
COMMENT ON COLUMN leads.next_steps IS 'Next steps agreed upon during consultation';

-- Update comment for lead_status enum
COMMENT ON TYPE public.lead_status IS 'Lead status values: not_started (new), consultation (in consultation), consultation_completed (consultation done with outcomes captured), meeting (meeting scheduled), hold (on hold), qualified (lead qualified), negotiation (in negotiation), pending (proposal sent), won (paid), lost (rejected)';

-- Create index on consultation_completed leads for filtering
CREATE INDEX IF NOT EXISTS idx_leads_consultation_completed ON leads(status) WHERE status = 'consultation_completed';
