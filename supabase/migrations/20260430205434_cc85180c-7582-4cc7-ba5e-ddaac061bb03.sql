-- Permitir que admins/UTP (staff) puedan insertar/upsert assessments
-- de cualquier docente. Antes la política sólo permitía user_id = auth.uid(),
-- lo que rompía el upsert cuando un admin editaba la prueba de otro docente.
DROP POLICY IF EXISTS "Users can insert own" ON public.assessments;

CREATE POLICY "Users can insert own or staff all"
ON public.assessments
FOR INSERT
TO authenticated
WITH CHECK ((user_id = auth.uid()) OR public.is_staff(auth.uid()));