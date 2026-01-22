-- Migration: Add payment tracking fields to leads table
-- This allows us to track payment status directly on leads

-- Add payment-related columns to leads table
ALTER TABLE leads
ADD COLUMN is_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN paid_amount DECIMAL(12, 2),
ADD COLUMN paid_currency TEXT DEFAULT 'USD';

-- Create index on is_paid for filtering paid leads
CREATE INDEX idx_leads_is_paid ON leads(is_paid);

-- Add comments for documentation
COMMENT ON COLUMN leads.is_paid IS 'Whether the lead has completed payment';
COMMENT ON COLUMN leads.paid_at IS 'Timestamp when payment was received';
COMMENT ON COLUMN leads.paid_amount IS 'Amount paid by the lead';
COMMENT ON COLUMN leads.paid_currency IS 'Currency of the payment (default USD)';

-- Update existing won leads that have paid proposals to set is_paid = true
UPDATE leads l
SET
  is_paid = TRUE,
  paid_at = p.paid_at,
  paid_amount = p.amount,
  paid_currency = p.currency
FROM proposals p
WHERE l.id = p.lead_id
  AND p.status = 'paid'
  AND l.status = 'won';
