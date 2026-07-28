-- Add the `account_manager` application role.
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- `supabase db push` wraps each migration in a transaction, so pushing this
-- file will fail. It is applied out-of-band via the Management API's
-- /database/query endpoint (which does not wrap), and the tracking row is
-- inserted manually afterwards. This is the same hazard that stalled
-- 20260208000001_add_working_from_abroad_leave_type.sql back in February.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'account_manager';

COMMENT ON TYPE public.app_role IS 'Application roles: client, admin, superadmin, hr, finance, lead_management, salesperson, account_manager';
