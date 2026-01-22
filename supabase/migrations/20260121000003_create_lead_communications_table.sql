-- Migration: Create lead_communications table
-- Created: 2026-01-21
-- Description: Table to log communications with leads during consultation stage

-- Create lead_communications table
CREATE TABLE IF NOT EXISTS public.lead_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    communication_method_id UUID NOT NULL REFERENCES public.communication_methods(id) ON DELETE RESTRICT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.lead_communications IS 'Log of communications with leads during consultation stage';
COMMENT ON COLUMN public.lead_communications.scheduled_at IS 'When the communication took place or is scheduled';
COMMENT ON COLUMN public.lead_communications.notes IS 'Optional notes about the communication';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_communications_lead_id ON public.lead_communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_communications_scheduled_at ON public.lead_communications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_lead_communications_created_by ON public.lead_communications(created_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_lead_communications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_communications_updated_at
    BEFORE UPDATE ON public.lead_communications
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_communications_updated_at();

-- Enable RLS
ALTER TABLE public.lead_communications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Lead managers and admins have full access
CREATE POLICY "Lead managers can manage all communications"
    ON public.lead_communications
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'superadmin', 'lead_management')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'superadmin', 'lead_management')
        )
    );

-- Salespeople can view and create communications for their assigned leads
CREATE POLICY "Salespeople can view communications for assigned leads"
    ON public.lead_communications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = lead_communications.lead_id
            AND leads.assigned_to = auth.uid()
        )
    );

CREATE POLICY "Salespeople can create communications for assigned leads"
    ON public.lead_communications
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = lead_communications.lead_id
            AND leads.assigned_to = auth.uid()
        )
        AND created_by = auth.uid()
    );

CREATE POLICY "Salespeople can update their own communications"
    ON public.lead_communications
    FOR UPDATE
    USING (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = lead_communications.lead_id
            AND leads.assigned_to = auth.uid()
        )
    )
    WITH CHECK (
        created_by = auth.uid()
    );

CREATE POLICY "Salespeople can delete their own communications"
    ON public.lead_communications
    FOR DELETE
    USING (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = lead_communications.lead_id
            AND leads.assigned_to = auth.uid()
        )
    );
