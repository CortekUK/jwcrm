-- When the drafting fee lands the client is told "we have your payment, we are
-- starting work". That must be sent exactly once: Stripe retries webhooks, and
-- a later court-stage payment runs the same code path again.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS drafting_notified_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.leads.drafting_notified_at IS
  'When the client was told their upfront/drafting fee was received and work is starting. Presence means "already notified" — used to keep that email idempotent.';
