-- Let a payment row record which Stripe event created it.
--
-- Stripe retries webhooks (and can deliver the same event more than once), so
-- without a unique key a single card payment could be inserted repeatedly and
-- overstate how much the client has paid. The reference is the Stripe session
-- id; NULL for payments recorded by hand in the dashboard, and NULLs do not
-- collide under a UNIQUE index.
ALTER TABLE public.proposal_payments
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS proposal_payments_external_reference_key
  ON public.proposal_payments(external_reference)
  WHERE external_reference IS NOT NULL;

COMMENT ON COLUMN public.proposal_payments.external_reference IS 'Stripe checkout session id for card payments, so webhook retries cannot double-count. NULL for manually recorded payments.';
