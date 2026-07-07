-- Migration: Will document version history
-- Created: 2026-07-07
-- Client request: "Any amendments down the line - same doc?" -> keep a history
-- of every draft PDF uploaded so amendments are preserved and viewable.

CREATE TABLE IF NOT EXISTS public.will_document_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  will_id uuid NOT NULL REFERENCES public.wills(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  pdf_path text NOT NULL,
  uploaded_by uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (will_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_will_document_versions_will_id
  ON public.will_document_versions(will_id);

-- Authorization is handled at the application layer (see migration
-- 20260128000005_disable_rls_policies.sql), so RLS stays disabled here to
-- match every other table. Version reads/writes go through the admin will
-- detail page which is already role-gated in the app.
ALTER TABLE public.will_document_versions DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.will_document_versions IS 'History of every draft PDF uploaded for a will (amendment trail)';
