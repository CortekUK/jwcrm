-- Migration: Create leads table for Lead Management module
-- Created: 2026-01-08

-- Create lead status enum type
CREATE TYPE lead_status AS ENUM ('not_started', 'pending', 'won', 'lost');

-- Create leads table
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company_name TEXT,
    notes TEXT,
    source TEXT,
    status lead_status NOT NULL DEFAULT 'not_started',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on status for filtering
CREATE INDEX idx_leads_status ON leads(status);

-- Create index on email for searching
CREATE INDEX idx_leads_email ON leads(email);

-- Create index on created_at for sorting
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_leads_updated_at();

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- RLS Policy: lead_management role can do everything
CREATE POLICY "lead_management_full_access" ON leads
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
CREATE POLICY "admin_full_access" ON leads
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

-- Add comment for documentation
COMMENT ON TABLE leads IS 'Stores lead information for the Lead Management module';
COMMENT ON COLUMN leads.status IS 'Lead status: not_started (new), pending (proposal sent), won (paid), lost (rejected)';
COMMENT ON COLUMN leads.source IS 'How the lead found us (e.g., referral, website, social media)';
