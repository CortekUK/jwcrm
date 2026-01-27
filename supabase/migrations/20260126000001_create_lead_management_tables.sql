-- Migration: Create Lead Management Enhancement Tables
-- Description: Creates tables for lead notifications, documents, and activities

-- ============================================
-- 1. Create lead_notifications table
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('lead_assigned', 'status_changed', 'reminder_due', 'proposal_viewed', 'proposal_paid', 'new_lead')),
    title TEXT NOT NULL,
    message TEXT,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_notification_type CHECK (
        type IN ('lead_assigned', 'status_changed', 'reminder_due', 'proposal_viewed', 'proposal_paid', 'new_lead')
    )
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_lead_notifications_user_id ON public.lead_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_notifications_is_read ON public.lead_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_lead_notifications_created_at ON public.lead_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_notifications_lead_id ON public.lead_notifications(lead_id);

-- Enable RLS
ALTER TABLE public.lead_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_notifications
CREATE POLICY "Users can view their own notifications"
    ON public.lead_notifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON public.lead_notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
    ON public.lead_notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
    ON public.lead_notifications
    FOR INSERT
    WITH CHECK (true);


-- ============================================
-- 2. Create lead_documents table
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    file_type TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('contract', 'id', 'proposal', 'invoice', 'other')),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_document_category CHECK (
        category IN ('contract', 'id', 'proposal', 'invoice', 'other')
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_documents_lead_id ON public.lead_documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_documents_category ON public.lead_documents(category);
CREATE INDEX IF NOT EXISTS idx_lead_documents_uploaded_by ON public.lead_documents(uploaded_by);

-- Enable RLS
ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_documents
-- Lead managers and salespeople with access can view documents
CREATE POLICY "Authorized users can view lead documents"
    ON public.lead_documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('admin', 'superadmin', 'lead_manager')
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.leads l
            WHERE l.id = lead_id
            AND l.assigned_to = auth.uid()
        )
    );

CREATE POLICY "Lead managers can manage documents"
    ON public.lead_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('admin', 'superadmin', 'lead_manager')
        )
    );

CREATE POLICY "Salespeople can upload to their leads"
    ON public.lead_documents
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.leads l
            WHERE l.id = lead_id
            AND l.assigned_to = auth.uid()
        )
    );


-- ============================================
-- 3. Create lead_activities table
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('lead_created', 'lead_updated', 'status_changed', 'communication_logged', 'reminder_created', 'reminder_completed', 'proposal_sent', 'proposal_paid', 'lead_assigned')),
    title TEXT NOT NULL,
    description TEXT,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    old_value TEXT,
    new_value TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_user_id ON public.lead_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_type ON public.lead_activities(type);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON public.lead_activities(created_at DESC);

-- Enable RLS
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_activities
CREATE POLICY "Authorized users can view activities"
    ON public.lead_activities
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('admin', 'superadmin', 'lead_manager', 'salesperson')
        )
    );

CREATE POLICY "System can insert activities"
    ON public.lead_activities
    FOR INSERT
    WITH CHECK (true);


-- ============================================
-- 4. Create lead-documents storage bucket
-- ============================================

-- Note: Bucket creation is done via Supabase Dashboard or API
-- This is a placeholder for documentation

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--     'lead-documents',
--     'lead-documents',
--     false,
--     10485760, -- 10MB
--     ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies would be:
-- SELECT: Users can view documents for leads they have access to
-- INSERT: Users can upload documents for leads they have access to
-- DELETE: Lead managers can delete documents


-- ============================================
-- 5. Create function to auto-create notifications
-- ============================================

CREATE OR REPLACE FUNCTION public.create_lead_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- When a lead is assigned
    IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
        INSERT INTO public.lead_notifications (user_id, type, title, message, lead_id)
        VALUES (
            NEW.assigned_to,
            'lead_assigned',
            'New lead assigned to you',
            'Lead: ' || NEW.full_name,
            NEW.id
        );
    END IF;

    -- When lead status changes
    IF TG_OP = 'UPDATE' AND NEW.status != OLD.status AND NEW.assigned_to IS NOT NULL THEN
        INSERT INTO public.lead_notifications (user_id, type, title, message, lead_id)
        VALUES (
            NEW.assigned_to,
            'status_changed',
            'Lead status updated',
            'Lead moved to ' || NEW.status,
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_create_lead_notification ON public.leads;
CREATE TRIGGER trigger_create_lead_notification
    AFTER UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.create_lead_notification();


-- ============================================
-- 6. Create function to log lead activities
-- ============================================

CREATE OR REPLACE FUNCTION public.log_lead_activity()
RETURNS TRIGGER AS $$
DECLARE
    activity_title TEXT;
    activity_description TEXT;
    activity_type TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.lead_activities (type, title, description, lead_id, user_id)
        VALUES (
            'lead_created',
            'New lead created',
            'Lead ' || NEW.full_name || ' was created',
            NEW.id,
            auth.uid()
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Log status changes
        IF NEW.status != OLD.status THEN
            INSERT INTO public.lead_activities (type, title, description, lead_id, user_id, old_value, new_value)
            VALUES (
                'status_changed',
                'Lead status updated',
                'Status changed from ' || OLD.status || ' to ' || NEW.status,
                NEW.id,
                auth.uid(),
                OLD.status,
                NEW.status
            );
        END IF;

        -- Log assignment changes
        IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
            INSERT INTO public.lead_activities (type, title, description, lead_id, user_id, old_value, new_value)
            VALUES (
                'lead_assigned',
                'Lead assigned',
                'Lead was assigned to a new salesperson',
                NEW.id,
                auth.uid(),
                OLD.assigned_to::text,
                NEW.assigned_to::text
            );
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for activity logging
DROP TRIGGER IF EXISTS trigger_log_lead_activity ON public.leads;
CREATE TRIGGER trigger_log_lead_activity
    AFTER INSERT OR UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.log_lead_activity();


-- ============================================
-- Grant permissions
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_documents TO authenticated;
GRANT SELECT, INSERT ON public.lead_activities TO authenticated;

-- Grant usage on sequences if any
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
