-- Every outbound email, and what happened to it.
--
-- Written because "the invoice email isn't going out" took hours to
-- investigate: the app kept no record at all, so the only evidence was a
-- third-party provider's dashboard and inference from Stripe session ids. The
-- route even reported success when a send failed.
--
-- One row per sendUserEmail() call. `attempts` holds the per-provider detail,
-- because a send can try Outlook first and fall back to Resend, and knowing
-- WHICH mailbox it actually left from is usually the whole answer.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- What this email was, e.g. 'invoice', 'proposal', 'payment_request'.
  kind TEXT,
  subject TEXT,
  recipient TEXT,

  -- Who triggered it, and which lead/deal it belongs to.
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,

  -- Outcome of the send as a whole.
  ok BOOLEAN NOT NULL,
  provider TEXT,
  -- The mailbox the message actually left from. The single most useful field
  -- when a client says nothing arrived: mail sent from an unrelated domain is
  -- what gets quarantined.
  sent_as TEXT,
  message_id TEXT,
  error TEXT,
  has_attachments BOOLEAN NOT NULL DEFAULT FALSE,

  -- [{provider, ok, error, sent_as}] in the order attempted.
  attempts JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_created_at ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_lead_id ON public.email_send_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_failures ON public.email_send_log(created_at DESC) WHERE ok = FALSE;

-- Authorization is enforced in the application layer, as everywhere else here.
ALTER TABLE public.email_send_log DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_send_log IS
  'Audit trail of every outbound email: which provider carried it, which mailbox it was sent as, and the error if it failed.';
