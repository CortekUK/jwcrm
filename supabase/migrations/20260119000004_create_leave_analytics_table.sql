-- Create table to store GPT-analyzed leave and attendance patterns
CREATE TABLE IF NOT EXISTS leave_analytics_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary TEXT NOT NULL,
  insights JSONB NOT NULL DEFAULT '[]',
  department_health JSONB DEFAULT '{}',
  alerts JSONB DEFAULT '[]',
  data_period_start DATE,
  data_period_end DATE,
  employee_count INTEGER DEFAULT 0,
  total_leave_requests INTEGER DEFAULT 0,
  total_attendance_records INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient retrieval of latest analysis
CREATE INDEX idx_leave_analytics_date ON leave_analytics_results(analysis_date DESC);

-- Enable RLS
ALTER TABLE leave_analytics_results ENABLE ROW LEVEL SECURITY;

-- Allow HR and Admin roles to read analytics
CREATE POLICY "HR and Admin can view leave analytics"
  ON leave_analytics_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('hr', 'admin', 'superadmin')
    )
  );

-- Allow service role to insert (for Edge Function)
CREATE POLICY "Service role can insert leave analytics"
  ON leave_analytics_results FOR INSERT
  WITH CHECK (true);

-- Allow service role to delete old records (cleanup)
CREATE POLICY "Service role can delete old leave analytics"
  ON leave_analytics_results FOR DELETE
  USING (true);

-- Comment for documentation
COMMENT ON TABLE leave_analytics_results IS 'Stores GPT-analyzed leave and attendance patterns for HR insights';
COMMENT ON COLUMN leave_analytics_results.insights IS 'Array of detected patterns with severity, affected employees, and recommendations';
COMMENT ON COLUMN leave_analytics_results.department_health IS 'Department-level health scores and concerns';
COMMENT ON COLUMN leave_analytics_results.alerts IS 'Urgent alerts requiring immediate attention';
