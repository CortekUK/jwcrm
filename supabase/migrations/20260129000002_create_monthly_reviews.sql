-- Migration: Create Monthly Reviews System
-- Monthly reviews build up to quarterly reviews, providing consistent employee feedback

-- Create monthly_reviews table (uses existing review_status enum)
CREATE TABLE monthly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Employee and reviewer
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Period
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  
  -- Workflow status (reusing review_status enum from quarterly reviews)
  status review_status NOT NULL DEFAULT 'draft',
  deadline_date DATE,
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- KPI Performance (auto-calculated from kpi_evaluations for this month)
  overall_kpi_score DECIMAL(5,2),
  
  -- Monthly Review content (lighter than quarterly)
  performance_summary TEXT,
  achievements TEXT,
  challenges TEXT,
  goals_progress TEXT,
  manager_notes TEXT,
  
  -- Link to quarterly review if generated from this monthly
  linked_quarterly_review_id UUID REFERENCES quarterly_reviews(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one review per employee per month
  UNIQUE(employee_id, month, year)
);

-- Create indexes for common queries
CREATE INDEX idx_monthly_reviews_employee ON monthly_reviews(employee_id);
CREATE INDEX idx_monthly_reviews_reviewer ON monthly_reviews(reviewer_id);
CREATE INDEX idx_monthly_reviews_status ON monthly_reviews(status);
CREATE INDEX idx_monthly_reviews_period ON monthly_reviews(year, month);
CREATE INDEX idx_monthly_reviews_deadline ON monthly_reviews(deadline_date);
CREATE INDEX idx_monthly_reviews_quarter ON monthly_reviews(year, ((month - 1) / 3 + 1));

-- Enable RLS
ALTER TABLE monthly_reviews ENABLE ROW LEVEL SECURITY;

-- HR can view all monthly reviews
CREATE POLICY "HR can view all monthly_reviews" ON monthly_reviews
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- HR can insert monthly reviews
CREATE POLICY "HR can insert monthly_reviews" ON monthly_reviews
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- HR can update all monthly reviews
CREATE POLICY "HR can update monthly_reviews" ON monthly_reviews
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- HR can delete monthly reviews
CREATE POLICY "HR can delete monthly_reviews" ON monthly_reviews
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'hr')
  );

-- Reviewers can view their own reviews
CREATE POLICY "Reviewers can view own monthly_reviews" ON monthly_reviews
  FOR SELECT USING (reviewer_id = auth.uid());

-- Reviewers can update their own draft/submitted reviews
CREATE POLICY "Reviewers can update own draft monthly_reviews" ON monthly_reviews
  FOR UPDATE USING (
    reviewer_id = auth.uid() 
    AND status IN ('draft', 'submitted')
  );

-- Employees can view their own completed monthly reviews
CREATE POLICY "Employees can view own completed monthly_reviews" ON monthly_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = monthly_reviews.employee_id 
      AND e.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    AND status = 'complete'
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_monthly_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monthly_reviews_updated_at
  BEFORE UPDATE ON monthly_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_reviews_updated_at();

-- Add comment for documentation
COMMENT ON TABLE monthly_reviews IS 'Monthly performance reviews that aggregate into quarterly reviews';

-----------------------------------------------------------
-- Helper function to get quarter from month
-----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_quarter_from_month(p_month INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN ((p_month - 1) / 3) + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-----------------------------------------------------------
-- Helper function to get monthly reviews for a quarter
-----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_monthly_reviews_for_quarter(
  p_employee_id UUID,
  p_quarter INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  id UUID,
  month INTEGER,
  year INTEGER,
  status review_status,
  overall_kpi_score DECIMAL(5,2),
  performance_summary TEXT,
  achievements TEXT,
  challenges TEXT,
  goals_progress TEXT,
  manager_notes TEXT
) AS $$
DECLARE
  v_start_month INTEGER;
  v_end_month INTEGER;
BEGIN
  v_start_month := ((p_quarter - 1) * 3) + 1;
  v_end_month := p_quarter * 3;
  
  RETURN QUERY
  SELECT 
    mr.id,
    mr.month,
    mr.year,
    mr.status,
    mr.overall_kpi_score,
    mr.performance_summary,
    mr.achievements,
    mr.challenges,
    mr.goals_progress,
    mr.manager_notes
  FROM monthly_reviews mr
  WHERE mr.employee_id = p_employee_id
    AND mr.year = p_year
    AND mr.month BETWEEN v_start_month AND v_end_month
  ORDER BY mr.month;
END;
$$ LANGUAGE plpgsql;

-----------------------------------------------------------
-- Add column to quarterly_reviews to track linked monthly reviews
-----------------------------------------------------------
ALTER TABLE quarterly_reviews 
ADD COLUMN IF NOT EXISTS generated_from_monthly BOOLEAN DEFAULT false;

COMMENT ON COLUMN quarterly_reviews.generated_from_monthly IS 'Indicates if this quarterly review was generated from monthly reviews';
