-- Migration: Create lead_sources table
-- Created: 2026-01-20
-- Description: Creates a table to manage lead sources for the Lead Management module

-- Create lead_sources table
CREATE TABLE lead_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint on name
CREATE UNIQUE INDEX idx_lead_sources_name ON lead_sources(LOWER(name));

-- Create index on is_active for filtering
CREATE INDEX idx_lead_sources_is_active ON lead_sources(is_active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_lead_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lead_sources_updated_at
    BEFORE UPDATE ON lead_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_sources_updated_at();

-- Enable Row Level Security
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policy: lead_management role has full access
CREATE POLICY "lead_management_full_access" ON lead_sources
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

-- RLS Policy: admin role has full access
CREATE POLICY "admin_full_access" ON lead_sources
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

-- RLS Policy: superadmin role has full access
CREATE POLICY "superadmin_full_access" ON lead_sources
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'superadmin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'superadmin'
        )
    );

-- RLS Policy: salesperson can only read active sources
CREATE POLICY "salesperson_read_access" ON lead_sources
    FOR SELECT
    TO authenticated
    USING (
        is_active = true AND
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'salesperson'
        )
    );

-- Add comments for documentation
COMMENT ON TABLE lead_sources IS 'Stores lead sources for the Lead Management module';
COMMENT ON COLUMN lead_sources.name IS 'Unique name of the lead source';
COMMENT ON COLUMN lead_sources.description IS 'Optional description of the lead source';
COMMENT ON COLUMN lead_sources.is_active IS 'Whether the source is active and available for new leads';
