-- Client request: an editable Word (.docx) draft generated alongside the PDF,
-- so staff can amend it before the final PDF goes out. "Generate Draft" now
-- produces both files in one action; docx_path tracks the Word copy the same
-- way pdf_path already tracks the PDF.

ALTER TABLE public.wills
  ADD COLUMN IF NOT EXISTS docx_path TEXT;

ALTER TABLE public.will_document_versions
  ADD COLUMN IF NOT EXISTS docx_path TEXT;

COMMENT ON COLUMN public.wills.docx_path IS
  'Storage path of the editable Word (.docx) draft generated alongside pdf_path. Staff edit this, then re-upload the finalized PDF via the existing Upload PDF flow.';
COMMENT ON COLUMN public.will_document_versions.docx_path IS
  'Storage path of the Word (.docx) draft for this version, if one was generated alongside the PDF.';
