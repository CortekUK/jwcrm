-- Rollback for 20260802000002_setup_document_threshold_alerts_cron.sql
--
-- Removes the threshold alert schedule. The edge function itself is left in
-- place; with no cron job it simply never runs (which is the pre-migration
-- state).

SELECT cron.unschedule('send-document-threshold-alerts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-document-threshold-alerts');
