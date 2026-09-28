-- Rollback for 20260928000001_add_proposal_court_options.sql.
-- Lives in rollback/ so a migration sweep never runs it.
ALTER TABLE public.proposals DROP COLUMN IF EXISTS court_options;
