-- Create departments table for HR employee management
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- HR can manage departments
CREATE POLICY "HR can view departments" ON departments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can insert departments" ON departments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can delete departments" ON departments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- Seed initial departments
INSERT INTO departments (name) VALUES
  ('Engineering'),
  ('Human Resources'),
  ('Finance'),
  ('Marketing'),
  ('Operations'),
  ('Legal'),
  ('Sales');
