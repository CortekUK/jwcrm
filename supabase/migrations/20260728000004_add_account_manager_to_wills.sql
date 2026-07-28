-- Assign an account manager to a will.
--
-- The account manager is the staff member who handles this particular case:
-- they see only their assigned wills in the admin dashboard, and any support
-- or edit request the client raises against this will is routed to them.
--
-- ON DELETE SET NULL so removing a staff user never deletes case data — the
-- will simply falls back to unassigned (and its requests route to admin).
ALTER TABLE public.wills
  ADD COLUMN IF NOT EXISTS account_manager_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wills_account_manager
  ON public.wills(account_manager_id);

COMMENT ON COLUMN public.wills.account_manager_id IS 'Staff user (role: account_manager) handling this case. NULL = unassigned, requests route to admin.';
