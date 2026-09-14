-- The client portal is not going live with the first release: Just Wills are
-- launching the sales side only. Until then, paying the drafting fee must not
-- create an account for the client or email them login details — they just get
-- the payment confirmation.
--
-- Stored as a setting rather than an env var so it can be switched on later
-- without a deploy.
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'client_portal',
  '{"enabled": false}'::jsonb,
  'Whether paying clients are given a client portal account. Disabled until the portal goes live.'
)
ON CONFLICT (setting_key) DO NOTHING;
