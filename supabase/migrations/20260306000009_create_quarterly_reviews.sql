-- Migration: Create Quarterly Reviews System
-- This creates tables for quarterly employee reviews with workflow tracking

-- Create review status enum
DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('draft', 'submitted', 'approved', 'complete');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create quarterly_reviews table
CREATE TABLE IF NOT EXISTS quarterly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Employee and reviewer
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),

  -- Period
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),

  -- Workflow status
  status review_status NOT NULL DEFAULT 'draft',
  deadline_date DATE,
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- KPI Performance (auto-calculated)
  overall_kpi_score DECIMAL(5,2),

  -- Review content
  performance_summary TEXT,
  strengths TEXT,
  areas_for_improvement TEXT,
  goals_next_quarter TEXT,
  development_plan TEXT,
  manager_comments TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one review per employee per quarter
  UNIQUE(employee_id, quarter, year)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_quarterly_reviews_employee ON quarterly_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_reviews_reviewer ON quarterly_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_reviews_status ON quarterly_reviews(status);
CREATE INDEX IF NOT EXISTS idx_quarterly_reviews_period ON quarterly_reviews(year, quarter);
CREATE INDEX IF NOT EXISTS idx_quarterly_reviews_deadline ON quarterly_reviews(deadline_date);

-- Enable RLS
ALTER TABLE quarterly_reviews ENABLE ROW LEVEL SECURITY;

-- HR can view all reviews
DO $$ BEGIN
  CREATE POLICY "HR can view all quarterly_reviews" ON quarterly_reviews
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- HR can insert reviews
DO $$ BEGIN
  CREATE POLICY "HR can insert quarterly_reviews" ON quarterly_reviews
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- HR can update all reviews (for approval workflow)
DO $$ BEGIN
  CREATE POLICY "HR can update quarterly_reviews" ON quarterly_reviews
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- HR can delete reviews
DO $$ BEGIN
  CREATE POLICY "HR can delete quarterly_reviews" ON quarterly_reviews
    FOR DELETE USING (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Managers can view reviews they created
DO $$ BEGIN
  CREATE POLICY "Reviewers can view own reviews" ON quarterly_reviews
    FOR SELECT USING (reviewer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Managers can update their own draft/submitted reviews
DO $$ BEGIN
  CREATE POLICY "Reviewers can update own draft reviews" ON quarterly_reviews
    FOR UPDATE USING (
      reviewer_id = auth.uid()
      AND status IN ('draft', 'submitted')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Employees can view their own completed reviews
DO $$ BEGIN
  CREATE POLICY "Employees can view own completed reviews" ON quarterly_reviews
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = quarterly_reviews.employee_id
        AND e.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
      AND status = 'complete'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_quarterly_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quarterly_reviews_updated_at ON quarterly_reviews;
CREATE TRIGGER quarterly_reviews_updated_at
  BEFORE UPDATE ON quarterly_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_quarterly_reviews_updated_at();

-- Add comment for documentation
COMMENT ON TABLE quarterly_reviews IS 'Quarterly performance reviews for employees with workflow tracking';

-----------------------------------------------------------
-- Create review_templates table for customizable templates
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS review_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Template sections (JSONB array of section definitions)
  -- Example: [{"id": "strengths", "title": "Strengths", "type": "text", "required": true}]
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_review_templates_active ON review_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_review_templates_default ON review_templates(is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE review_templates ENABLE ROW LEVEL SECURITY;

-- HR can manage templates
DO $$ BEGIN
  CREATE POLICY "HR can view review_templates" ON review_templates
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "HR can insert review_templates" ON review_templates
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "HR can update review_templates" ON review_templates
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "HR can delete review_templates" ON review_templates
    FOR DELETE USING (
      EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS review_templates_updated_at ON review_templates;
CREATE TRIGGER review_templates_updated_at
  BEFORE UPDATE ON review_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_quarterly_reviews_updated_at();

-- Add comment for documentation
COMMENT ON TABLE review_templates IS 'Customizable templates for quarterly reviews';

-----------------------------------------------------------
-- Insert default review template
-----------------------------------------------------------

INSERT INTO review_templates (name, description, is_default, is_active, sections)
VALUES (
  'Standard Quarterly Review',
  'Default template for quarterly employee performance reviews',
  true,
  true,
  '[
    {"id": "kpi_performance", "title": "KPI Performance", "type": "readonly", "order": 1},
    {"id": "performance_summary", "title": "Performance Summary", "type": "textarea", "required": true, "order": 2},
    {"id": "strengths", "title": "Strengths", "type": "textarea", "required": true, "order": 3},
    {"id": "areas_for_improvement", "title": "Areas for Improvement", "type": "textarea", "required": true, "order": 4},
    {"id": "goals_next_quarter", "title": "Goals for Next Quarter", "type": "textarea", "required": true, "order": 5},
    {"id": "development_plan", "title": "Development Plan", "type": "textarea", "required": false, "order": 6},
    {"id": "manager_comments", "title": "Manager Comments", "type": "textarea", "required": false, "order": 7}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;
