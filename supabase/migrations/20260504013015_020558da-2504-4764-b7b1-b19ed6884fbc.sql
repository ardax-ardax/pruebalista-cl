REVOKE EXECUTE ON FUNCTION public.hide_question_for_user(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.hide_question_for_user(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.hide_question_for_user(uuid, uuid) TO authenticated;