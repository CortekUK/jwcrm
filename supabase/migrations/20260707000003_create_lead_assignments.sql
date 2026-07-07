-- Migration: Multi-assignee support for leads
-- Created: 2026-07-07
-- Client request: "Assigned to more than one person?"
--
-- Additive design: leads.assigned_to remains the PRIMARY assignee (keeps the
-- existing auto-reminder trigger and salesperson views working unchanged).
-- lead_assignments holds ALL assignees (primary + additional co-assignees).

CREATE TABLE IF NOT EXISTS public.lead_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  salesperson_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  assigned_by uuid,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (lead_id, salesperson_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead_id
  ON public.lead_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_salesperson_id
  ON public.lead_assignments(salesperson_id);

-- Authorization handled at the application layer (RLS disabled app-wide, see
-- 20260128000005_disable_rls_policies.sql).
ALTER TABLE public.lead_assignments DISABLE ROW LEVEL SECURITY;

-- Backfill: mirror every currently-assigned lead into the join table as primary.
INSERT INTO public.lead_assignments (lead_id, salesperson_id, is_primary, assigned_at)
SELECT id, assigned_to, true, COALESCE(assigned_at, now())
FROM public.leads
WHERE assigned_to IS NOT NULL
ON CONFLICT (lead_id, salesperson_id) DO NOTHING;

COMMENT ON TABLE public.lead_assignments IS 'All salespeople assigned to a lead (leads.assigned_to remains the primary)';
