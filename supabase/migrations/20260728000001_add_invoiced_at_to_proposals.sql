-- Distinguishes an informational "proposal" (not payable) from a real,
-- payable "invoice" without touching the proposal_status enum, which is
-- exhaustively matched in several UI places (badge map, pie charts, stats
-- breakdown). NULL = proposal only. Set = became a real invoice at that time.
--
-- Client request: "we can't have the invoice being sent out when the
-- proposal's sent... that needs to be amended for only when we send invoice."

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

COMMENT ON COLUMN public.proposals.invoiced_at IS
  'Set when this record became a real, payable invoice (Send Invoice / Generate Invoice). NULL means it is still just an informational proposal with no payment capability.';
