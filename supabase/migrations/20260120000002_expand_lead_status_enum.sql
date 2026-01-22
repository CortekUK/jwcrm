-- Migration: Expand lead_status enum with additional statuses
-- Created: 2026-01-20
-- Description: Adds meeting, hold, qualified, and negotiation statuses to lead_status enum

-- Add new status values to the lead_status enum
-- Full status flow: not_started → meeting → qualified → negotiation → won/lost (with hold available at any stage)
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'meeting';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'hold';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'qualified';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'negotiation';

-- Update comment for documentation
COMMENT ON TYPE public.lead_status IS 'Lead status values: not_started (new), meeting (meeting scheduled), hold (on hold), qualified (lead qualified), negotiation (in negotiation), pending (proposal sent), won (paid), lost (rejected)';
