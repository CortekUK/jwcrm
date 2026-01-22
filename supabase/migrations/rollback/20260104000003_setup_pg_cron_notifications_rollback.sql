-- Rollback Migration: Remove pg_cron notification job
-- Run this to undo the 20260104000003_setup_pg_cron_notifications migration

-- Unschedule the cron job
SELECT cron.unschedule('document-expiry-notifications');

-- Drop the function
DROP FUNCTION IF EXISTS invoke_document_expiry_notifications();

-- Note: This does NOT remove the vault secrets if they were created.
-- To remove secrets, run:
-- SELECT vault.delete_secret('supabase_url');
-- SELECT vault.delete_secret('service_role_key');
