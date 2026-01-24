-- ============================================
-- Supabase Schema Update: Add Proof of Address
-- ============================================
-- This script adds poa_path (proof of address path) fields 
-- to executors and beneficiaries in the wills table

-- The wills table has a JSONB column called 'answers' that stores all form data
-- We don't need to alter the table structure, but we should:
-- 1. Document the new fields
-- 2. Add any necessary indexes for performance
-- 3. Backfill existing records if needed

-- ============================================
-- DOCUMENTATION: New Fields in answers JSONB
-- ============================================

-- Executors (answers.executors array):
-- Each executor object now includes:
--   - passport_path?: string (existing)
--   - passport_number?: string (existing)
--   - passport_metadata?: object (existing)
--   - poa_path?: string (NEW - proof of address storage path)

-- Beneficiaries (answers.beneficiaries array):
-- Each beneficiary object now includes:
--   - passport_path?: string (existing)
--   - passport_number?: string (existing)
--   - poa_path?: string (NEW - proof of address storage path)

-- ============================================
-- OPTIONAL: Add GIN Index for Better Query Performance
-- ============================================

-- If you need to query by poa_path, you can add an index:
-- Note: Only add if you'll be querying these fields frequently

-- Index for executors with poa_path
CREATE INDEX IF NOT EXISTS idx_wills_executors_poa_path 
ON wills USING GIN ((answers->'executors'));

-- Index for beneficiaries with poa_path
CREATE INDEX IF NOT EXISTS idx_wills_beneficiaries_poa_path 
ON wills USING GIN ((answers->'beneficiaries'));

-- ============================================
-- OPTIONAL: Backfill Existing Records
-- ============================================

-- If you want to initialize poa_path to null for existing records:
-- (This is optional - the app handles undefined gracefully)

-- Update executors to have poa_path field
UPDATE wills
SET answers = jsonb_set(
  answers,
  '{executors}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem ? 'poa_path' THEN elem
        ELSE elem || '{"poa_path": null}'::jsonb
      END
    )
    FROM jsonb_array_elements(answers->'executors') AS elem
  ),
  true
)
WHERE answers ? 'executors'
  AND jsonb_array_length(answers->'executors') > 0;

-- Update beneficiaries to have poa_path field
UPDATE wills
SET answers = jsonb_set(
  answers,
  '{beneficiaries}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN elem ? 'poa_path' THEN elem
        ELSE elem || '{"poa_path": null}'::jsonb
      END
    )
    FROM jsonb_array_elements(answers->'beneficiaries') AS elem
  ),
  true
)
WHERE answers ? 'beneficiaries'
  AND jsonb_array_length(answers->'beneficiaries') > 0;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check executors with poa_path
SELECT 
  id,
  user_id,
  jsonb_pretty(answers->'executors') as executors
FROM wills
WHERE answers ? 'executors'
  AND jsonb_array_length(answers->'executors') > 0
LIMIT 5;

-- Check beneficiaries with poa_path
SELECT 
  id,
  user_id,
  jsonb_pretty(answers->'beneficiaries') as beneficiaries
FROM wills
WHERE answers ? 'beneficiaries'
  AND jsonb_array_length(answers->'beneficiaries') > 0
LIMIT 5;

-- Count records with poa_path in executors
SELECT COUNT(*) as executors_with_poa
FROM wills,
     jsonb_array_elements(answers->'executors') as executor
WHERE executor ? 'poa_path'
  AND executor->>'poa_path' IS NOT NULL
  AND executor->>'poa_path' != '';

-- Count records with poa_path in beneficiaries
SELECT COUNT(*) as beneficiaries_with_poa
FROM wills,
     jsonb_array_elements(answers->'beneficiaries') as beneficiary
WHERE beneficiary ? 'poa_path'
  AND beneficiary->>'poa_path' IS NOT NULL
  AND beneficiary->>'poa_path' != '';

-- ============================================
-- STORAGE BUCKET SETUP (if not already done)
-- ============================================

-- Ensure the storage bucket allows poa (proof of address) file types
-- This should already be configured, but verify in Supabase Storage settings:
-- 
-- Bucket: will-documents (or your bucket name)
-- Allowed file types: image/*, application/pdf
-- Max file size: 10MB
-- 
-- Storage policies should allow:
-- - Users to upload files to their own will folders
-- - Users to read their own uploaded files
-- - Admins to read all files

-- Example storage policy (if needed):
-- CREATE POLICY "Users can upload POA documents"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'will-documents' 
--   AND auth.uid()::text = (storage.foldername(name))[1]
-- );

-- ============================================
-- NOTES
-- ============================================

-- 1. The JSONB column is flexible, so no schema changes are required
-- 2. The backfill queries are OPTIONAL - the app handles missing fields
-- 3. Indexes are OPTIONAL - only add if you need to query by poa_path
-- 4. Storage policies should already be configured for passport uploads
-- 5. The same storage bucket and policies work for POA documents

-- ============================================
-- ROLLBACK (if needed)
-- ============================================

-- To remove poa_path fields (not recommended):
/*
UPDATE wills
SET answers = jsonb_set(
  answers,
  '{executors}',
  (
    SELECT jsonb_agg(elem - 'poa_path')
    FROM jsonb_array_elements(answers->'executors') AS elem
  ),
  true
)
WHERE answers ? 'executors';

UPDATE wills
SET answers = jsonb_set(
  answers,
  '{beneficiaries}',
  (
    SELECT jsonb_agg(elem - 'poa_path')
    FROM jsonb_array_elements(answers->'beneficiaries') AS elem
  ),
  true
)
WHERE answers ? 'beneficiaries';
*/
