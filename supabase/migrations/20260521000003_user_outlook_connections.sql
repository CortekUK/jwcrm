-- Per-user Microsoft Outlook connections. When a salesperson (or any user)
-- connects their Outlook, we store the OAuth tokens here. Outbound emails
-- the system sends on their behalf (proposals, invoices, etc.) are routed
-- through Microsoft Graph using these tokens instead of the shared Resend
-- sender.

CREATE TABLE IF NOT EXISTS public.user_outlook_connections (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  outlook_email  TEXT NOT NULL,
  ms_user_id     TEXT,
  access_token   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  scope          TEXT,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_outlook_connections_email
  ON public.user_outlook_connections(outlook_email);

ALTER TABLE public.user_outlook_connections ENABLE ROW LEVEL SECURITY;

-- A user manages their own connection.
DROP POLICY IF EXISTS "user_select_own_outlook" ON public.user_outlook_connections;
CREATE POLICY "user_select_own_outlook" ON public.user_outlook_connections
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_insert_own_outlook" ON public.user_outlook_connections;
CREATE POLICY "user_insert_own_outlook" ON public.user_outlook_connections
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_update_own_outlook" ON public.user_outlook_connections;
CREATE POLICY "user_update_own_outlook" ON public.user_outlook_connections
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_delete_own_outlook" ON public.user_outlook_connections;
CREATE POLICY "user_delete_own_outlook" ON public.user_outlook_connections
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admins can see all connections (for support / audit).
DROP POLICY IF EXISTS "admin_select_all_outlook" ON public.user_outlook_connections;
CREATE POLICY "admin_select_all_outlook" ON public.user_outlook_connections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

CREATE OR REPLACE FUNCTION public.touch_user_outlook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_outlook_updated_at ON public.user_outlook_connections;
CREATE TRIGGER trigger_user_outlook_updated_at
  BEFORE UPDATE ON public.user_outlook_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_outlook_updated_at();
