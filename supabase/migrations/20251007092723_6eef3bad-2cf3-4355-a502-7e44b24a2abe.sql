-- Step 2: Add new columns to wills table for admin workflow control
ALTER TABLE public.wills
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewer_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewer_notes text,
  ADD COLUMN IF NOT EXISTS visible_to_client boolean DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wills_visible_to_client ON public.wills(visible_to_client);
CREATE INDEX IF NOT EXISTS idx_wills_reviewer_user_id ON public.wills(reviewer_user_id);

-- Migrate existing wills to new statuses
UPDATE public.wills
SET status = 'draft_generated_internal',
    visible_to_client = false
WHERE status = 'draft_generated' AND pdf_path IS NOT NULL;

UPDATE public.wills
SET status = 'awaiting_review'
WHERE status = 'awaiting_pdf' AND pdf_path IS NULL;