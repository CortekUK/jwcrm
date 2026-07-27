-- Bug: the admin "Activity Notes" box writes internal-only staff notes into
-- will_status_events with previous_status = new_status (no real transition).
-- The client dashboard reads this same table with no filter, so internal
-- notes (e.g. a staff member typing "hi" to test the field) show up verbatim
-- on the client portal's Recent Activity feed. RLS was globally disabled
-- (20260128000005_disable_rls_policies.sql), so nothing was blocking this
-- at the database layer either.
--
-- Fix: add is_internal, defaulting new note-only rows to internal, and
-- backfill existing note-only rows (previous_status = new_status) as
-- internal too, since that pattern is only ever produced by the internal
-- "Add Note" flow, never by a real status transition.

ALTER TABLE public.will_status_events
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

UPDATE public.will_status_events
SET is_internal = true
WHERE previous_status = new_status;

COMMENT ON COLUMN public.will_status_events.is_internal IS
  'True for staff-only notes (added via the admin Activity Notes box) that must never be shown on the client portal. Real status transitions stay visible to the client.';
