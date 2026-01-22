-- SQL Query to add _visited_steps to existing wills based on their data
-- This marks steps as visited if they contain data

UPDATE wills
SET answers = jsonb_set(
  COALESCE(answers::jsonb, '{}'::jsonb),
  '{_visited_steps}',
  (
    SELECT jsonb_agg(DISTINCT step_num ORDER BY step_num)
    FROM (
      -- Step 1: Personal details (if full_name exists)
      SELECT 1 as step_num
      WHERE answers->>'personal' IS NOT NULL
        AND answers->'personal'->>'full_name' IS NOT NULL
        AND answers->'personal'->>'full_name' != ''

      UNION

      -- Step 2: Beneficiaries (if array has items)
      SELECT 2 as step_num
      WHERE answers->'beneficiaries' IS NOT NULL
        AND jsonb_array_length(COALESCE(answers->'beneficiaries', '[]'::jsonb)) > 0

      UNION

      -- Step 3: Executors (if array has items)
      SELECT 3 as step_num
      WHERE answers->'executors' IS NOT NULL
        AND jsonb_array_length(COALESCE(answers->'executors', '[]'::jsonb)) > 0

      UNION

      -- Step 4: Trustees (if has trustees OR skip is true)
      SELECT 4 as step_num
      WHERE (
        (answers->'trustees' IS NOT NULL AND jsonb_array_length(COALESCE(answers->'trustees', '[]'::jsonb)) > 0)
        OR (answers->>'skip_trustees' = 'true')
      )

      UNION

      -- Step 5: Interim Guardians (if array has items)
      SELECT 5 as step_num
      WHERE answers->'interim_guardians' IS NOT NULL
        AND jsonb_array_length(COALESCE(answers->'interim_guardians', '[]'::jsonb)) > 0

      UNION

      -- Step 6: Permanent Guardians (if has guardians OR skip is true)
      SELECT 6 as step_num
      WHERE (
        (answers->'permanent_guardians' IS NOT NULL AND jsonb_array_length(COALESCE(answers->'permanent_guardians', '[]'::jsonb)) > 0)
        OR (answers->>'skip_permanent_guardians' = 'true')
      )

      UNION

      -- Step 7: Receipt and Disinherit (if has items OR checkboxes are true)
      SELECT 7 as step_num
      WHERE (
        (answers->'receipt_of_will' IS NOT NULL AND jsonb_array_length(COALESCE(answers->'receipt_of_will', '[]'::jsonb)) > 0)
        OR (answers->'disinherit' IS NOT NULL AND jsonb_array_length(COALESCE(answers->'disinherit', '[]'::jsonb)) > 0)
        OR (answers->>'no_receipt_persons' = 'true')
        OR (answers->>'no_disinherit_persons' = 'true')
      )

      UNION

      -- Step 8: Family Exclusion and Letter (if checkboxes are true)
      SELECT 8 as step_num
      WHERE (
        (answers->'family_exclusion'->>'is_excluding' = 'true')
        OR (answers->'letter_of_wishes'->>'acknowledged' = 'true')
      )

      UNION

      -- Step 9: Identity Upload (if has passport or poa path)
      SELECT 9 as step_num
      WHERE (
        (answers->'identity'->>'passport_path' IS NOT NULL AND answers->'identity'->>'passport_path' != '')
        OR (answers->'identity'->>'poa_path' IS NOT NULL AND answers->'identity'->>'poa_path' != '')
      )
    ) steps
  )::jsonb
)
WHERE answers IS NOT NULL
  AND answers != '{}'::jsonb
  AND status = 'in_progress'; -- Only update draft wills, not submitted ones

-- Verify the update (optional - run this to check results)
-- SELECT
--   id,
--   user_id,
--   status,
--   answers->'_visited_steps' as visited_steps,
--   created_at
-- FROM wills
-- WHERE status = 'in_progress'
-- ORDER BY created_at DESC;
