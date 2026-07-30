-- Add employee_documents.alert_thresholds_sent.
--
-- Migration 20260127000002 already declares this column, and it is RECORDED in
-- supabase_migrations.schema_migrations as applied — but the column does not
-- exist in the database. It was marked applied without actually running, which
-- is why `/api/hr/trigger-threshold-alert` fails with:
--
--   column employee_documents.alert_thresholds_sent does not exist
--
-- send-document-threshold-alerts reads this column to remember which day
-- thresholds (90/60/30/14/7) it has already alerted on for a given document,
-- so each threshold fires once per document rather than every run.
--
-- IF NOT EXISTS makes this safe whether or not 20260127000002 ever lands.

ALTER TABLE employee_documents
  ADD COLUMN IF NOT EXISTS alert_thresholds_sent JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN employee_documents.alert_thresholds_sent IS
  'Day thresholds already alerted on for this document, e.g. [90, 60]. Prevents the same threshold emailing twice.';

CREATE INDEX IF NOT EXISTS idx_employee_documents_threshold_alerts
  ON employee_documents(expiry_date, alert_thresholds_sent)
  WHERE expiry_date IS NOT NULL;
