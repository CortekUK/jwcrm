-- Migration: Add contacted status to lead_status enum
-- Adds the 'contacted' status for leads that have been contacted

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'contacted' AFTER 'not_started';
