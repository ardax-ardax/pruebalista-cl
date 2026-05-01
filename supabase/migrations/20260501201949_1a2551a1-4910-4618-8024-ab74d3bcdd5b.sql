-- Revoke EXECUTE on SECURITY DEFINER functions from anon role
-- These functions are used internally by RLS policies and should not be callable by unauthenticated users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
