-- Add KPI notification types to the notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kpi_quarterly_report';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kpi_incomplete_reminder';

-- Add comment for documentation
COMMENT ON TYPE notification_type IS 'Types of email notifications: document_expiry_digest, individual_reminder, leave_approval, leave_denial, kpi_quarterly_report, kpi_incomplete_reminder';
