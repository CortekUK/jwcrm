-- Personal KPIs: allow KPI rows to be scoped to a specific employee instead of a job role.
-- A KPI row is either role-level (job_role_id NOT NULL, employee_id NULL) or
-- personal (employee_id NOT NULL, job_role_id NULL). Personal KPIs add to the
-- employee's role KPIs when evaluations are listed.

ALTER TABLE public.kpis
  ALTER COLUMN job_role_id DROP NOT NULL;

ALTER TABLE public.kpis
  ADD COLUMN IF NOT EXISTS employee_id UUID
    REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.kpis
  ADD CONSTRAINT kpis_scope_xor
    CHECK (
      (job_role_id IS NOT NULL AND employee_id IS NULL) OR
      (job_role_id IS NULL     AND employee_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_kpis_employee ON public.kpis(employee_id);

COMMENT ON COLUMN public.kpis.employee_id IS
  'When set, this KPI is personal to one employee (job_role_id must be NULL).';

-- RLS: existing HR-only policies on public.kpis already cover personal KPIs
-- since the policy check is on user_roles, not row scope. No new policy needed.
-- (employees in this system are HR records, not auth users, so there is no
-- "employee viewing their own KPI" path to model here.)
