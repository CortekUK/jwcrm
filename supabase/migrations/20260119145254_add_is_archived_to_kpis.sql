-- Migration: Add is_archived column to kpis table
-- Allows archiving KPIs instead of deleting them

ALTER TABLE kpis
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN kpis.is_archived IS 'Indicates whether the KPI has been archived. Archived KPIs are hidden from active lists but preserved for historical records.';
