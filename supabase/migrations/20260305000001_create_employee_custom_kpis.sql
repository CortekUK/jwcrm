-- Create employee_custom_kpis table for individual KPI definitions per employee
CREATE TABLE employee_custom_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_value DECIMAL(12,2) NOT NULL DEFAULT 100,
  unit TEXT NOT NULL DEFAULT 'marks',
  weighting INTEGER NOT NULL DEFAULT 0 CHECK (weighting >= 0 AND weighting <= 100),
  deadline DATE,
  is_archived BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_employee_custom_kpis_employee ON employee_custom_kpis(employee_id);
CREATE INDEX idx_employee_custom_kpis_deadline ON employee_custom_kpis(deadline);

-- Enable RLS
ALTER TABLE employee_custom_kpis ENABLE ROW LEVEL SECURITY;

-- HR can manage custom KPIs
CREATE POLICY "HR can view employee_custom_kpis" ON employee_custom_kpis
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can insert employee_custom_kpis" ON employee_custom_kpis
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can update employee_custom_kpis" ON employee_custom_kpis
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can delete employee_custom_kpis" ON employee_custom_kpis
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- Add comments for documentation
COMMENT ON TABLE employee_custom_kpis IS 'Custom/individual KPI definitions per employee - separate from role-based KPIs';
COMMENT ON COLUMN employee_custom_kpis.deadline IS 'Optional deadline for completing this KPI goal';
COMMENT ON COLUMN employee_custom_kpis.weighting IS 'Percentage weight for custom KPI score calculation (0-100, must total 100% per employee)';

-- Create custom_kpi_evaluations table for monthly scoring of custom KPIs
CREATE TABLE custom_kpi_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  custom_kpi_id UUID NOT NULL REFERENCES employee_custom_kpis(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  achieved_value DECIMAL(12,2),
  score DECIMAL(5,2),
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  evaluated_by UUID REFERENCES auth.users(id),
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, custom_kpi_id, year, month)
);

-- Create indexes
CREATE INDEX idx_custom_kpi_evaluations_employee ON custom_kpi_evaluations(employee_id);
CREATE INDEX idx_custom_kpi_evaluations_custom_kpi ON custom_kpi_evaluations(custom_kpi_id);
CREATE INDEX idx_custom_kpi_evaluations_year_month ON custom_kpi_evaluations(year, month);
CREATE INDEX idx_custom_kpi_evaluations_status ON custom_kpi_evaluations(status);

-- Enable RLS
ALTER TABLE custom_kpi_evaluations ENABLE ROW LEVEL SECURITY;

-- HR can manage custom KPI evaluations
CREATE POLICY "HR can view custom_kpi_evaluations" ON custom_kpi_evaluations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can insert custom_kpi_evaluations" ON custom_kpi_evaluations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can update custom_kpi_evaluations" ON custom_kpi_evaluations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can delete custom_kpi_evaluations" ON custom_kpi_evaluations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- Add comments for documentation
COMMENT ON TABLE custom_kpi_evaluations IS 'Monthly evaluation records for custom/individual KPIs';
COMMENT ON COLUMN custom_kpi_evaluations.achieved_value IS 'Actual value achieved by employee';
COMMENT ON COLUMN custom_kpi_evaluations.score IS 'Calculated percentage score (achieved_value / target_value * 100)';
