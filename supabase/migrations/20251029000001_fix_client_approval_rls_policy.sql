-- Drop existing update policy if it exists and recreate it to include new columns
DROP POLICY IF EXISTS "Users can update their own wills" ON wills;

-- Create comprehensive update policy for clients to update their wills including approval fields
CREATE POLICY "Users can update their own wills"
ON wills
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure clients can update approval-related fields
COMMENT ON POLICY "Users can update their own wills" ON wills
IS 'Allows authenticated users to update their own wills including client_approval_status, client_approval_comments, client_approval_subject, client_approval_message, and client_approval_image_path';
