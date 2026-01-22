-- Add general_beneficiaries array to existing wills for backward compatibility
-- This ensures all wills have the general_beneficiaries field initialized as an empty array

UPDATE public.wills
SET answers = jsonb_set(
  answers,
  '{general_beneficiaries}',
  '[]'::jsonb,
  true
)
WHERE NOT (answers ? 'general_beneficiaries');

-- Note: No table schema changes needed since answers is already a JSONB column
-- The general_beneficiaries array will be stored within the answers JSONB field
