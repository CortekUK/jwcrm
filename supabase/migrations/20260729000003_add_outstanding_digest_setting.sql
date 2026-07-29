-- Make the outstanding-balance digest recipient configurable from the
-- dashboard instead of an environment variable, so finance can change who
-- gets chased-payment summaries without a redeploy.
--
-- Follows the existing system_settings pattern (see hr_kpi_monthly_notifications).
-- The edge function falls back to FINANCE_EMAIL / ADMIN_EMAIL if this row is
-- missing, so the digest can never silently lose its recipient.
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'finance_outstanding_digest',
  jsonb_build_object(
    'enabled', true,
    'recipient_email', '',
    'recipient_name', 'Finance Team'
  ),
  'Weekly outstanding-balance digest: who receives it and whether it is on. An empty recipient_email falls back to the FINANCE_EMAIL/ADMIN_EMAIL environment variable.'
)
ON CONFLICT (setting_key) DO NOTHING;
