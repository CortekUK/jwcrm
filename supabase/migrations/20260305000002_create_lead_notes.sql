-- Create lead_notes table for timestamped notes on leads
CREATE TABLE IF NOT EXISTS public.lead_notes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON public.lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON public.lead_notes(created_at DESC);

-- Enable RLS
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users can CRUD
CREATE POLICY "Authenticated users can read lead notes"
    ON public.lead_notes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert lead notes"
    ON public.lead_notes FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update lead notes"
    ON public.lead_notes FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lead notes"
    ON public.lead_notes FOR DELETE
    TO authenticated
    USING (true);

-- Comments
COMMENT ON TABLE public.lead_notes IS 'Timestamped notes for leads, independent of communications';
COMMENT ON COLUMN public.lead_notes.content IS 'Note content text';
COMMENT ON COLUMN public.lead_notes.created_by IS 'User who created the note';
