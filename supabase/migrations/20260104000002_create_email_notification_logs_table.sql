-- Migration: Create email_notification_logs table
-- Description: Tracks all automated email notifications sent by the system

-- Create enum for notification types
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('document_expiry_digest', 'individual_reminder');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for notification status
DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('sent', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create email_notification_logs table
CREATE TABLE IF NOT EXISTS email_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type notification_type NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  documents_included JSONB DEFAULT '[]',
  status notification_status NOT NULL,
  error_message TEXT,
  resend_email_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE email_notification_logs IS 'Audit log of all automated email notifications sent by the system';
COMMENT ON COLUMN email_notification_logs.notification_type IS 'Type of notification: document_expiry_digest (daily summary) or individual_reminder';
COMMENT ON COLUMN email_notification_logs.documents_included IS 'JSON array of documents included in the notification';
COMMENT ON COLUMN email_notification_logs.resend_email_id IS 'Email ID returned by Resend API for tracking';

-- Enable Row Level Security
ALTER TABLE email_notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy: HR users can view notification logs
CREATE POLICY "HR can view notification logs" ON email_notification_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'hr'
    )
  );

-- Policy: Admin users have full access
CREATE POLICY "Admin has full access to notification logs" ON email_notification_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Service role can insert logs (for Edge Functions)
CREATE POLICY "Service role can insert notification logs" ON email_notification_logs
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_notification_logs_sent_at
  ON email_notification_logs(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_notification_logs_type
  ON email_notification_logs(notification_type);

CREATE INDEX IF NOT EXISTS idx_email_notification_logs_status
  ON email_notification_logs(status);
