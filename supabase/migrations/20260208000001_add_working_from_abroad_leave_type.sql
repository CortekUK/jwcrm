-- Migration: Add 'working_from_abroad' to leave_type enum
-- Description: Adds a new leave type for employees working from overseas

ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'working_from_abroad';
