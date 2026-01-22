-- Create employees table for HR employee management
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Personal Info
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,

  -- Job Info
  job_title TEXT,
  department_id UUID REFERENCES departments(id),
  manager_id UUID REFERENCES employees(id),
  start_date DATE NOT NULL,
  salary DECIMAL(12,2),

  -- Employment Status
  employment_status TEXT DEFAULT 'active'
    CHECK (employment_status IN ('active', 'inactive', 'on_leave', 'terminated')),
  termination_reason TEXT,
  last_working_day DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- HR can manage all employees
CREATE POLICY "HR can view employees" ON employees
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can insert employees" ON employees
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can update employees" ON employees
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can delete employees" ON employees
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- Create index for common queries
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(employment_status);
CREATE INDEX idx_employees_manager ON employees(manager_id);
