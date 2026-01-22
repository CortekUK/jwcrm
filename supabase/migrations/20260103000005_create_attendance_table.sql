-- Migration: Create attendance table for daily employee attendance tracking
-- Description: Tracks daily attendance status for all employees with check-in times

-- Create enum type for attendance status
DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM (
        'present',
        'late',
        'wfh',
        'on_leave',
        'sick_leave',
        'absent'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status attendance_status NOT NULL DEFAULT 'present',
    check_in_time TIME,
    reason TEXT,
    marked_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Each employee can only have one attendance record per day
    UNIQUE(employee_id, date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- Enable Row Level Security
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policy: HR users can perform all operations on attendance
CREATE POLICY "HR can manage attendance" ON attendance
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'hr'
        )
    );

-- Policy: Admin users can also manage attendance
CREATE POLICY "Admin can manage attendance" ON attendance
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Add comments for documentation
COMMENT ON TABLE attendance IS 'Daily attendance records for employees';
COMMENT ON COLUMN attendance.status IS 'Attendance status: present, late, wfh, on_leave, sick_leave, absent';
COMMENT ON COLUMN attendance.check_in_time IS 'Time employee checked in (relevant for present/late status)';
COMMENT ON COLUMN attendance.reason IS 'Optional reason for absence or notes';
COMMENT ON COLUMN attendance.marked_by IS 'HR user who marked this attendance';
