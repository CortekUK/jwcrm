-- Migration: Create source_salesperson_assignments table
-- Created: 2026-01-20
-- Description: Junction table for assigning salespeople to lead sources

-- Create source_salesperson_assignments table
CREATE TABLE source_salesperson_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES lead_sources(id) ON DELETE CASCADE,
    salesperson_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add UNIQUE constraint on salesperson_id (each salesperson can only be assigned to one source)
CREATE UNIQUE INDEX idx_source_salesperson_unique ON source_salesperson_assignments(salesperson_id);

-- Create index on source_id for lookups
CREATE INDEX idx_source_salesperson_source ON source_salesperson_assignments(source_id);

-- Enable Row Level Security
ALTER TABLE source_salesperson_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: lead_management role has full access
CREATE POLICY "lead_management_full_access" ON source_salesperson_assignments
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
CREATE POLICY "admin_full_access" ON source_salesperson_assignments
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
CREATE POLICY "superadmin_full_access" ON source_salesperson_assignments
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

-- RLS Policy: salesperson can see their own assignments
CREATE POLICY "salesperson_read_own" ON source_salesperson_assignments
    FOR SELECT
    TO authenticated
    USING (
        salesperson_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'salesperson'
        )
    );

-- Add comments for documentation
COMMENT ON TABLE source_salesperson_assignments IS 'Junction table assigning salespeople to lead sources';
COMMENT ON COLUMN source_salesperson_assignments.source_id IS 'Reference to the lead source';
COMMENT ON COLUMN source_salesperson_assignments.salesperson_id IS 'Reference to the salesperson user';
COMMENT ON COLUMN source_salesperson_assignments.assigned_at IS 'When the assignment was created';
