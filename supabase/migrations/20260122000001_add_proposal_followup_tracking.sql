-- Migration: Add follow-up tracking field to proposals table
-- Created: 2026-01-22
-- Description: Enables automatic 6-hour follow-up reminders for unpaid proposals

-- Add follow-up tracking field to proposals table
ALTER TABLE proposals
ADD COLUMN followup_sent_at TIMESTAMP WITH TIME ZONE;

-- Index for efficient querying of proposals needing follow-up
-- Targets: sent proposals without follow-up that have a payment link
CREATE INDEX idx_proposals_pending_followup
ON proposals(sent_at, status)
WHERE status = 'sent'
  AND followup_sent_at IS NULL
  AND stripe_payment_link IS NOT NULL;

-- Add documentation
COMMENT ON COLUMN proposals.followup_sent_at IS 'Timestamp when the 6-hour follow-up reminder was sent';
