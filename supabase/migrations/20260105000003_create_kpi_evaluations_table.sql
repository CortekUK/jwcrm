-- Create kpi_evaluations table for monthly KPI scoring by HR
CREATE TABLE kpi_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

  -- Actual performance
  achieved_value DECIMAL(12,2),
  score DECIMAL(5,2),
  notes TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),

  -- Metadata
  evaluated_by UUID REFERENCES auth.users(id),
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One evaluation per employee per KPI per year/month
  UNIQUE(employee_id, kpi_id, year, month)
);

-- Create indexes
CREATE INDEX idx_kpi_evaluations_employee ON kpi_evaluations(employee_id);
CREATE INDEX idx_kpi_evaluations_kpi ON kpi_evaluations(kpi_id);
CREATE INDEX idx_kpi_evaluations_year_month ON kpi_evaluations(year, month);
CREATE INDEX idx_kpi_evaluations_status ON kpi_evaluations(status);

-- Enable RLS
ALTER TABLE kpi_evaluations ENABLE ROW LEVEL SECURITY;

-- HR can manage KPI evaluations
CREATE POLICY "HR can view kpi_evaluations" ON kpi_evaluations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can insert kpi_evaluations" ON kpi_evaluations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can update kpi_evaluations" ON kpi_evaluations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can delete kpi_evaluations" ON kpi_evaluations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- Add comments for documentation
COMMENT ON TABLE kpi_evaluations IS 'Monthly KPI evaluation records - HR marks scores for each employee';
COMMENT ON COLUMN kpi_evaluations.achieved_value IS 'Actual value achieved by employee (e.g., 18500 for £18,500 sales)';
COMMENT ON COLUMN kpi_evaluations.score IS 'Calculated percentage score (achieved_value / target_value * 100)';
COMMENT ON COLUMN kpi_evaluations.notes IS 'HR comments about performance';
