-- Migration: Create system_settings table for global application settings
-- Description: Stores global configuration settings like HR notification preferences

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE system_settings IS 'Stores global application configuration settings';
COMMENT ON COLUMN system_settings.setting_key IS 'Unique identifier for the setting (e.g., hr_document_notifications)';
COMMENT ON COLUMN system_settings.setting_value IS 'JSON object containing the setting values';

-- Enable Row Level Security
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: HR users can view system settings
CREATE POLICY "HR can view system settings" ON system_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'hr'
    )
  );

-- Policy: HR users can update system settings
CREATE POLICY "HR can update system settings" ON system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'hr'
    )
  );

-- Policy: Admin users have full access
CREATE POLICY "Admin has full access to system settings" ON system_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_settings_timestamp
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- Insert default HR document notification settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
(
  'hr_document_notifications',
  '{
    "enabled": true,
    "send_time": "08:00",
    "timezone": "Asia/Dubai",
    "recipient_email": "aw736024@gmail.com",
    "recipient_name": "HR Manager",
    "include_expired": true,
    "include_critical": true,
    "include_urgent": true
  }'::jsonb,
  'Settings for automated HR document expiry email notifications. Sends daily digest of expiring employee documents.'
);

-- Create index on setting_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
