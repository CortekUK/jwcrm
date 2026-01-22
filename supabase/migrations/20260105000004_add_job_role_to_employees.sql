-- Add job_role_id column to employees table
ALTER TABLE employees ADD COLUMN job_role_id UUID REFERENCES job_roles(id) ON DELETE SET NULL;

-- Create index for job role lookup
CREATE INDEX idx_employees_job_role ON employees(job_role_id);

-- Migrate existing job_title data to job_roles table
-- Step 1: Insert unique job titles as job roles
INSERT INTO job_roles (name, created_at)
SELECT DISTINCT TRIM(job_title), now()
FROM employees
WHERE job_title IS NOT NULL
  AND TRIM(job_title) != ''
ON CONFLICT (name) DO NOTHING;

-- Step 2: Update employees with corresponding job_role_id
UPDATE employees e
SET job_role_id = jr.id
FROM job_roles jr
WHERE TRIM(e.job_title) = jr.name
  AND e.job_title IS NOT NULL;

-- Note: job_title column is kept for backward compatibility
-- It can be deprecated in a future migration after verifying all data is migrated

-- Add comment for documentation
COMMENT ON COLUMN employees.job_role_id IS 'Foreign key to job_roles table - assigned at creation, editable';
