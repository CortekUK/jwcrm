-- Migration: Create leave approval workflow tables
-- Description: Adds multi-level approval chains, auto-escalation, and delegation support

-- =====================================================
-- 1. APPROVAL CHAIN CONFIGURATION TABLE
-- =====================================================
-- Defines approval rules based on leave type and duration

CREATE TABLE IF NOT EXISTS leave_approval_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Rule conditions
    leave_type leave_type, -- NULL means applies to all leave types
    min_days INTEGER DEFAULT 1, -- Minimum days for this rule to apply
    max_days INTEGER, -- Maximum days (NULL = unlimited)
    
    -- Approval requirements
    requires_manager_approval BOOLEAN DEFAULT true,
    requires_hr_approval BOOLEAN DEFAULT true,
    requires_director_approval BOOLEAN DEFAULT false,
    
    -- Auto-escalation settings
    escalation_days INTEGER DEFAULT 3, -- Days before auto-escalation
    
    -- Rule priority (lower = higher priority)
    priority INTEGER DEFAULT 100,
    
    -- Active status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leave_approval_rules_leave_type ON leave_approval_rules(leave_type);
CREATE INDEX IF NOT EXISTS idx_leave_approval_rules_active ON leave_approval_rules(is_active);

-- Enable RLS
ALTER TABLE leave_approval_rules ENABLE ROW LEVEL SECURITY;

-- HR and Admin can manage approval rules
CREATE POLICY "HR can manage leave_approval_rules" ON leave_approval_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role IN ('hr', 'admin')
        )
    );

-- =====================================================
-- 2. APPROVAL CHAIN STATUS TABLE
-- =====================================================
-- Tracks the approval status at each level for a leave request

CREATE TABLE IF NOT EXISTS leave_approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    
    -- Approval step details
    step_order INTEGER NOT NULL, -- 1 = first approval, 2 = second, etc.
    approver_type TEXT NOT NULL CHECK (approver_type IN ('manager', 'hr', 'director', 'delegated')),
    approver_id UUID REFERENCES auth.users(id), -- The specific user who should approve
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'skipped', 'escalated')),
    
    -- Response details
    response_at TIMESTAMPTZ,
    response_by UUID REFERENCES auth.users(id),
    comments TEXT,
    
    -- Escalation tracking
    escalated_at TIMESTAMPTZ,
    escalated_to UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(leave_request_id, step_order)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leave_approval_steps_request ON leave_approval_steps(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_approval_steps_approver ON leave_approval_steps(approver_id);
CREATE INDEX IF NOT EXISTS idx_leave_approval_steps_status ON leave_approval_steps(status);

-- Enable RLS
ALTER TABLE leave_approval_steps ENABLE ROW LEVEL SECURITY;

-- HR and Admin can manage approval steps
CREATE POLICY "HR can manage leave_approval_steps" ON leave_approval_steps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role IN ('hr', 'admin')
        )
    );

-- Approvers can view and update their own steps
CREATE POLICY "Approvers can view their steps" ON leave_approval_steps
    FOR SELECT USING (approver_id = auth.uid() OR escalated_to = auth.uid());

CREATE POLICY "Approvers can update their steps" ON leave_approval_steps
    FOR UPDATE USING (approver_id = auth.uid() OR escalated_to = auth.uid());

-- =====================================================
-- 3. APPROVAL DELEGATION TABLE
-- =====================================================
-- Allows users to delegate approval authority

CREATE TABLE IF NOT EXISTS leave_approval_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Delegator (person delegating their authority)
    delegator_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Delegate (person receiving authority)
    delegate_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Delegation period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Scope
    leave_types leave_type[], -- NULL = all types
    max_days INTEGER, -- NULL = unlimited
    
    -- Active status
    is_active BOOLEAN DEFAULT true,
    
    -- Reason for delegation
    reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Prevent self-delegation
    CHECK (delegator_id != delegate_id),
    -- Ensure valid date range
    CHECK (end_date >= start_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leave_approval_delegations_delegator ON leave_approval_delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_leave_approval_delegations_delegate ON leave_approval_delegations(delegate_id);
CREATE INDEX IF NOT EXISTS idx_leave_approval_delegations_dates ON leave_approval_delegations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_approval_delegations_active ON leave_approval_delegations(is_active);

-- Enable RLS
ALTER TABLE leave_approval_delegations ENABLE ROW LEVEL SECURITY;

-- Users can view delegations they're involved in
CREATE POLICY "Users can view their delegations" ON leave_approval_delegations
    FOR SELECT USING (delegator_id = auth.uid() OR delegate_id = auth.uid());

-- Users can manage their own delegations
CREATE POLICY "Users can create delegations" ON leave_approval_delegations
    FOR INSERT WITH CHECK (delegator_id = auth.uid());

CREATE POLICY "Users can update their delegations" ON leave_approval_delegations
    FOR UPDATE USING (delegator_id = auth.uid());

CREATE POLICY "Users can delete their delegations" ON leave_approval_delegations
    FOR DELETE USING (delegator_id = auth.uid());

-- HR can manage all delegations
CREATE POLICY "HR can manage all delegations" ON leave_approval_delegations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role IN ('hr', 'admin')
        )
    );

