
-- Fix SELECT policy: apply hidden_by_users filter in ALL branches
DROP POLICY IF EXISTS "Read own not hidden or same colegio" ON public.question_bank;

CREATE POLICY "Read own not hidden or same colegio" ON public.question_bank
FOR SELECT TO authenticated
USING (
  NOT (auth.uid() = ANY(hidden_by_users))
  AND (
    user_id = auth.uid()
    OR is_same_colegio(auth.uid(), user_id)
  )
);

-- Create security definer function to hide a question for a user
CREATE OR REPLACE FUNCTION public.hide_question_for_user(_question_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.question_bank
  SET hidden_by_users = array_append(hidden_by_users, _user_id)
  WHERE id = _question_id
    AND NOT (_user_id = ANY(hidden_by_users));
  RETURN FOUND;
END;
$$;
