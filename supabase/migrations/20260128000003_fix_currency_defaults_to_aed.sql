-- Fix currency defaults from USD to AED
-- This migration updates the default currency for all tables to AED (UAE Dirhams)

-- Update proposals table default
ALTER TABLE proposals
ALTER COLUMN currency SET DEFAULT 'AED';

-- Update leads table default for paid_currency
ALTER TABLE leads
ALTER COLUMN paid_currency SET DEFAULT 'AED';

-- Update finance_transactions table default
ALTER TABLE finance_transactions
ALTER COLUMN currency SET DEFAULT 'AED';

-- Update comments to reflect the change
COMMENT ON COLUMN proposals.currency IS 'Currency for the proposal amount (default AED)';
COMMENT ON COLUMN leads.paid_currency IS 'Currency of the payment (default AED)';
COMMENT ON COLUMN finance_transactions.currency IS 'Currency for the transaction (default AED)';
