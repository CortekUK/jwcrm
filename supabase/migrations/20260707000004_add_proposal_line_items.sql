-- Migration: Itemised invoice line items
-- Created: 2026-07-07
-- Client request: "Invoice needs to be able to add court fee in and the above"
-- (drafting, POA/MOFA & MOJ, etc.). Stored as JSONB [{description, amount}].

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN proposals.line_items IS 'Itemised invoice charges: [{description, amount}]. Subtotal is their sum; amount column kept for backward compatibility.';
