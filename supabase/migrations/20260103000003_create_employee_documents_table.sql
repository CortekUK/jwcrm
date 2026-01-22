-- Create employee_documents table for document management with expiry tracking
CREATE TABLE employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Document Info
  document_type TEXT NOT NULL CHECK (document_type IN (
    'passport',
    'employment_visa',
    'emirates_id',
    'employment_contract'
  )),
  document_path TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_size INTEGER,
  document_mime TEXT,

  -- Expiry Tracking
  expiry_date DATE,

  -- AI Extracted Data
  extracted_data JSONB DEFAULT '{}',

  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),

  -- One document per type per employee
  UNIQUE(employee_id, document_type)
);

-- Enable RLS
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

-- HR can manage employee documents
CREATE POLICY "HR can view employee documents" ON employee_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can insert employee documents" ON employee_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can update employee documents" ON employee_documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

CREATE POLICY "HR can delete employee documents" ON employee_documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- Index for expiry alerts query
CREATE INDEX idx_employee_documents_expiry ON employee_documents(expiry_date)
  WHERE expiry_date IS NOT NULL;

-- Index for employee lookup
CREATE INDEX idx_employee_documents_employee ON employee_documents(employee_id);
