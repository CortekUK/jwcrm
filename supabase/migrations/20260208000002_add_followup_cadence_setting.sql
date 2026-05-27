-- Migration: Add follow-up cadence settings and multi-attempt tracking
-- Description: Enables configurable multi-attempt follow-up system for proposals

-- Add followup_count and last_followup_at columns to proposals table
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS followup_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMP WITH TIME ZONE;

-- Add comments
COMMENT ON COLUMN proposals.followup_count IS 'Number of follow-up emails sent for this proposal';
COMMENT ON COLUMN proposals.last_followup_at IS 'Timestamp of the most recent follow-up email sent';

-- Add RLS policy for lead_management role to read/write system_settings
CREATE POLICY "Lead management can view system settings" ON system_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('lead_management', 'superadmin')
    )
  );

CREATE POLICY "Lead management can update system settings" ON system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('lead_management', 'superadmin')
    )
  );

CREATE POLICY "Lead management can insert system settings" ON system_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('lead_management', 'superadmin')
    )
  );

-- Insert default follow-up cadence setting
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
(
  'lead_followup_cadence',
  '{
    "enabled": true,
    "max_attempts": 3,
    "interval_hours": 48
  }'::jsonb,
  'Settings for automated proposal follow-up emails. Controls how many follow-ups to send and how often.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Update index to support multi-attempt follow-up queries
DROP INDEX IF EXISTS idx_proposals_pending_followup;
CREATE INDEX idx_proposals_pending_followup
ON proposals(sent_at, status, followup_count)
WHERE status = 'sent'
  AND stripe_payment_link IS NOT NULL;
