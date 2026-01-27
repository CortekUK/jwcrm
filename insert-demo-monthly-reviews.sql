-- Demo Monthly Reviews Data
-- This script inserts sample monthly reviews for testing and visualization
-- Run this after employees table is populated and after the monthly_reviews migration

-- Insert demo monthly reviews for active employees
DO $$
DECLARE
  v_reviewer_id UUID;
  v_employee_record RECORD;
  v_month INTEGER;
  v_year INTEGER;
  v_status review_status;
  v_score DECIMAL(5,2);
  v_employee_count INTEGER := 0;
BEGIN
  -- Get an HR user to be the reviewer
  SELECT user_id INTO v_reviewer_id FROM user_roles WHERE role = 'hr' LIMIT 1;
  
  -- If no HR user found, use the first user in auth.users
  IF v_reviewer_id IS NULL THEN
    SELECT id INTO v_reviewer_id FROM auth.users LIMIT 1;
  END IF;
  
  -- Exit if no user found
  IF v_reviewer_id IS NULL THEN
    RAISE NOTICE 'No users found. Please create users first.';
    RETURN;
  END IF;

  -- Loop through active employees
  FOR v_employee_record IN 
    SELECT id, full_name 
    FROM employees 
    WHERE employment_status = 'active' 
    LIMIT 10
  LOOP
    v_employee_count := v_employee_count + 1;
    
    -- Generate monthly reviews for Q4 2025 (Oct, Nov, Dec)
    FOR v_month IN 10..12 LOOP
      v_year := 2025;
      
      -- All Q4 2025 reviews are complete
      INSERT INTO monthly_reviews (
        employee_id, reviewer_id, month, year, status,
        deadline_date, submitted_at, approved_by, approved_at, completed_at,
        overall_kpi_score, performance_summary, achievements, challenges, goals_progress, manager_notes
      ) VALUES (
        v_employee_record.id,
        v_reviewer_id,
        v_month,
        v_year,
        'complete',
        (DATE '2025-10-01' + ((v_month - 10) * INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '5 days')::DATE,
        (TIMESTAMP '2025-10-20' + ((v_month - 10) * INTERVAL '1 month'))::TIMESTAMPTZ,
        v_reviewer_id,
        (TIMESTAMP '2025-10-22' + ((v_month - 10) * INTERVAL '1 month'))::TIMESTAMPTZ,
        (TIMESTAMP '2025-10-25' + ((v_month - 10) * INTERVAL '1 month'))::TIMESTAMPTZ,
        ROUND((65 + RANDOM() * 30)::NUMERIC, 2),
        CASE v_month
          WHEN 10 THEN 'October performance was strong with consistent delivery on key projects. ' || v_employee_record.full_name || ' showed great initiative.'
          WHEN 11 THEN 'November continued the positive trajectory with improved collaboration. ' || v_employee_record.full_name || ' met all targets.'
          WHEN 12 THEN 'December wrapped up the year well. ' || v_employee_record.full_name || ' exceeded expectations in closing out Q4 goals.'
        END,
        CASE v_month
          WHEN 10 THEN '• Successfully completed project milestone
• Received positive client feedback
• Mentored new team member'
          WHEN 11 THEN '• Led team meeting effectively
• Improved process efficiency
• Met all deadlines'
          WHEN 12 THEN '• Achieved quarterly sales target
• Completed certification
• Year-end project delivered on time'
        END,
        CASE v_month
          WHEN 10 THEN '• Workload balance during peak period
• Communication with remote team'
          WHEN 11 THEN '• Adapting to new tools
• Time zone coordination'
          WHEN 12 THEN '• Holiday staffing challenges
• End-of-year reporting volume'
        END,
        CASE v_month
          WHEN 10 THEN 'On track with quarterly goals. Making progress on skill development.'
          WHEN 11 THEN 'Q4 goals 70% complete. Need to accelerate on remaining items.'
          WHEN 12 THEN 'Q4 goals achieved. Ready to set new objectives for Q1.'
        END,
        CASE v_month
          WHEN 10 THEN 'Good start to Q4. Keep up the momentum.'
          WHEN 11 THEN 'Strong mid-quarter performance. Continue the good work.'
          WHEN 12 THEN 'Excellent finish to the quarter. Well done!'
        END
      ) ON CONFLICT (employee_id, month, year) DO NOTHING;
    END LOOP;
    
    -- Generate monthly reviews for Q1 2026 (Jan only - we're in late Jan)
    v_month := 1;
    v_year := 2026;
    
    -- Vary status based on employee position in the list
    IF v_employee_count <= 3 THEN
      -- First 3: Complete
      v_status := 'complete';
      INSERT INTO monthly_reviews (
        employee_id, reviewer_id, month, year, status,
        deadline_date, submitted_at, approved_by, approved_at, completed_at,
        overall_kpi_score, performance_summary, achievements, challenges, goals_progress, manager_notes
      ) VALUES (
        v_employee_record.id,
        v_reviewer_id,
        v_month,
        v_year,
        v_status,
        '2026-02-05'::DATE,
        '2026-01-20 10:00:00+00'::TIMESTAMPTZ,
        v_reviewer_id,
        '2026-01-22 14:00:00+00'::TIMESTAMPTZ,
        '2026-01-25 09:00:00+00'::TIMESTAMPTZ,
        ROUND((75 + RANDOM() * 20)::NUMERIC, 2),
        'January 2026 - Strong start to the year. ' || v_employee_record.full_name || ' has hit the ground running with renewed focus.',
        '• Set clear Q1 objectives
• Completed onboarding for new project
• Positive team collaboration',
        '• Adjusting to new year workload
• Balancing multiple priorities',
        'Making good progress on Q1 goals. Ahead of schedule on key deliverables.',
        'Excellent start to 2026. Keep this momentum going.'
      ) ON CONFLICT (employee_id, month, year) DO NOTHING;
      
    ELSIF v_employee_count <= 5 THEN
      -- Next 2: Approved
      v_status := 'approved';
      INSERT INTO monthly_reviews (
        employee_id, reviewer_id, month, year, status,
        deadline_date, submitted_at, approved_by, approved_at,
        overall_kpi_score, performance_summary, achievements, challenges, goals_progress
      ) VALUES (
        v_employee_record.id,
        v_reviewer_id,
        v_month,
        v_year,
        v_status,
        '2026-02-05'::DATE,
        '2026-01-22 10:00:00+00'::TIMESTAMPTZ,
        v_reviewer_id,
        '2026-01-24 14:00:00+00'::TIMESTAMPTZ,
        ROUND((70 + RANDOM() * 25)::NUMERIC, 2),
        'January review for ' || v_employee_record.full_name || '. Overall positive performance to start the year.',
        '• Participated in planning sessions
• Delivered on early January tasks
• Good attendance record',
        '• Learning new systems
• Ramping up on Q1 projects',
        'On track with initial Q1 objectives.'
      ) ON CONFLICT (employee_id, month, year) DO NOTHING;
      
    ELSIF v_employee_count <= 7 THEN
      -- Next 2: Submitted (pending approval)
      v_status := 'submitted';
      INSERT INTO monthly_reviews (
        employee_id, reviewer_id, month, year, status,
        deadline_date, submitted_at,
        overall_kpi_score, performance_summary, achievements, challenges, goals_progress
      ) VALUES (
        v_employee_record.id,
        v_reviewer_id,
        v_month,
        v_year,
        v_status,
        '2026-02-05'::DATE,
        '2026-01-25 10:00:00+00'::TIMESTAMPTZ,
        ROUND((65 + RANDOM() * 30)::NUMERIC, 2),
        'January 2026 monthly review for ' || v_employee_record.full_name || '. Submitted for HR approval.',
        '• Completed assigned tasks
• Attended all team meetings',
        '• Workload management
• Skill development needed',
        'Working towards Q1 objectives.'
      ) ON CONFLICT (employee_id, month, year) DO NOTHING;
      
    ELSE
      -- Remaining: Draft (some overdue)
      v_status := 'draft';
      INSERT INTO monthly_reviews (
        employee_id, reviewer_id, month, year, status,
        deadline_date,
        overall_kpi_score, performance_summary
      ) VALUES (
        v_employee_record.id,
        v_reviewer_id,
        v_month,
        v_year,
        v_status,
        CASE 
          WHEN RANDOM() > 0.5 THEN '2026-01-20'::DATE  -- Overdue
          ELSE '2026-02-10'::DATE  -- Upcoming
        END,
        ROUND((60 + RANDOM() * 35)::NUMERIC, 2),
        'Draft - January 2026 review for ' || v_employee_record.full_name || '. In progress.'
      ) ON CONFLICT (employee_id, month, year) DO NOTHING;
    END IF;
    
  END LOOP;

  RAISE NOTICE 'Demo monthly reviews inserted successfully for % employees', v_employee_count;
END $$;

-- Verify the inserted monthly reviews
SELECT 
  mr.month || '/' || mr.year AS period,
  e.full_name,
  mr.status,
  mr.overall_kpi_score,
  mr.deadline_date,
  CASE 
    WHEN mr.deadline_date < CURRENT_DATE AND mr.status NOT IN ('approved', 'complete') THEN 'OVERDUE'
    ELSE 'OK'
  END AS deadline_status
FROM monthly_reviews mr
JOIN employees e ON e.id = mr.employee_id
ORDER BY mr.year DESC, mr.month DESC, e.full_name;
