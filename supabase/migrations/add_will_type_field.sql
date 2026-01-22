-- Migration: Add will_type field support to existing wills
-- Purpose: Add support for General vs Specific Will types
-- Date: 2025-01-20

-- This migration updates existing wills to set will_type = 'general' by default
-- New fields are stored in the existing JSONB 'answers' column, so no schema changes needed

-- Update all existing wills to have will_type = 'general' if not already set
UPDATE wills
SET answers = jsonb_set(
  COALESCE(answers, '{}'::jsonb),
  '{will_type}',
  '"general"'
)
WHERE answers IS NULL
   OR NOT (answers ? 'will_type');

-- Ensure all existing assets have the new fields with default values
-- This handles backward compatibility for assets that don't have title, beneficiary_name, documents, or photo_path
UPDATE wills
SET answers = jsonb_set(
  answers,
  '{assets}',
  (
    SELECT jsonb_agg(
      asset ||
      CASE WHEN NOT (asset ? 'title') THEN jsonb_build_object('title', '') ELSE '{}'::jsonb END ||
      CASE WHEN NOT (asset ? 'beneficiary_name') THEN jsonb_build_object('beneficiary_name', '') ELSE '{}'::jsonb END ||
      CASE WHEN NOT (asset ? 'documents') THEN jsonb_build_object('documents', '[]'::jsonb) ELSE '{}'::jsonb END ||
      CASE WHEN NOT (asset ? 'photo_path') THEN jsonb_build_object('photo_path', null) ELSE '{}'::jsonb END ||
      CASE WHEN NOT (asset ? 'id') THEN jsonb_build_object('id', gen_random_uuid()::text) ELSE '{}'::jsonb END
    )
    FROM jsonb_array_elements(answers->'assets') AS asset
  )
)
WHERE answers ? 'assets'
  AND jsonb_array_length(answers->'assets') > 0;

-- Add comment explaining the new structure
COMMENT ON COLUMN wills.answers IS 'JSONB column storing will form answers.
Structure includes:
- will_type: "general" | "specific" (added 2025-01-20)
- assets[]: Enhanced with title, beneficiary_name, documents[], photo_path (added 2025-01-20)
- All other existing fields preserved';
