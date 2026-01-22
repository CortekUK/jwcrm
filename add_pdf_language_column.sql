-- Add pdf_language column to wills table
-- This column stores the user's preferred language for the PDF will document

ALTER TABLE wills
ADD COLUMN IF NOT EXISTS pdf_language TEXT DEFAULT 'english' CHECK (pdf_language IN ('english', 'arabic'));

-- Add comment to the column
COMMENT ON COLUMN wills.pdf_language IS 'Preferred language for PDF will document: english or arabic';
