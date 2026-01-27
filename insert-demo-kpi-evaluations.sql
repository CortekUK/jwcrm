-- ============================================================
-- Demo Data: Pending KPI Evaluations
-- ============================================================
-- This script creates demo pending KPI evaluation records to
-- demonstrate the Pending Monthly Reviews and Pending Quarterly
-- Reviews cards on the HR Dashboard.
--
-- Run this in Supabase SQL Editor or via psql.
-- ============================================================

-- Step 1: Create demo job roles if none exist with KPIs
-- ============================================================
DO $$
DECLARE
    demo_job_role_id UUID;
    demo_department_id UUID;
BEGIN
    -- Check if we have any job roles
    IF NOT EXISTS (SELECT 1 FROM job_roles LIMIT 1) THEN
        -- Get or create a department
        SELECT id INTO demo_department_id FROM departments LIMIT 1;
        
        IF demo_department_id IS NULL THEN
            INSERT INTO departments (name) VALUES ('Operations') RETURNING id INTO demo_department_id;
            RAISE NOTICE 'Created demo department: Operations';
        END IF;
        
        -- Create demo job roles
        INSERT INTO job_roles (name, department_id) VALUES 
            ('Sales Executive', demo_department_id),
            ('Customer Service Representative', demo_department_id),
            ('Marketing Coordinator', demo_department_id)
        ON CONFLICT (name) DO NOTHING;
        
        RAISE NOTICE 'Created demo job roles';
    END IF;
END $$;

-- Step 2: Create demo KPIs for job roles that don't have any
-- ============================================================
DO $$
DECLARE
    jr RECORD;
BEGIN
    FOR jr IN 
        SELECT id, name FROM job_roles 
        WHERE NOT EXISTS (SELECT 1 FROM kpis WHERE job_role_id = job_roles.id)
        LIMIT 3
    LOOP
        INSERT INTO kpis (job_role_id, name, description, target_value, unit, weighting) VALUES
            (jr.id, 'Monthly Sales Target', 'Achieve monthly sales revenue target', 20000, 'aed', 40),
            (jr.id, 'Customer Satisfaction Score', 'Maintain customer satisfaction rating', 90, 'percentage', 30),
            (jr.id, 'Tasks Completed', 'Complete assigned tasks within deadline', 50, 'count', 30);
        
        RAISE NOTICE 'Created KPIs for job role: %', jr.name;
    END LOOP;
END $$;

-- Step 3: Assign job roles to employees that don't have one
-- ============================================================
DO $$
DECLARE
    emp RECORD;
    random_job_role_id UUID;
BEGIN
    FOR emp IN 
        SELECT id, full_name FROM employees 
        WHERE job_role_id IS NULL 
        AND employment_status = 'active'
        LIMIT 5
    LOOP
        -- Get a random job role that has KPIs
        SELECT jr.id INTO random_job_role_id 
        FROM job_roles jr
        WHERE EXISTS (SELECT 1 FROM kpis WHERE job_role_id = jr.id)
        ORDER BY RANDOM()
        LIMIT 1;
        
        IF random_job_role_id IS NOT NULL THEN
            UPDATE employees SET job_role_id = random_job_role_id WHERE id = emp.id;
            RAISE NOTICE 'Assigned job role to employee: %', emp.full_name;
        END IF;
    END LOOP;
END $$;

-- Step 4: Insert pending KPI evaluations for demo
-- ============================================================
-- This creates pending evaluations for the current month and previous months
-- to demonstrate the dashboard cards

DO $$
DECLARE
    emp RECORD;
    kpi_record RECORD;
    current_month INT := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
    current_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    prev_month INT;
    prev_year INT;
    prev2_month INT;
    prev2_year INT;
    records_created INT := 0;
BEGIN
    -- Calculate previous months
    prev_month := CASE WHEN current_month = 1 THEN 12 ELSE current_month - 1 END;
    prev_year := CASE WHEN current_month = 1 THEN current_year - 1 ELSE current_year END;
    
    prev2_month := CASE WHEN prev_month = 1 THEN 12 ELSE prev_month - 1 END;
    prev2_year := CASE WHEN prev_month = 1 THEN prev_year - 1 ELSE prev_year END;
    
    RAISE NOTICE 'Creating pending evaluations for months: %/%, %/%, %/%', 
        current_month, current_year, prev_month, prev_year, prev2_month, prev2_year;

    -- Loop through active employees with job roles
    FOR emp IN 
        SELECT e.id as employee_id, e.full_name, e.job_role_id
        FROM employees e
        WHERE e.employment_status = 'active'
        AND e.job_role_id IS NOT NULL
        LIMIT 5
    LOOP
        -- Get KPIs for this employee's job role
        FOR kpi_record IN 
            SELECT id FROM kpis WHERE job_role_id = emp.job_role_id
        LOOP
            -- Current month - pending evaluation
            INSERT INTO kpi_evaluations (employee_id, kpi_id, year, month, status, achieved_value)
            VALUES (emp.employee_id, kpi_record.id, current_year, current_month, 'pending', NULL)
            ON CONFLICT (employee_id, kpi_id, year, month) DO NOTHING;
            
            -- Previous month - pending evaluation (simulates overdue)
            INSERT INTO kpi_evaluations (employee_id, kpi_id, year, month, status, achieved_value)
            VALUES (emp.employee_id, kpi_record.id, prev_year, prev_month, 'pending', NULL)
            ON CONFLICT (employee_id, kpi_id, year, month) DO NOTHING;
            
            records_created := records_created + 2;
        END LOOP;
        
        RAISE NOTICE 'Created pending evaluations for: %', emp.full_name;
    END LOOP;
    
    RAISE NOTICE 'Total pending evaluation records created/updated: ~%', records_created;
END $$;

-- Step 5: Verify the data was created
-- ============================================================
SELECT 
    'Summary' as info,
    (SELECT COUNT(*) FROM job_roles) as job_roles_count,
    (SELECT COUNT(*) FROM kpis) as kpis_count,
    (SELECT COUNT(*) FROM employees WHERE job_role_id IS NOT NULL AND employment_status = 'active') as employees_with_roles,
    (SELECT COUNT(*) FROM kpi_evaluations WHERE status = 'pending' OR achieved_value IS NULL) as pending_evaluations;

-- Show pending evaluations by month
SELECT 
    e.full_name,
    ke.month,
    ke.year,
    COUNT(*) as pending_kpis
FROM kpi_evaluations ke
JOIN employees e ON ke.employee_id = e.id
WHERE ke.status = 'pending' OR ke.achieved_value IS NULL
GROUP BY e.full_name, ke.month, ke.year
ORDER BY ke.year DESC, ke.month DESC, e.full_name;

-- ============================================================
-- CLEANUP: Run this to remove demo data when no longer needed
-- ============================================================
-- DELETE FROM kpi_evaluations WHERE status = 'pending';
-- 
-- To reset everything (CAREFUL - deletes all KPI data):
-- DELETE FROM kpi_evaluations;
-- DELETE FROM kpis;
-- UPDATE employees SET job_role_id = NULL;
-- DELETE FROM job_roles;
-- ============================================================
