-- Step 1: Add new statuses to will_status enum
ALTER TYPE public.will_status ADD VALUE IF NOT EXISTS 'awaiting_review';
ALTER TYPE public.will_status ADD VALUE IF NOT EXISTS 'generating_pdf';
ALTER TYPE public.will_status ADD VALUE IF NOT EXISTS 'draft_generated_internal';
ALTER TYPE public.will_status ADD VALUE IF NOT EXISTS 'released_to_client';
