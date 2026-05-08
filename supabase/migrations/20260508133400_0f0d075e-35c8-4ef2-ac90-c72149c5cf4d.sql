-- 1) ASSESSMENTS: restringir lectura/edición a propietario o staff del mismo colegio
DROP POLICY IF EXISTS "View own or same colegio" ON public.assessments;
DROP POLICY IF EXISTS "Insert own or same colegio" ON public.assessments;
DROP POLICY IF EXISTS "Update own draft or staff by colegio" ON public.assessments;
DROP POLICY IF EXISTS "Delete own or same colegio" ON public.assessments;

CREATE POLICY "Owner or staff colegio can view"
  ON public.assessments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (public.is_staff(auth.uid()) AND public.is_same_colegio(auth.uid(), user_id))
  );

CREATE POLICY "Owner or staff colegio can insert"
  ON public.assessments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (public.is_staff(auth.uid()) AND public.is_same_colegio(auth.uid(), user_id))
  );

CREATE POLICY "Owner draft or staff colegio can update"
  ON public.assessments FOR UPDATE TO authenticated
  USING (
    ((user_id = auth.uid()) AND (status = ANY (ARRAY['borrador'::text, 'rechazado'::text])))
    OR (public.is_staff(auth.uid()) AND public.is_same_colegio(auth.uid(), user_id))
  )
  WITH CHECK (
    ((user_id = auth.uid()) AND (status = ANY (ARRAY['borrador'::text, 'rechazado'::text, 'pendiente_revision'::text])))
    OR (public.is_staff(auth.uid()) AND public.is_same_colegio(auth.uid(), user_id))
  );

CREATE POLICY "Owner or staff colegio can delete"
  ON public.assessments FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (public.is_staff(auth.uid()) AND public.is_same_colegio(auth.uid(), user_id))
  );

-- 2) ADMIN_COURSES: cursos globales (colegio_id IS NULL) visibles para todos;
--    cursos de un colegio sólo para miembros de ese colegio o admin.
DROP POLICY IF EXISTS "Authenticated can read admin_courses" ON public.admin_courses;

CREATE POLICY "Read global or own colegio admin_courses"
  ON public.admin_courses FOR SELECT TO authenticated
  USING (
    colegio_id IS NULL
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR colegio_id = (SELECT p.colegio_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 3) AI_GENERATION_LOG: staff sólo ve logs de su colegio (admin ve todo)
DROP POLICY IF EXISTS "Staff reads all ai_generation_log" ON public.ai_generation_log;

CREATE POLICY "Staff reads colegio ai_generation_log"
  ON public.ai_generation_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (public.is_staff(auth.uid()) AND public.is_same_colegio(auth.uid(), user_id))
  );
