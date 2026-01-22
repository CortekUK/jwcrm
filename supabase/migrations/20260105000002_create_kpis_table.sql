-- Create kpis table for monthly KPI definitions per job role
CREATE TABLE kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_role_id UUID NOT NULL REFERENCES job_roles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_value DECIMAL(12,2) NOT NULL DEFAULT 100,
  unit TEXT NOT NULL DEFAULT 'marks',
  weighting INTEGER NOT NULL DEFAULT 0 CHECK (weighting >= 0 AND weighting <= 100),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_kpis_job_role ON kpis(job_role_id);

-- Enable RLS
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;

-- HR can manage KPIs
CREATE POLICY "HR can view kpis" ON kpis
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can insert kpis" ON kpis
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can update kpis" ON kpis
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can delete kpis" ON kpis
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- Add comments for documentation
COMMENT ON TABLE kpis IS 'KPI definitions linked to job roles - monthly tasks with targets and weightings';
COMMENT ON COLUMN kpis.target_value IS 'Target value to achieve (e.g., 20000 for £20,000 sales)';
COMMENT ON COLUMN kpis.unit IS 'Unit of measurement (e.g., £, %, /5, minutes, count)';
COMMENT ON COLUMN kpis.weighting IS 'Percentage weight for overall score calculation (0-100, must total 100% per job role)';
