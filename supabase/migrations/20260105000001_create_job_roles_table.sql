-- Create job_roles table for HR KPI management
CREATE TABLE job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for department lookup
CREATE INDEX idx_job_roles_department ON job_roles(department_id);

-- Enable RLS
ALTER TABLE job_roles ENABLE ROW LEVEL SECURITY;

-- HR can manage job roles
CREATE POLICY "HR can view job_roles" ON job_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can insert job_roles" ON job_roles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can update job_roles" ON job_roles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can delete job_roles" ON job_roles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- Add comment for documentation
COMMENT ON TABLE job_roles IS 'Job roles for employees, used to assign relevant KPIs';
