-- Client request: clients sometimes pay the drafting fee now and the
-- remaining court fees + VAT later. Today there's no way to record a partial
-- payment against a proposal/invoice or see the outstanding balance.
--
-- Applies going forward only — this is not a production database, no backfill
-- for historical proposals.

CREATE TABLE IF NOT EXISTS public.proposal_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_payments_proposal_id
  ON public.proposal_payments(proposal_id);

-- Authorization handled at the application layer (RLS disabled app-wide, see
-- 20260128000005_disable_rls_policies.sql), matching every other table.
ALTER TABLE public.proposal_payments DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.proposal_payments IS
  'Individual payments recorded against a proposal/invoice. Balance due = invoice total (incl. VAT) minus the sum of these.';
COMMENT ON COLUMN public.proposal_payments.method IS
  'Freeform, e.g. bank_transfer, stripe, cash.';
