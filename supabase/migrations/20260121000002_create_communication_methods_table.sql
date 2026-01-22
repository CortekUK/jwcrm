-- Migration: Create communication_methods table
-- Created: 2026-01-21
-- Description: Table to store available communication methods for lead consultations

-- Create communication_methods table
CREATE TABLE IF NOT EXISTS public.communication_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'phone',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.communication_methods IS 'Available communication methods for lead consultations (Phone, WhatsApp, Email, etc.)';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_communication_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER communication_methods_updated_at
    BEFORE UPDATE ON public.communication_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_communication_methods_updated_at();

-- Seed default communication methods
INSERT INTO public.communication_methods (name, icon, display_order) VALUES
    ('Phone', 'phone', 1),
    ('WhatsApp', 'message-circle', 2),
    ('Email', 'mail', 3),
    ('Video Call', 'video', 4),
    ('In-Person', 'users', 5)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.communication_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Lead managers and admins have full access
CREATE POLICY "Lead managers can manage communication methods"
    ON public.communication_methods
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

-- Salespeople can read active methods
CREATE POLICY "Salespeople can view active communication methods"
    ON public.communication_methods
    FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'salesperson'
        )
    );
