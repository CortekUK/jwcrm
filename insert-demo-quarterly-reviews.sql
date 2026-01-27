-- Demo Quarterly Reviews Data
-- This script inserts sample quarterly reviews for testing and visualization
-- Run this after employees and user_roles tables are populated

-- First, get a reviewer ID (typically the HR user or admin)
-- We'll use a variable to store the first available HR user
DO $$
DECLARE
  v_reviewer_id UUID;
  v_employee_record RECORD;
  v_review_id UUID;
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

  -- Loop through active employees and create quarterly reviews
  FOR v_employee_record IN 
    SELECT id, full_name, job_title 
    FROM employees 
    WHERE employment_status = 'active' 
    LIMIT 12
  LOOP
    -- Q4 2025 Review - Complete
    INSERT INTO quarterly_reviews (
      employee_id, reviewer_id, quarter, year, status,
      deadline_date, submitted_at, approved_by, approved_at, completed_at,
      overall_kpi_score, performance_summary, strengths, areas_for_improvement,
      goals_next_quarter, development_plan, manager_comments
    ) VALUES (
      v_employee_record.id,
      v_reviewer_id,
      4, 2025,
      'complete',
      '2025-12-31',
      '2025-12-20 10:00:00+00',
      v_reviewer_id,
      '2025-12-22 14:00:00+00',
      '2025-12-28 09:00:00+00',
      ROUND((70 + RANDOM() * 25)::NUMERIC, 2),
      'Strong performance throughout Q4. ' || v_employee_record.full_name || ' has consistently met and exceeded expectations in their role as ' || COALESCE(v_employee_record.job_title, 'team member') || '. They have shown excellent initiative and dedication to their work.',
      '• Excellent communication skills and team collaboration
• Strong problem-solving abilities
• Consistently meets deadlines
• Proactive approach to challenges',
      '• Time management during peak periods
• Documentation of processes
• Delegation of tasks',
      '• Complete advanced training certification
• Mentor one junior team member
• Improve client satisfaction scores by 10%',
      'Enroll in leadership development program. Shadow senior team members on complex projects.',
      'Overall an excellent quarter. Looking forward to continued growth in Q1 2026.'
    ) ON CONFLICT (employee_id, quarter, year) DO NOTHING;

    -- Q1 2026 Review - Various statuses based on employee index
    CASE 
      -- First 3 employees: Complete reviews
      WHEN (SELECT COUNT(*) FROM quarterly_reviews WHERE employee_id = v_employee_record.id AND year = 2026) = 0 
           AND (SELECT COUNT(*) FROM employees WHERE id <= v_employee_record.id AND employment_status = 'active') <= 3 THEN
        INSERT INTO quarterly_reviews (
          employee_id, reviewer_id, quarter, year, status,
          deadline_date, submitted_at, approved_by, approved_at, completed_at,
          overall_kpi_score, performance_summary, strengths, areas_for_improvement,
          goals_next_quarter, development_plan, manager_comments
        ) VALUES (
          v_employee_record.id,
          v_reviewer_id,
          1, 2026,
          'complete',
          '2026-01-31',
          '2026-01-20 10:00:00+00',
          v_reviewer_id,
          '2026-01-22 14:00:00+00',
          '2026-01-25 09:00:00+00',
          ROUND((75 + RANDOM() * 20)::NUMERIC, 2),
          'Q1 2026 showed continued growth and improvement. ' || v_employee_record.full_name || ' has successfully achieved most of their quarterly goals and made significant contributions to the team.',
          '• Demonstrated strong leadership qualities
• Improved technical skills
• Excellent client feedback
• Great team collaboration',
          '• Cross-functional communication
• Project documentation
• Knowledge sharing with team',
          '• Lead a major project initiative
• Complete certification program
• Achieve 95% client satisfaction',
          'Focus on leadership development and cross-team collaboration.',
          'Excellent progress this quarter. Ready for increased responsibilities.'
        ) ON CONFLICT (employee_id, quarter, year) DO NOTHING;

      -- Next 3 employees: Approved status
      WHEN (SELECT COUNT(*) FROM quarterly_reviews WHERE employee_id = v_employee_record.id AND year = 2026) = 0 
           AND (SELECT COUNT(*) FROM employees WHERE id <= v_employee_record.id AND employment_status = 'active') <= 6 THEN
        INSERT INTO quarterly_reviews (
          employee_id, reviewer_id, quarter, year, status,
          deadline_date, submitted_at, approved_by, approved_at,
          overall_kpi_score, performance_summary, strengths, areas_for_improvement,
          goals_next_quarter, development_plan, manager_comments
        ) VALUES (
          v_employee_record.id,
          v_reviewer_id,
          1, 2026,
          'approved',
          '2026-01-31',
          '2026-01-18 10:00:00+00',
          v_reviewer_id,
          '2026-01-20 14:00:00+00',
          ROUND((70 + RANDOM() * 25)::NUMERIC, 2),
          'Good performance in Q1 2026. ' || v_employee_record.full_name || ' has met expectations and shown steady improvement in key areas.',
          '• Reliable and consistent work output
• Good attention to detail
• Positive attitude
• Willingness to learn',
          '• Initiative on new projects
• Time management
• Technical skill development',
          '• Take ownership of a key project
• Improve response times
• Develop new technical skills',
          'Enroll in relevant training courses. Seek mentorship from senior team members.',
          'Good progress. Encourage more proactive involvement in team initiatives.'
        ) ON CONFLICT (employee_id, quarter, year) DO NOTHING;

      -- Next 3 employees: Submitted (pending approval)
      WHEN (SELECT COUNT(*) FROM quarterly_reviews WHERE employee_id = v_employee_record.id AND year = 2026) = 0 
           AND (SELECT COUNT(*) FROM employees WHERE id <= v_employee_record.id AND employment_status = 'active') <= 9 THEN
        INSERT INTO quarterly_reviews (
          employee_id, reviewer_id, quarter, year, status,
          deadline_date, submitted_at,
          overall_kpi_score, performance_summary, strengths, areas_for_improvement,
          goals_next_quarter, development_plan, manager_comments
        ) VALUES (
          v_employee_record.id,
          v_reviewer_id,
          1, 2026,
          'submitted',
          '2026-01-31',
          '2026-01-25 10:00:00+00',
          ROUND((65 + RANDOM() * 30)::NUMERIC, 2),
          'Q1 2026 review for ' || v_employee_record.full_name || '. Overall satisfactory performance with areas for growth.',
          '• Meets basic job requirements
• Team player
• Good communication',
          '• Needs to improve productivity
• Should take more initiative
• Technical skills need enhancement',
          '• Meet all project deadlines
• Complete required training
• Improve KPI scores by 15%',
          'Regular check-ins with manager. Structured development plan for skill improvement.',
          'Awaiting HR approval. Employee shows potential for growth.'
        ) ON CONFLICT (employee_id, quarter, year) DO NOTHING;

      -- Remaining employees: Draft status (some overdue)
      ELSE
        INSERT INTO quarterly_reviews (
          employee_id, reviewer_id, quarter, year, status,
          deadline_date,
          overall_kpi_score, performance_summary
        ) VALUES (
          v_employee_record.id,
          v_reviewer_id,
          1, 2026,
          'draft',
          CASE 
            WHEN RANDOM() > 0.5 THEN '2026-01-20'::DATE  -- Overdue
            ELSE '2026-02-15'::DATE  -- Upcoming deadline
          END,
          ROUND((60 + RANDOM() * 35)::NUMERIC, 2),
          'Draft review for ' || v_employee_record.full_name || '. In progress.'
        ) ON CONFLICT (employee_id, quarter, year) DO NOTHING;
    END CASE;
  END LOOP;

  RAISE NOTICE 'Demo quarterly reviews inserted successfully';
END $$;

-- Verify the inserted data
SELECT 
  qr.quarter || '/Q' || qr.year AS period,
  e.full_name,
  qr.status,
  qr.overall_kpi_score,
  qr.deadline_date,
  CASE 
    WHEN qr.deadline_date < CURRENT_DATE AND qr.status NOT IN ('approved', 'complete') THEN 'OVERDUE'
    ELSE 'OK'
  END AS deadline_status
FROM quarterly_reviews qr
JOIN employees e ON e.id = qr.employee_id
ORDER BY qr.year DESC, qr.quarter DESC, e.full_name;
