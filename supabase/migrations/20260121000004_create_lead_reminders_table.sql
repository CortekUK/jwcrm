-- Migration: Create lead_reminders table
-- Created: 2026-01-21
-- Description: Table to store reminders for lead follow-ups

-- Create reminder status enum
DO $$ BEGIN
    CREATE TYPE public.reminder_status AS ENUM ('pending', 'triggered', 'done', 'dismissed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create lead_reminders table
CREATE TABLE IF NOT EXISTS public.lead_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    salesperson_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    remind_at TIMESTAMPTZ NOT NULL,
    status public.reminder_status DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.lead_reminders IS 'Reminders for lead follow-ups';
COMMENT ON COLUMN public.lead_reminders.remind_at IS 'When to trigger the reminder notification';
COMMENT ON COLUMN public.lead_reminders.status IS 'pending: not yet triggered, triggered: notification sent awaiting action, done: completed, dismissed: ignored';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_reminders_salesperson_id ON public.lead_reminders(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_lead_reminders_lead_id ON public.lead_reminders(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_reminders_remind_at ON public.lead_reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_lead_reminders_status ON public.lead_reminders(status);
CREATE INDEX IF NOT EXISTS idx_lead_reminders_pending_reminders ON public.lead_reminders(salesperson_id, status, remind_at)
    WHERE status IN ('pending', 'triggered');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_lead_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_reminders_updated_at
    BEFORE UPDATE ON public.lead_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_reminders_updated_at();

-- Enable RLS
ALTER TABLE public.lead_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Salespeople can CRUD their own reminders
CREATE POLICY "Salespeople can view their own reminders"
    ON public.lead_reminders
    FOR SELECT
    USING (salesperson_id = auth.uid());

CREATE POLICY "Salespeople can create their own reminders"
    ON public.lead_reminders
    FOR INSERT
    WITH CHECK (salesperson_id = auth.uid());

CREATE POLICY "Salespeople can update their own reminders"
    ON public.lead_reminders
    FOR UPDATE
    USING (salesperson_id = auth.uid())
    WITH CHECK (salesperson_id = auth.uid());

CREATE POLICY "Salespeople can delete their own reminders"
    ON public.lead_reminders
    FOR DELETE
    USING (salesperson_id = auth.uid());

-- Lead managers and admins can view all reminders
CREATE POLICY "Lead managers can view all reminders"
    ON public.lead_reminders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'superadmin', 'lead_management')
        )
    );
