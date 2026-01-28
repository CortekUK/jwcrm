-- Migration: Create attendance_warnings table
-- Stores warnings sent to employees for attendance issues

CREATE TABLE IF NOT EXISTS attendance_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES auth.users(id),
  issue_summary TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE attendance_warnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "HR can manage attendance warnings"
ON attendance_warnings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "Admins can manage attendance warnings"
ON attendance_warnings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
