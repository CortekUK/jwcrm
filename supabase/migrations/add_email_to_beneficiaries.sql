-- Migration: Add email to beneficiaries in answers JSONB field
-- This script updates all existing beneficiaries to include an email field with default empty value

DO $$
DECLARE
  will_record RECORD;
  updated_answers JSONB;
  beneficiary JSONB;
  updated_beneficiaries JSONB;
BEGIN
  -- Loop through all wills that have beneficiaries
  FOR will_record IN
    SELECT id, answers
    FROM wills
    WHERE answers ? 'beneficiaries'
      AND jsonb_array_length(answers->'beneficiaries') > 0
  LOOP
    updated_beneficiaries := '[]'::jsonb;

    -- Loop through each beneficiary and add email if missing
    FOR beneficiary IN
      SELECT * FROM jsonb_array_elements(will_record.answers->'beneficiaries')
    LOOP
      -- Add email field if it doesn't exist
      IF NOT (beneficiary ? 'email') THEN
        beneficiary := beneficiary || jsonb_build_object('email', '');
      END IF;

      -- Add to updated array
      updated_beneficiaries := updated_beneficiaries || jsonb_build_array(beneficiary);
    END LOOP;

    -- Update the answers with new beneficiaries array
    updated_answers := will_record.answers || jsonb_build_object('beneficiaries', updated_beneficiaries);

    -- Update the record
    UPDATE wills
    SET answers = updated_answers
    WHERE id = will_record.id;

    RAISE NOTICE 'Updated will ID: % with % beneficiaries', will_record.id, jsonb_array_length(updated_beneficiaries);
  END LOOP;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added email to all beneficiaries';
END $$;
