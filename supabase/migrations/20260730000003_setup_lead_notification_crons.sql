-- Schedules behind the lead-management Notifications and Automation tabs.
--
-- All four jobs are installed unconditionally and each one no-ops when its
-- setting says so, which is what makes the dropdowns and switches on the
-- Settings page authoritative: nobody has to touch cron to change behaviour.
--
--   flush-lead-notifications   every 15 min. Sends notifications that were
--                              held because they happened outside the Team
--                              tab's working hours. Exits immediately when
--                              frequency is not "immediate" or the clock is
--                              still outside the window.
--   send-lead-daily-digest     08:00 GST daily.  No-ops unless frequency = daily.
--   send-lead-weekly-digest    08:00 GST Monday. No-ops unless frequency = weekly.
--   auto-stale-lead-reminders  07:30 GST daily.  No-ops unless the
--                              `auto_reminder_7days` rule is on.
--
-- GST is UTC+4, so 08:00 GST = 04:00 UTC.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Idempotent: drop any previous schedule before recreating it.
SELECT cron.unschedule('flush-lead-notifications')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'flush-lead-notifications');
SELECT cron.unschedule('send-lead-daily-digest')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-lead-daily-digest');
SELECT cron.unschedule('send-lead-weekly-digest')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-lead-weekly-digest');
SELECT cron.unschedule('auto-stale-lead-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-stale-lead-reminders');

SELECT cron.schedule(
  'flush-lead-notifications',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gyikimtqsasryewwawgs.supabase.co/functions/v1/send-lead-notification-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aWtpbXRxc2Fzcnlld3dhd2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzkzMDUsImV4cCI6MjA3NTAxNTMwNX0.IhOHh-vkpo8ssA2ktOiP7sGQshXMU2WqNhL_BFxFU7c'
    ),
    body := '{"mode":"flush"}'::jsonb,
    timeout_milliseconds := 30000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'send-lead-daily-digest',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gyikimtqsasryewwawgs.supabase.co/functions/v1/send-lead-notification-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aWtpbXRxc2Fzcnlld3dhd2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzkzMDUsImV4cCI6MjA3NTAxNTMwNX0.IhOHh-vkpo8ssA2ktOiP7sGQshXMU2WqNhL_BFxFU7c'
    ),
    body := '{"mode":"daily"}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'send-lead-weekly-digest',
  '0 4 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://gyikimtqsasryewwawgs.supabase.co/functions/v1/send-lead-notification-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aWtpbXRxc2Fzcnlld3dhd2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzkzMDUsImV4cCI6MjA3NTAxNTMwNX0.IhOHh-vkpo8ssA2ktOiP7sGQshXMU2WqNhL_BFxFU7c'
    ),
    body := '{"mode":"weekly"}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'auto-stale-lead-reminders',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gyikimtqsasryewwawgs.supabase.co/functions/v1/auto-stale-lead-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aWtpbXRxc2Fzcnlld3dhd2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzkzMDUsImV4cCI6MjA3NTAxNTMwNX0.IhOHh-vkpo8ssA2ktOiP7sGQshXMU2WqNhL_BFxFU7c'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);
