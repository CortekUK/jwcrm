-- Migration: Auto Call Reminders
-- Created: 2026-01-29
-- Description: Implements automatic "call within 15 minutes" reminder on lead assignment
--              and 3-attempt rule with auto-reminders for unanswered calls

-- ============================================
-- PART 1: Schema Changes
-- ============================================

-- Add 'contacted' status if not exists (used when communication is logged)
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'contacted';

-- Add 'unreachable' status for leads that fail 3 call attempts
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'unreachable';

-- Create call_outcome enum for tracking call results
DO $$ BEGIN
    CREATE TYPE public.call_outcome AS ENUM (
        'answered',
        'no_answer',
        'voicemail',
        'busy',
        'wrong_number'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add call_outcome column to lead_communications
ALTER TABLE public.lead_communications 
    ADD COLUMN IF NOT EXISTS call_outcome public.call_outcome;

-- Add attempt tracking columns to leads
ALTER TABLE public.leads 
    ADD COLUMN IF NOT EXISTS call_attempt_count INTEGER DEFAULT 0;
ALTER TABLE public.leads 
    ADD COLUMN IF NOT EXISTS last_call_attempt_at TIMESTAMPTZ;

-- Add index for filtering by call_outcome
CREATE INDEX IF NOT EXISTS idx_lead_communications_call_outcome 
    ON public.lead_communications(call_outcome);

-- Add comments for documentation
COMMENT ON COLUMN public.lead_communications.call_outcome IS 'Outcome of phone call: answered, no_answer, voicemail, busy, wrong_number';
COMMENT ON COLUMN public.leads.call_attempt_count IS 'Number of unsuccessful call attempts (resets on successful contact)';
COMMENT ON COLUMN public.leads.last_call_attempt_at IS 'Timestamp of the last call attempt';

-- ============================================
-- PART 2: Feature 1 - Auto-create "Call within 15 minutes" reminder
-- ============================================

-- Function to create initial call reminder when lead is assigned
CREATE OR REPLACE FUNCTION public.create_initial_call_reminder()
RETURNS TRIGGER AS $$
BEGIN
    -- Fire when lead is assigned (new assignment or reassignment)
    IF NEW.assigned_to IS NOT NULL AND 
       (OLD IS NULL OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
        
        INSERT INTO public.lead_reminders (
            id,
            lead_id,
            salesperson_id,
            title,
            description,
            remind_at,
            status
        ) VALUES (
            gen_random_uuid(),
            NEW.id,
            NEW.assigned_to,
            'Call new lead within 15 minutes',
            'New lead assigned - make initial contact call to ' || COALESCE(NEW.full_name, 'the lead'),
            NOW() + INTERVAL '15 minutes',
            'pending'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for initial call reminder
DROP TRIGGER IF EXISTS trigger_create_initial_call_reminder ON public.leads;
CREATE TRIGGER trigger_create_initial_call_reminder
    AFTER INSERT OR UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.create_initial_call_reminder();

-- ============================================
-- PART 3: Feature 2 - 3-Attempt Rule with Auto-Reminders
-- ============================================

-- Function to handle call attempts and create follow-up reminders
CREATE OR REPLACE FUNCTION public.handle_call_attempt()
RETURNS TRIGGER AS $$
DECLARE
    current_attempts INTEGER;
    lead_salesperson UUID;
    lead_name TEXT;
BEGIN
    -- Only process if call_outcome is set (phone calls)
    IF NEW.call_outcome IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get current attempt count, salesperson, and lead name
    SELECT call_attempt_count, assigned_to, full_name 
    INTO current_attempts, lead_salesperson, lead_name
    FROM public.leads 
    WHERE id = NEW.lead_id;

    -- Handle unsuccessful call outcomes
    IF NEW.call_outcome IN ('no_answer', 'voicemail', 'busy') THEN
        
        -- Increment attempt count
        UPDATE public.leads SET 
            call_attempt_count = COALESCE(current_attempts, 0) + 1,
            last_call_attempt_at = NOW()
        WHERE id = NEW.lead_id;

        IF COALESCE(current_attempts, 0) + 1 < 3 THEN
            -- Create retry reminder (2 hours later)
            INSERT INTO public.lead_reminders (
                id,
                lead_id,
                salesperson_id,
                title,
                description,
                remind_at,
                status
            ) VALUES (
                gen_random_uuid(),
                NEW.lead_id,
                COALESCE(lead_salesperson, NEW.created_by),
                format('Retry call - Attempt %s of 3', COALESCE(current_attempts, 0) + 2),
                format('Previous attempt result: %s. Try calling %s again.', 
                    CASE NEW.call_outcome 
                        WHEN 'no_answer' THEN 'No answer'
                        WHEN 'voicemail' THEN 'Voicemail'
                        WHEN 'busy' THEN 'Busy'
                        ELSE NEW.call_outcome::text
                    END,
                    COALESCE(lead_name, 'the lead')),
                NOW() + INTERVAL '2 hours',
                'pending'
            );
        ELSE
            -- 3 attempts reached - mark as unreachable
            UPDATE public.leads 
            SET status = 'unreachable' 
            WHERE id = NEW.lead_id;
        END IF;

    ELSIF NEW.call_outcome = 'answered' THEN
        -- Reset attempt count on successful contact
        UPDATE public.leads SET 
            call_attempt_count = 0,
            last_call_attempt_at = NOW()
        WHERE id = NEW.lead_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for call attempt handling
DROP TRIGGER IF EXISTS trigger_handle_call_attempt ON public.lead_communications;
CREATE TRIGGER trigger_handle_call_attempt
    AFTER INSERT ON public.lead_communications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_call_attempt();

-- ============================================
-- PART 4: Update comments for documentation
-- ============================================

COMMENT ON FUNCTION public.create_initial_call_reminder() IS 'Creates automatic reminder when a lead is assigned to a salesperson';
COMMENT ON FUNCTION public.handle_call_attempt() IS 'Handles call outcomes: creates retry reminders for unsuccessful calls, marks lead unreachable after 3 failed attempts';
COMMENT ON TYPE public.lead_status IS 'Lead status values: not_started (new), contacted (initial contact made), consultation (in consultation), meeting (meeting scheduled), hold (on hold), qualified (lead qualified), negotiation (in negotiation), pending (proposal sent), won (paid), lost (rejected), unreachable (3 failed call attempts)';
