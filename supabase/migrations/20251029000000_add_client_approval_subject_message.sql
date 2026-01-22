-- Add subject, message, and image path columns for client approval change requests
ALTER TABLE wills
ADD COLUMN IF NOT EXISTS client_approval_subject TEXT,
ADD COLUMN IF NOT EXISTS client_approval_message TEXT,
ADD COLUMN IF NOT EXISTS client_approval_image_path TEXT;

-- Add comments to explain the columns
COMMENT ON COLUMN wills.client_approval_subject IS 'Subject line when client requests changes (disapproves draft)';
COMMENT ON COLUMN wills.client_approval_message IS 'Detailed message when client requests changes (disapproves draft)';
COMMENT ON COLUMN wills.client_approval_image_path IS 'Storage path to image attachment when client requests changes (optional)';
