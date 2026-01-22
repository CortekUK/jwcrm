-- Migration: Add leave notification types to notification_type enum
-- Description: Adds leave_approval and leave_denial to the notification_type enum

-- Add new enum values for leave notifications
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'leave_approval';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'leave_denial';

-- Update comment to reflect new types
COMMENT ON COLUMN email_notification_logs.notification_type IS 'Type of notification: document_expiry_digest, individual_reminder, leave_approval, leave_denial';
