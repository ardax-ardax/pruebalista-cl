-- Grant EXECUTE on has_role to authenticated and anon so RLS policies that call it don't error out
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- Simplify SELECT policy on user_roles so users can read their own roles without invoking has_role
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());