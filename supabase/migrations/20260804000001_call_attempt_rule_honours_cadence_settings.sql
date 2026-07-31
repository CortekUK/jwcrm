-- Migration: make the call-attempt rule honour the configured contact cadence
-- Created: 2026-07-30
--
-- Problem
-- -------
-- `public.handle_call_attempt()` (migration 20260306000010_auto_call_reminders.sql)
-- hardcodes the 3-attempt rule:
--
--     IF COALESCE(current_attempts, 0) + 1 < 3 THEN ... 'Retry call - Attempt %s of 3'
--     ELSE  UPDATE public.leads SET status = 'unreachable' ...
--
-- and hardcodes the set of failed outcomes as ('no_answer','voicemail','busy').
-- It never reads `system_settings.lead_followup_cadence`, so the Contact Cadence
-- controls in the Lead Management settings UI (`maxAttempts`,
-- `autoMarkUnreachable`, `failedOutcomes`) change nothing at all: set max
-- attempts to 5 and leads are still marked unreachable at 3; switch auto-mark
-- off and they are still marked.
--
-- Fix
-- ---
-- Read the setting row and use it. Everything else the trigger does is
-- unchanged: attempt counting, `last_call_attempt_at`, the 2-hour retry
-- reminder, the reset-on-`answered` branch, and the "no reminder on the final
-- attempt" shape of the original IF/ELSE.
--
-- Behaviour when the setting is absent or malformed is EXACTLY the old
-- behaviour: maxAttempts 3, autoMarkUnreachable true, failed outcomes
-- ('no_answer','voicemail','busy'). The settings read is wrapped in its own
-- exception block so a bad settings row can never block an insert into
-- lead_communications.
--
-- NOTE on `wrong_number`: the old function ignored it entirely (no increment,
-- no reset). It is now counted as a failed attempt if — and only if — an admin
-- has it listed in `failedOutcomes`. The application default for that array
-- does include it, so with a settings row present this is a deliberate
-- behaviour change: `wrong_number` starts counting. Outcomes that are neither
-- in `failedOutcomes` nor `answered` are still ignored, exactly as before.

CREATE OR REPLACE FUNCTION public.handle_call_attempt()
RETURNS TRIGGER AS $$
DECLARE
    current_attempts INTEGER;
    lead_salesperson UUID;
    lead_name TEXT;
    cadence JSONB;
    max_attempts INTEGER := 3;
    auto_mark_unreachable BOOLEAN := TRUE;
    failed_outcomes TEXT[] := ARRAY['no_answer', 'voicemail', 'busy'];
    next_attempt INTEGER;
BEGIN
    -- Only process if call_outcome is set (phone calls)
    IF NEW.call_outcome IS NULL THEN
        RETURN NEW;
    END IF;

    -- Contact cadence, as configured in Lead Management > Settings. Any
    -- problem reading or parsing it falls back to the historical hardcoded
    -- values rather than failing the communication insert.
    BEGIN
        SELECT setting_value
        INTO cadence
        FROM public.system_settings
        WHERE setting_key = 'lead_followup_cadence'
        LIMIT 1;

        IF cadence IS NOT NULL THEN
            IF jsonb_typeof(cadence->'maxAttempts') = 'number' THEN
                max_attempts := GREATEST(1, (cadence->>'maxAttempts')::INTEGER);
            END IF;

            IF jsonb_typeof(cadence->'autoMarkUnreachable') = 'boolean' THEN
                auto_mark_unreachable := (cadence->>'autoMarkUnreachable')::BOOLEAN;
            END IF;

            IF jsonb_typeof(cadence->'failedOutcomes') = 'array'
               AND jsonb_array_length(cadence->'failedOutcomes') > 0 THEN
                SELECT array_agg(value)
                INTO failed_outcomes
                FROM jsonb_array_elements_text(cadence->'failedOutcomes') AS value;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        max_attempts := 3;
        auto_mark_unreachable := TRUE;
        failed_outcomes := ARRAY['no_answer', 'voicemail', 'busy'];
    END;

    -- Get current attempt count, salesperson, and lead name
    SELECT call_attempt_count, assigned_to, full_name
    INTO current_attempts, lead_salesperson, lead_name
    FROM public.leads
    WHERE id = NEW.lead_id;

    -- Handle unsuccessful call outcomes
    IF NEW.call_outcome::TEXT = ANY (failed_outcomes) THEN

        next_attempt := COALESCE(current_attempts, 0) + 1;

        -- Increment attempt count
        UPDATE public.leads SET
            call_attempt_count = next_attempt,
            last_call_attempt_at = NOW()
        WHERE id = NEW.lead_id;

        IF next_attempt < max_attempts THEN
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
                format('Retry call - Attempt %s of %s', next_attempt + 1, max_attempts),
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
        ELSIF auto_mark_unreachable THEN
            -- Configured attempt limit reached - mark as unreachable.
            -- With auto-marking switched off this branch does nothing: the
            -- attempt is still counted and `last_call_attempt_at` still moves,
            -- the lead is simply left in its current status.
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

COMMENT ON FUNCTION public.handle_call_attempt() IS 'Handles call outcomes using the contact cadence in system_settings.lead_followup_cadence (maxAttempts / autoMarkUnreachable / failedOutcomes): creates retry reminders for failed calls and marks the lead unreachable once the configured attempt limit is reached. Falls back to 3 attempts / auto-mark on / (no_answer, voicemail, busy) when the setting is missing.';
