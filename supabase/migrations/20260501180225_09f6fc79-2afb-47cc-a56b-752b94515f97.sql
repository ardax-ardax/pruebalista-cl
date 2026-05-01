
-- Add status and utp_feedback columns
ALTER TABLE public.assessments ADD COLUMN status text NOT NULL DEFAULT 'borrador';
ALTER TABLE public.assessments ADD COLUMN utp_feedback text;

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own or staff all" ON public.assessments;

-- Teachers can update their own assessments only if status is borrador or rechazado
CREATE POLICY "Teachers can update own draft/rejected"
ON public.assessments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND status IN ('borrador', 'rechazado')
)
WITH CHECK (
  user_id = auth.uid()
  AND status IN ('borrador', 'rechazado', 'pendiente_revision')
);

-- Staff (admin/utp_head) can update any assessment
CREATE POLICY "Staff can update any assessment"
ON public.assessments
FOR UPDATE
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));
