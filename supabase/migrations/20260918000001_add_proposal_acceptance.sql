-- Client-side acceptance of a proposal.
--
-- Until now the only way for a client to say "yes, go ahead" was to reply to
-- the proposal email, after which a human noticed and sent the invoice. This
-- records that agreement as a fact on the proposal itself.
--
-- Deliberately NOT a new proposal_status enum value: ALTER TYPE ... ADD VALUE
-- cannot be rolled back on a live shared database, and "accepted" is not a
-- state the payment pipeline branches on — it sits alongside `sent`, before
-- the invoice exists. Readers derive an "Accepted" badge from accepted_at the
-- same way ViewProposalDialog already derives "partially paid" from the
-- payments, so nothing downstream of proposal_status has to change.
--
-- The ip/user-agent pair is a light audit trail: the accept link is public and
-- keyed only on the proposal UUID, so if a client ever disputes having agreed,
-- this is the only evidence of who clicked.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_ip TEXT,
  ADD COLUMN IF NOT EXISTS accepted_user_agent TEXT;

-- Answers "which proposals are waiting on an invoice" without scanning every
-- proposal ever sent; partial because accepted_at is null on almost all rows.
CREATE INDEX IF NOT EXISTS idx_proposals_accepted_at
  ON public.proposals(accepted_at DESC)
  WHERE accepted_at IS NOT NULL;

COMMENT ON COLUMN public.proposals.accepted_at IS
  'When the client accepted this proposal via the public accept link. NULL = not accepted. Derived display state only — proposal_status is untouched.';
COMMENT ON COLUMN public.proposals.accepted_ip IS
  'Client IP recorded at accept time (audit trail for a public, unauthenticated link).';
COMMENT ON COLUMN public.proposals.accepted_user_agent IS
  'Client user agent recorded at accept time (audit trail for a public, unauthenticated link).';
