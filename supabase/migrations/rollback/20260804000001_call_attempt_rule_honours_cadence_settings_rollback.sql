-- Rollback for 20260804000001_call_attempt_rule_honours_cadence_settings.sql
--
-- Restores `public.handle_call_attempt()` to the definition created by
-- 20260306000010_auto_call_reminders.sql — the hardcoded 3-attempt rule with
-- the fixed ('no_answer','voicemail','busy') failed-outcome set. Copied
-- verbatim from that migration (the live database could not be queried with
-- pg_get_functiondef from this environment; no later migration redefines this
-- function, so that file is the current definition).
--
-- The trigger `trigger_handle_call_attempt` is untouched by both the migration
-- and this rollback — only the function body changes.

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

COMMENT ON FUNCTION public.handle_call_attempt() IS 'Handles call outcomes: creates retry reminders for unsuccessful calls, marks lead unreachable after 3 failed attempts';
