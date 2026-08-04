CREATE POLICY "UTP can view gradings of their colegio"
ON public.assessment_gradings
FOR SELECT
TO authenticated
USING (
  public.is_staff(auth.uid())
  AND public.is_same_colegio(auth.uid(), user_id)
);

CREATE POLICY "UTP can view grading answers of their colegio"
ON public.assessment_grading_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.assessment_gradings g
    WHERE g.id = assessment_grading_answers.grading_id
      AND public.is_staff(auth.uid())
      AND public.is_same_colegio(auth.uid(), g.user_id)
  )
);