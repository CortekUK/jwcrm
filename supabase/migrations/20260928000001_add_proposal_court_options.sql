-- Registration-court options offered on a proposal (Abu Dhabi / Dubai / DIFC).
--
-- The Just Wills fee is the same whichever court registers the will; only the
-- government fee differs, so the team can offer several courts and let the
-- client choose one on the accept page.
--
-- This column records what was OFFERED: an array of
--   { court: 'abu_dhabi'|'dubai'|'difc', description, amount, quantity }
-- with `amount` the line total, as in line_items. NULL on every proposal that
-- predates this, and on any proposal sent without using the picker.
--
-- The CHOSEN court is deliberately not stored here or in its own column: it is
-- the line item in line_items that carries a "court" key. Every renderer and
-- the payment link already read line_items, so the chosen fee reaches them
-- with no further changes, and there is no second copy of the choice to drift.
-- See src/lib/lead-management/courtOptions.ts.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS court_options JSONB;

COMMENT ON COLUMN public.proposals.court_options IS
  'Registration courts offered to the client: [{court, description, amount, quantity}]. The chosen one is the line_items entry carrying a "court" key. NULL = picker not used.';
