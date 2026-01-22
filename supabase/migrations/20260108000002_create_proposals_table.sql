-- Migration: Create proposals table for Lead Management module
-- Created: 2026-01-08

-- Create proposal status enum type
CREATE TYPE proposal_status AS ENUM ('draft', 'sent', 'paid', 'cancelled');

-- Create proposals table
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    proposal_content TEXT, -- TipTap HTML content
    proposal_pdf_path TEXT,
    invoice_pdf_path TEXT,
    invoice_number TEXT UNIQUE,
    stripe_payment_link TEXT,
    stripe_payment_intent_id TEXT,
    stripe_checkout_session_id TEXT,
    status proposal_status NOT NULL DEFAULT 'draft',
    sent_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on lead_id for lookups
CREATE INDEX idx_proposals_lead_id ON proposals(lead_id);

-- Create index on status for filtering
CREATE INDEX idx_proposals_status ON proposals(status);

-- Create index on invoice_number for lookups
CREATE INDEX idx_proposals_invoice_number ON proposals(invoice_number);

-- Create index on stripe_checkout_session_id for webhook lookups
CREATE INDEX idx_proposals_stripe_session ON proposals(stripe_checkout_session_id);

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    sequence_num INT;
    new_invoice_number TEXT;
BEGIN
    -- Get current year
    year_prefix := TO_CHAR(NOW(), 'YYYY');

    -- Get the next sequence number for this year
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(invoice_number FROM 'INV-' || year_prefix || '-(\d+)') AS INT)
    ), 0) + 1
    INTO sequence_num
    FROM proposals
    WHERE invoice_number LIKE 'INV-' || year_prefix || '-%';

    -- Generate invoice number: INV-YYYY-XXXXX (5 digit padded)
    new_invoice_number := 'INV-' || year_prefix || '-' || LPAD(sequence_num::TEXT, 5, '0');

    NEW.invoice_number := new_invoice_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate invoice number on insert
CREATE TRIGGER trigger_generate_invoice_number
    BEFORE INSERT ON proposals
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL)
    EXECUTE FUNCTION generate_invoice_number();

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_proposals_updated_at
    BEFORE UPDATE ON proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_proposals_updated_at();

-- Enable Row Level Security
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policy: lead_management role can do everything
CREATE POLICY "lead_management_full_access" ON proposals
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'lead_management'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'lead_management'
        )
    );

-- RLS Policy: admin role can do everything
CREATE POLICY "admin_full_access" ON proposals
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Add comments for documentation
COMMENT ON TABLE proposals IS 'Stores proposals and invoices sent to leads';
COMMENT ON COLUMN proposals.proposal_content IS 'HTML content from TipTap editor for the proposal agreement';
COMMENT ON COLUMN proposals.invoice_number IS 'Auto-generated invoice number in format INV-YYYY-XXXXX';
COMMENT ON COLUMN proposals.stripe_payment_link IS 'Stripe checkout URL for payment';
COMMENT ON COLUMN proposals.stripe_checkout_session_id IS 'Stripe checkout session ID for webhook verification';
