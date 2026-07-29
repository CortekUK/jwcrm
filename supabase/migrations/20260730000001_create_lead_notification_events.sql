-- Ledger behind the lead-management Notifications tab.
--
-- Every notifiable event (lead assigned, status changed, reminder due, lead
-- gone stale) is recorded here first, and `email_state` records what happened
-- to the email:
--
--   suppressed  the event's switch is OFF in the Notifications tab
--   sent        frequency = immediate and it was inside working hours
--   pending     frequency = immediate but OUTSIDE working hours; the flush
--               cron mails it at the next working-hours start
--   digest      frequency = daily/weekly; raw material for the digest cron
--   none        in-app only, no email was ever built
--
-- The row is written whatever the email outcome, because the in-app bell and
-- the digests both read from this table. Turning email off must not blind the
-- UI. `email_subject`/`email_html` are stored so the flush cron can send a
-- held message without needing any application code.

CREATE TABLE IF NOT EXISTS public.lead_notification_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id        UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  -- `deal_won` is deliberately distinct from `status_changed`: it is raised
  -- only by the `notify_manager_won` automation rule and is governed solely by
  -- that rule, never by the general "Status Changes" notification switch.
  event_type     TEXT NOT NULL
                 CHECK (event_type IN ('lead_assigned','status_changed','reminder_due','lead_stale','deal_won')),
  title          TEXT NOT NULL,
  body           TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_state    TEXT NOT NULL DEFAULT 'none'
                 CHECK (email_state IN ('sent','pending','digest','suppressed','none')),
  email_subject  TEXT,
  email_html     TEXT,
  email_sent_at  TIMESTAMPTZ,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lead_notification_events IS
  'Lead-management notification ledger: drives the in-app bell, the held-until-working-hours email queue, and the daily/weekly digests.';

-- The bell reads unread rows for one recipient, newest first.
CREATE INDEX IF NOT EXISTS idx_lead_notification_events_recipient_unread
  ON public.lead_notification_events (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

-- The flush cron scans only the held queue.
CREATE INDEX IF NOT EXISTS idx_lead_notification_events_pending
  ON public.lead_notification_events (created_at)
  WHERE email_state = 'pending';

-- The digest crons scan only rows waiting to be batched.
CREATE INDEX IF NOT EXISTS idx_lead_notification_events_digest
  ON public.lead_notification_events (recipient_id, created_at)
  WHERE email_state = 'digest';

ALTER TABLE public.lead_notification_events ENABLE ROW LEVEL SECURITY;

-- All writes go through service-role API routes and edge functions, which
-- bypass RLS. This policy only lets a signed-in user read their own feed.
DROP POLICY IF EXISTS "Users read their own lead notifications"
  ON public.lead_notification_events;
CREATE POLICY "Users read their own lead notifications"
  ON public.lead_notification_events
  FOR SELECT
  USING (recipient_id = auth.uid());
