-- Migration: Create leave_balances table for tracking employee leave entitlements
-- Description: Tracks annual and sick leave balances per employee per year

-- Create leave_balances table
CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,

    -- Annual leave (UAE standard: 30 days after 1 year of service)
    annual_entitled INTEGER DEFAULT 30,
    annual_used INTEGER DEFAULT 0,
    annual_pending INTEGER DEFAULT 0,

    -- Sick leave (UAE standard: 90 days per year)
    sick_entitled INTEGER DEFAULT 90,
    sick_used INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Each employee can only have one balance record per year
    UNIQUE(employee_id, year)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_id ON leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year);

-- Enable Row Level Security
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- Policy: HR users can perform all operations on leave_balances
CREATE POLICY "HR can manage leave_balances" ON leave_balances
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'hr'
        )
    );

-- Policy: Admin users can also manage leave_balances
CREATE POLICY "Admin can manage leave_balances" ON leave_balances
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Add comments for documentation
COMMENT ON TABLE leave_balances IS 'Yearly leave balances for employees';
COMMENT ON COLUMN leave_balances.year IS 'Calendar year for this balance record';
COMMENT ON COLUMN leave_balances.annual_entitled IS 'Total annual leave days entitled (default: 30 per UAE law)';
COMMENT ON COLUMN leave_balances.annual_used IS 'Annual leave days already used';
COMMENT ON COLUMN leave_balances.annual_pending IS 'Annual leave days in pending requests';
COMMENT ON COLUMN leave_balances.sick_entitled IS 'Total sick leave days entitled (default: 90 per UAE law)';
COMMENT ON COLUMN leave_balances.sick_used IS 'Sick leave days already used';
