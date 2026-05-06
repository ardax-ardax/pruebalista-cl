
-- Add is_public_institution flag to question_bank
ALTER TABLE public.question_bank
ADD COLUMN IF NOT EXISTS is_public_institution boolean NOT NULL DEFAULT false;

-- Index for efficient institutional bank queries
CREATE INDEX IF NOT EXISTS idx_question_bank_public_institution
ON public.question_bank (is_public_institution) WHERE is_public_institution = true;

-- Allow staff (UTP/Admin) to update the public flag on colegio questions
CREATE POLICY "Staff can update public flag for colegio questions"
ON public.question_bank
FOR UPDATE
TO authenticated
USING (is_staff(auth.uid()) AND is_same_colegio(auth.uid(), user_id))
WITH CHECK (is_staff(auth.uid()) AND is_same_colegio(auth.uid(), user_id));
