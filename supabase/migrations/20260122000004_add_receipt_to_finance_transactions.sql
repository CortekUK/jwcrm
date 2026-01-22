-- Migration: Add receipt_path column to finance_transactions table
-- Created: 2026-01-22

-- Add receipt_path column for optional receipt uploads
ALTER TABLE finance_transactions
ADD COLUMN receipt_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN finance_transactions.receipt_path IS 'Optional path to uploaded receipt file in storage';