-- =====================================================
-- 4. ADD COLUMNS TO LEAVE_REQUESTS TABLE
-- =====================================================

-- Add current approval step tracking
ALTER TABLE leave_requests 
    ADD COLUMN IF NOT EXISTS current_approval_step INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS total_approval_steps INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS approval_rule_id UUID REFERENCES leave_approval_rules(id),
    ADD COLUMN IF NOT EXISTS escalation_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ;

-- Create index for escalation queries
CREATE INDEX IF NOT EXISTS idx_leave_requests_escalation ON leave_requests(status, created_at) 
    WHERE status = 'pending';

-- =====================================================
-- 5. INSERT DEFAULT APPROVAL RULES
-- =====================================================

-- Rule 1: Short leave (1-3 days) - Manager approval only
INSERT INTO leave_approval_rules (leave_type, min_days, max_days, requires_manager_approval, requires_hr_approval, requires_director_approval, escalation_days, priority)
VALUES 
    (NULL, 1, 3, true, false, false, 2, 10)
ON CONFLICT DO NOTHING;

-- Rule 2: Medium leave (4-7 days) - Manager + HR approval
INSERT INTO leave_approval_rules (leave_type, min_days, max_days, requires_manager_approval, requires_hr_approval, requires_director_approval, escalation_days, priority)
VALUES 
    (NULL, 4, 7, true, true, false, 3, 20)
ON CONFLICT DO NOTHING;

-- Rule 3: Long leave (8+ days) - Manager + HR + Director approval
INSERT INTO leave_approval_rules (leave_type, min_days, max_days, requires_manager_approval, requires_hr_approval, requires_director_approval, escalation_days, priority)
VALUES 
    (NULL, 8, NULL, true, true, true, 3, 30)
ON CONFLICT DO NOTHING;

-- Rule 4: Emergency leave - HR approval only (fast-track)
INSERT INTO leave_approval_rules (leave_type, min_days, max_days, requires_manager_approval, requires_hr_approval, requires_director_approval, escalation_days, priority)
VALUES 
    ('emergency', 1, NULL, false, true, false, 1, 5)
ON CONFLICT DO NOTHING;

-- Rule 5: Unpaid leave - Manager + HR + Director approval (regardless of duration)
INSERT INTO leave_approval_rules (leave_type, min_days, max_days, requires_manager_approval, requires_hr_approval, requires_director_approval, escalation_days, priority)
VALUES 
    ('unpaid', 1, NULL, true, true, true, 3, 15)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. CREATE FUNCTION TO GET APPLICABLE APPROVAL RULE
-- =====================================================

CREATE OR REPLACE FUNCTION get_applicable_approval_rule(
    p_leave_type leave_type,
    p_total_days INTEGER
)
RETURNS UUID AS $$
DECLARE
    v_rule_id UUID;
BEGIN
    SELECT id INTO v_rule_id
    FROM leave_approval_rules
    WHERE is_active = true
        AND (leave_type IS NULL OR leave_type = p_leave_type)
        AND p_total_days >= min_days
        AND (max_days IS NULL OR p_total_days <= max_days)
    ORDER BY 
        -- Specific leave type rules take priority over generic
        CASE WHEN leave_type IS NOT NULL THEN 0 ELSE 1 END,
        priority ASC
    LIMIT 1;
    
    RETURN v_rule_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. CREATE FUNCTION TO CHECK FOR ACTIVE DELEGATION
-- =====================================================

CREATE OR REPLACE FUNCTION get_active_delegate(
    p_delegator_id UUID,
    p_leave_type leave_type,
    p_total_days INTEGER
)
RETURNS UUID AS $$
DECLARE
    v_delegate_id UUID;
BEGIN
    SELECT delegate_id INTO v_delegate_id
    FROM leave_approval_delegations
    WHERE delegator_id = p_delegator_id
        AND is_active = true
        AND CURRENT_DATE BETWEEN start_date AND end_date
        AND (leave_types IS NULL OR p_leave_type = ANY(leave_types))
        AND (max_days IS NULL OR p_total_days <= max_days)
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN v_delegate_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE leave_approval_rules IS 'Configurable rules for multi-level leave approval workflow';
COMMENT ON TABLE leave_approval_steps IS 'Tracks approval status at each level of the approval chain';
COMMENT ON TABLE leave_approval_delegations IS 'Allows users to delegate approval authority during absences';

COMMENT ON COLUMN leave_approval_rules.escalation_days IS 'Number of days before auto-escalating to next level';
COMMENT ON COLUMN leave_approval_rules.priority IS 'Lower number = higher priority when multiple rules match';

COMMENT ON COLUMN leave_approval_steps.approver_type IS 'Type of approver: manager, hr, director, or delegated';
COMMENT ON COLUMN leave_approval_steps.status IS 'pending, approved, denied, skipped, or escalated';

COMMENT ON COLUMN leave_requests.current_approval_step IS 'Current step in the approval chain (1-indexed)';
COMMENT ON COLUMN leave_requests.total_approval_steps IS 'Total number of approval steps required';
COMMENT ON COLUMN leave_requests.escalation_count IS 'Number of times this request has been escalated';
