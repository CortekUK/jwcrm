-- Migration: Add lead assignment fields
-- Created: 2026-01-20
-- Description: Adds source_id, assigned_to, and assigned_at fields to leads table for automatic assignment

-- Add source_id column (FK to lead_sources, nullable for existing leads)
ALTER TABLE leads ADD COLUMN source_id UUID REFERENCES lead_sources(id) ON DELETE SET NULL;

-- Add assigned_to column (FK to auth.users, nullable)
ALTER TABLE leads ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add assigned_at timestamp column
ALTER TABLE leads ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX idx_leads_source_id ON leads(source_id);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);

-- Update RLS policies to allow salesperson to view/update only their assigned leads

-- Drop existing policies first (if they exist) to recreate them
DROP POLICY IF EXISTS "salesperson_view_assigned" ON leads;
DROP POLICY IF EXISTS "salesperson_update_assigned" ON leads;

-- RLS Policy: salesperson can view their assigned leads
CREATE POLICY "salesperson_view_assigned" ON leads
    FOR SELECT
    TO authenticated
    USING (
        assigned_to = auth.uid() AND
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'salesperson'
        )
    );

-- RLS Policy: salesperson can update their assigned leads
CREATE POLICY "salesperson_update_assigned" ON leads
    FOR UPDATE
    TO authenticated
    USING (
        assigned_to = auth.uid() AND
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'salesperson'
        )
    )
    WITH CHECK (
        assigned_to = auth.uid() AND
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'salesperson'
        )
    );

-- Add comments for documentation
COMMENT ON COLUMN leads.source_id IS 'Reference to lead_sources table for dynamic source management';
COMMENT ON COLUMN leads.assigned_to IS 'User ID of the salesperson assigned to this lead';
COMMENT ON COLUMN leads.assigned_at IS 'Timestamp when the lead was assigned to the salesperson';
