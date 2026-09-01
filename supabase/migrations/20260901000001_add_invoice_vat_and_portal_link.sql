-- Client request: VAT is no longer always 5%. The team must be able to set the
-- rate (or an absolute amount) per invoice, because a proposal/invoice can
-- carry a different treatment from the configured default.
--
-- Both columns are NULLABLE on purpose: NULL means "no override, use
-- companyDetails.vatRate", so every existing proposal and the currently
-- deployed app keep behaving exactly as they do today. No backfill.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS vat_rate   NUMERIC(6, 3)  NULL,
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12, 2) NULL;

COMMENT ON COLUMN public.proposals.vat_rate IS
  'Editable VAT rate in percent. NULL = fall back to the configured default (5).';
COMMENT ON COLUMN public.proposals.vat_amount IS
  'Absolute VAT override in the invoice currency. Wins over vat_rate when set.';

DO $$
BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_vat_rate_sane
    CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_vat_amount_sane
    CHECK (vat_amount IS NULL OR vat_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Clients pay the drafting fee first so work can begin, and the court fees
-- later. The portal account is now created at that FIRST payment rather than on
-- full settlement, so we need an idempotency marker: without it a webhook retry
-- (or a manual payment recorded after a card payment) would try to create the
-- account a second time and email a second password.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS portal_user_id    UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS portal_created_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_leads_portal_user_id ON public.leads(portal_user_id);

COMMENT ON COLUMN public.leads.portal_user_id IS
  'auth.users id of the client portal account, set once the drafting fee is covered. Presence means "already provisioned".';

-- Line-item staging needs no column: it lives inside the existing line_items
-- jsonb as an optional "stage" key on each row. Absent = unstaged = legacy.
COMMENT ON COLUMN public.proposals.line_items IS
  'Itemised charges: [{description, amount, quantity?, stage?}]. description may contain newlines; amount is the LINE TOTAL (quantity is display-only); stage is "upfront" or "later", absent means the invoice is not staged.';
