-- Migration: Add document threshold alert tracking
-- Description: Add column to track which expiry thresholds have been notified for each document,
-- and add settings for threshold-based alerts (90, 60, 30, 14, 7 days)

-- Step 1: Add column to track notified thresholds
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS
  alert_thresholds_sent JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN employee_documents.alert_thresholds_sent IS 
'Array of threshold days that have already triggered alerts, e.g., [90, 60, 30]. Prevents duplicate notifications.';

-- Step 2: Create index for efficient threshold alert queries
-- This index helps find documents that need threshold alerts
CREATE INDEX IF NOT EXISTS idx_employee_documents_threshold_alerts 
ON employee_documents(expiry_date, alert_thresholds_sent) 
WHERE is_active = true AND expiry_date IS NOT NULL;

-- Step 3: Add settings for threshold alerts
INSERT INTO system_settings (setting_key, setting_value, description, created_at, updated_at)
VALUES (
  'hr_document_threshold_alerts',
  '{
    "enabled": true,
    "thresholds": [90, 60, 30, 14, 7],
    "send_time": "08:00",
    "timezone": "Asia/Dubai",
    "recipient_email": "",
    "recipient_name": "HR Manager",
    "send_individual_alerts": true
  }'::jsonb,
  'Settings for document expiry threshold-based alerts at specific day intervals',
  NOW(),
  NOW()
)
ON CONFLICT (setting_key) DO NOTHING;

-- Step 4: Add notification type for threshold alerts
-- Check if we need to add new notification types
DO $$
BEGIN
  -- Add document_threshold_alert to notification types if tracking exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_notification_logs' 
    AND column_name = 'notification_type'
  ) THEN
    -- The email_notification_logs table will accept the new type
    -- No constraint modification needed as it's a TEXT column
    NULL;
  END IF;
END $$;
