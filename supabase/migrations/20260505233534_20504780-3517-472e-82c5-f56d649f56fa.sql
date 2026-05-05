
-- Replace the existing SELECT policy with a more restrictive one
DROP POLICY IF EXISTS "Read own not hidden or same colegio" ON public.question_bank;

CREATE POLICY "Docente reads own, staff reads colegio"
ON public.question_bank FOR SELECT TO authenticated
USING (
  NOT (auth.uid() = ANY(hidden_by_users))
  AND (
    user_id = auth.uid()
    OR (is_staff(auth.uid()) AND is_same_colegio(auth.uid(), user_id))
  )
);
