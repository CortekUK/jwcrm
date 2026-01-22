-- Migration: Add consultation status to lead_status enum
-- Created: 2026-01-21
-- Description: Adds consultation status for tracking client consultations

-- Add consultation status to the lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'consultation' AFTER 'not_started';

-- Update comment for documentation
COMMENT ON TYPE public.lead_status IS 'Lead status values: not_started (new), consultation (in consultation), meeting (meeting scheduled), hold (on hold), qualified (lead qualified), negotiation (in negotiation), pending (proposal sent), won (paid), lost (rejected)';
