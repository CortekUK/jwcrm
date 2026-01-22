-- Migration: Create leave_requests table for managing leave request workflow
-- Description: Handles leave requests with approval/denial workflow

-- Create enum type for leave type
DO $$ BEGIN
    CREATE TYPE leave_type AS ENUM (
        'annual',
        'sick',
        'emergency',
        'unpaid'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum type for leave request status
DO $$ BEGIN
    CREATE TYPE leave_request_status AS ENUM (
        'pending',
        'approved',
        'denied'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Leave details
    leave_type leave_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    reason TEXT,
    attachment_path TEXT,

    -- Approval workflow
    status leave_request_status DEFAULT 'pending',
    denial_reason TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_start_date ON leave_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_leave_type ON leave_requests(leave_type);

-- Enable Row Level Security
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Policy: HR users can perform all operations on leave_requests
CREATE POLICY "HR can manage leave_requests" ON leave_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'hr'
        )
    );

-- Policy: Admin users can also manage leave_requests
CREATE POLICY "Admin can manage leave_requests" ON leave_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Add comments for documentation
COMMENT ON TABLE leave_requests IS 'Employee leave requests with approval workflow';
COMMENT ON COLUMN leave_requests.leave_type IS 'Type of leave: annual, sick, emergency, unpaid';
COMMENT ON COLUMN leave_requests.total_days IS 'Total working days (excluding weekends)';
COMMENT ON COLUMN leave_requests.attachment_path IS 'Path to supporting document (e.g., medical certificate)';
COMMENT ON COLUMN leave_requests.status IS 'Request status: pending, approved, denied';
COMMENT ON COLUMN leave_requests.denial_reason IS 'Reason for denial (required when status is denied)';
COMMENT ON COLUMN leave_requests.approved_by IS 'HR user who approved/denied the request';
COMMENT ON COLUMN leave_requests.approved_at IS 'Timestamp when request was approved/denied';
