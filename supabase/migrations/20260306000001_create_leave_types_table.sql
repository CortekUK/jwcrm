-- Create configurable leave_types table
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Calendar',
  color_class TEXT NOT NULL DEFAULT 'text-gray-600',
  bg_color_class TEXT NOT NULL DEFAULT 'bg-gray-100',
  tracks_balance BOOLEAN NOT NULL DEFAULT false,
  balance_field_prefix TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_leave_types_slug ON leave_types(slug);
CREATE INDEX idx_leave_types_active ON leave_types(is_active);
CREATE INDEX idx_leave_types_sort ON leave_types(sort_order);

-- Enable RLS
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view leave types
CREATE POLICY "Authenticated users can view leave_types" ON leave_types
  FOR SELECT TO authenticated USING (true);

-- HR can manage leave types
CREATE POLICY "HR can insert leave_types" ON leave_types
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('hr', 'admin'))
  );

CREATE POLICY "HR can update leave_types" ON leave_types
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('hr', 'admin'))
  );

CREATE POLICY "HR can delete leave_types" ON leave_types
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('hr', 'admin'))
  );

-- Seed default leave types
INSERT INTO leave_types (slug, name, icon_name, color_class, bg_color_class, tracks_balance, balance_field_prefix, sort_order) VALUES
  ('annual', 'Annual Leave', 'Plane', 'text-purple-600', 'bg-purple-100', true, 'annual', 1),
  ('sick', 'Sick Leave', 'Thermometer', 'text-yellow-600', 'bg-yellow-100', true, 'sick', 2),
  ('emergency', 'Emergency Leave', 'AlertCircle', 'text-orange-600', 'bg-orange-100', false, NULL, 3),
  ('unpaid', 'Unpaid Leave', 'Wallet', 'text-gray-600', 'bg-gray-100', false, NULL, 4),
  ('working_abroad', 'Working from Abroad', 'Globe', 'text-blue-600', 'bg-blue-100', false, NULL, 5);

-- Drop functions that depend on leave_type enum
DROP FUNCTION IF EXISTS get_applicable_approval_rule(leave_type, integer);
DROP FUNCTION IF EXISTS get_active_delegate(uuid, leave_type, integer);

-- Convert dependent columns from enum to text
ALTER TABLE leave_approval_rules ALTER COLUMN leave_type TYPE TEXT USING leave_type::TEXT;
ALTER TABLE leave_approval_delegations ALTER COLUMN leave_types TYPE TEXT[] USING leave_types::TEXT[];

-- Convert leave_requests.leave_type from enum to text
ALTER TABLE leave_requests ALTER COLUMN leave_type TYPE TEXT USING leave_type::TEXT;

-- Drop the old enum type
DROP TYPE IF EXISTS leave_type;

-- Recreate functions with TEXT parameters
CREATE OR REPLACE FUNCTION get_applicable_approval_rule(p_leave_type TEXT, p_total_days INTEGER)
RETURNS UUID AS $$
DECLARE
    v_rule_id UUID;
BEGIN
    SELECT id INTO v_rule_id
    FROM leave_approval_rules
    WHERE is_active = true
        AND (leave_type IS NULL OR leave_type = p_leave_type)
        AND p_total_days >= min_days
        AND (max_days IS NULL OR p_total_days <= max_days)
    ORDER BY
        CASE WHEN leave_type IS NOT NULL THEN 0 ELSE 1 END,
        priority ASC
    LIMIT 1;
    RETURN v_rule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_active_delegate(p_delegator_id UUID, p_leave_type TEXT, p_total_days INTEGER)
RETURNS UUID AS $$
DECLARE
    v_delegate_id UUID;
BEGIN
    SELECT delegate_id INTO v_delegate_id
    FROM leave_approval_delegations
    WHERE delegator_id = p_delegator_id
        AND is_active = true
        AND CURRENT_DATE BETWEEN start_date AND end_date
        AND (leave_types IS NULL OR p_leave_type = ANY(leave_types))
        AND (max_days IS NULL OR p_total_days <= max_days)
    ORDER BY created_at DESC
    LIMIT 1;
    RETURN v_delegate_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE leave_types IS 'Configurable leave type definitions - admins can add/edit/remove types';
COMMENT ON COLUMN leave_types.slug IS 'URL-safe identifier used as the value in leave_requests.leave_type';
COMMENT ON COLUMN leave_types.icon_name IS 'Lucide icon name for UI display';
COMMENT ON COLUMN leave_types.tracks_balance IS 'Whether this type has balance tracking (entitled/used)';
COMMENT ON COLUMN leave_types.balance_field_prefix IS 'Maps to leave_balances column prefix (e.g. annual -> annual_entitled, annual_used)';
