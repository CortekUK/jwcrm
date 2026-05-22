-- Allow the salesperson role to view and create proposals (invoices) for the
-- leads they own (leads.assigned_to = auth.uid()).
-- Updates / deletes stay restricted to admin and lead_management.

DROP POLICY IF EXISTS "salesperson_select_own_lead_proposals" ON public.proposals;
CREATE POLICY "salesperson_select_own_lead_proposals" ON public.proposals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'salesperson'
    )
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = proposals.lead_id
        AND l.assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS "salesperson_insert_own_lead_proposals" ON public.proposals;
CREATE POLICY "salesperson_insert_own_lead_proposals" ON public.proposals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'salesperson'
    )
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = proposals.lead_id
        AND l.assigned_to = auth.uid()
    )
  );

-- Also let the finance role view proposals (read-only) so the Finance
-- dashboard works for users without the admin role.
DROP POLICY IF EXISTS "finance_select_proposals" ON public.proposals;
CREATE POLICY "finance_select_proposals" ON public.proposals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'finance'
    )
  );
