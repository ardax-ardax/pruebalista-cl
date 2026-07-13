DROP POLICY IF EXISTS "Authenticated can read colegios" ON public.colegios;
CREATE POLICY "Members or admin can read own colegio"
ON public.colegios FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR id = (SELECT colegio_id FROM public.profiles WHERE id = auth.uid())
);