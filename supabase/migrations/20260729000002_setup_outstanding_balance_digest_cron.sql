-- Weekly digest of invoices that still have a balance owing.
--
-- Clients frequently pay the drafting fee up front and the court fees + VAT
-- later. The invoice stays open in the CRM but nothing chased it, so the team
-- tracked balances on a spreadsheet and had to remember at the court date.
-- This fires the digest every Monday at 08:00 GST (04:00 UTC) so open
-- balances resurface every week until they clear.
--
-- Internal only — the digest goes to the team, never to a client.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Idempotent: drop any previous schedule before recreating it.
SELECT cron.unschedule('send-outstanding-balance-digest')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-outstanding-balance-digest'
);

SELECT cron.schedule(
  'send-outstanding-balance-digest',
  '0 4 * * 1',
  $$
  SELECT
    net.http_post(
      url := 'https://gyikimtqsasryewwawgs.supabase.co/functions/v1/send-outstanding-balance-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aWtpbXRxc2Fzcnlld3dhd2dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MzkzMDUsImV4cCI6MjA3NTAxNTMwNX0.IhOHh-vkpo8ssA2ktOiP7sGQshXMU2WqNhL_BFxFU7c'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) AS request_id;
  $$
);
