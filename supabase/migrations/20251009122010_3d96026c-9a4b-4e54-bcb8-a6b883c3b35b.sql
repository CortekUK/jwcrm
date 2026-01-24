-- Step 1: Drop default constraint temporarily
ALTER TABLE wills ALTER COLUMN status DROP DEFAULT;
ALTER TABLE will_status_events ALTER COLUMN new_status DROP DEFAULT;

-- Step 2: Rename old enum
ALTER TYPE will_status RENAME TO will_status_old;

-- Step 3: Create new 6-step enum
CREATE TYPE will_status AS ENUM (
  'in_progress',
  'awaiting_review',
  'under_review',
  'draft_ready',
  'draft_released',
  'finalized'
);

-- Step 4: Update wills table with mapped statuses
ALTER TABLE wills 
  ALTER COLUMN status TYPE will_status USING 
    CASE status::TEXT
      WHEN 'generating_pdf' THEN 'under_review'
      WHEN 'awaiting_pdf' THEN 'under_review'
      WHEN 'draft_generated' THEN 'under_review'
      WHEN 'draft_generated_internal' THEN 'under_review'
      WHEN 'in_review' THEN 'under_review'
      WHEN 'released_to_client' THEN 'draft_released'
      ELSE status::TEXT
    END::will_status;

-- Step 5: Update will_status_events new_status column
ALTER TABLE will_status_events 
  ALTER COLUMN new_status TYPE will_status USING 
    CASE new_status::TEXT
      WHEN 'generating_pdf' THEN 'under_review'
      WHEN 'awaiting_pdf' THEN 'under_review'
      WHEN 'draft_generated' THEN 'under_review'
      WHEN 'draft_generated_internal' THEN 'under_review'
      WHEN 'in_review' THEN 'under_review'
      WHEN 'released_to_client' THEN 'draft_released'
      ELSE new_status::TEXT
    END::will_status;

-- Step 6: Update will_status_events previous_status column (nullable)
ALTER TABLE will_status_events 
  ALTER COLUMN previous_status TYPE will_status USING 
    CASE 
      WHEN previous_status IS NULL THEN NULL
      WHEN previous_status::TEXT = 'generating_pdf' THEN 'under_review'::will_status
      WHEN previous_status::TEXT = 'awaiting_pdf' THEN 'under_review'::will_status
      WHEN previous_status::TEXT = 'draft_generated' THEN 'under_review'::will_status
      WHEN previous_status::TEXT = 'draft_generated_internal' THEN 'under_review'::will_status
      WHEN previous_status::TEXT = 'in_review' THEN 'under_review'::will_status
      WHEN previous_status::TEXT = 'released_to_client' THEN 'draft_released'::will_status
      ELSE previous_status::TEXT::will_status
    END;

-- Step 7: Restore default constraints
ALTER TABLE wills ALTER COLUMN status SET DEFAULT 'in_progress'::will_status;

-- Step 8: Drop old enum
DROP TYPE will_status_old;
