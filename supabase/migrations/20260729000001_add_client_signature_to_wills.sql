-- Client e-signature on the FINALISED will.
--
-- Deliberately separate from the signature captured during intake
-- (answers.family_exclusion.signature), which acknowledges the
-- family-exclusion clause and is signed before the will is even drafted.
-- This one is the testator signing the finished document, so it must be
-- stored and audited independently — overwriting or reusing the intake
-- signature would misrepresent what the client actually signed and when.
ALTER TABLE public.wills
  ADD COLUMN IF NOT EXISTS client_signature TEXT,
  ADD COLUMN IF NOT EXISTS client_signature_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_pdf_path TEXT;

COMMENT ON COLUMN public.wills.client_signature IS 'Base64 PNG of the testator''s signature on the finalised will. NULL = not yet signed.';
COMMENT ON COLUMN public.wills.client_signature_at IS 'When the finalised will was signed by the client.';

-- The signed copy is a SEPARATE file from pdf_path. pdf_path stays exactly as
-- the team uploaded it (often hand-edited in Word), and the signed copy is
-- that same document plus an appended execution page carrying the client's
-- signature. Two distinct documents, neither overwriting the other.
COMMENT ON COLUMN public.wills.signed_pdf_path IS 'Storage path of the signed copy: the finalised PDF plus an appended execution page. NULL until signed. pdf_path is never modified.';
