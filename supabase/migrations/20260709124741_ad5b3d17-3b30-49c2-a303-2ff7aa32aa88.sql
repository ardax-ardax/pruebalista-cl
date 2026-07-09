
-- 1) courses.colegio_id
ALTER TABLE public.courses ADD COLUMN colegio_id uuid NULL REFERENCES public.colegios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS courses_colegio_id_idx ON public.courses(colegio_id);

-- 2) students RLS: reemplazar policy abierta por scoping via courses.colegio_id
DROP POLICY IF EXISTS "Authenticated can read students" ON public.students;
DROP POLICY IF EXISTS "Staff can insert students" ON public.students;
DROP POLICY IF EXISTS "Staff can update students" ON public.students;
DROP POLICY IF EXISTS "Staff can delete students" ON public.students;

CREATE POLICY "Students visible to same colegio or admin"
ON public.students FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = students.course_id
      AND c.colegio_id IS NOT NULL
      AND c.colegio_id = p.colegio_id
  )
);

CREATE POLICY "Staff of same colegio insert students"
ON public.students FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = students.course_id
      AND c.colegio_id IS NOT NULL
      AND c.colegio_id = p.colegio_id
      AND is_staff(auth.uid())
  )
);

CREATE POLICY "Staff of same colegio update students"
ON public.students FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = students.course_id
      AND c.colegio_id IS NOT NULL
      AND c.colegio_id = p.colegio_id
      AND is_staff(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = students.course_id
      AND c.colegio_id IS NOT NULL
      AND c.colegio_id = p.colegio_id
      AND is_staff(auth.uid())
  )
);

CREATE POLICY "Staff of same colegio delete students"
ON public.students FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = students.course_id
      AND c.colegio_id IS NOT NULL
      AND c.colegio_id = p.colegio_id
      AND is_staff(auth.uid())
  )
);

-- 3) courses SELECT scoping (evitar leak indirecto)
DROP POLICY IF EXISTS "Authenticated can read courses" ON public.courses;
CREATE POLICY "Courses visible to same colegio or admin"
ON public.courses FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    colegio_id IS NOT NULL
    AND colegio_id = (SELECT colegio_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- 4) teacher_assignments.admin_course_id + trigger de aislamiento
ALTER TABLE public.teacher_assignments
  ADD COLUMN admin_course_id uuid NULL REFERENCES public.admin_courses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS teacher_assignments_admin_course_idx ON public.teacher_assignments(admin_course_id);

CREATE OR REPLACE FUNCTION public.validate_teacher_assignment_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_colegio uuid;
  v_course_colegio uuid;
BEGIN
  SELECT colegio_id INTO v_teacher_colegio
  FROM public.profiles WHERE id = NEW.teacher_user_id;

  IF v_teacher_colegio IS NOT NULL THEN
    -- Docente institucional: exige admin_course_id del mismo colegio
    IF NEW.admin_course_id IS NULL THEN
      RAISE EXCEPTION 'Docente institucional debe seleccionar un curso del colegio (admin_course_id requerido).';
    END IF;
    SELECT colegio_id INTO v_course_colegio
    FROM public.admin_courses WHERE id = NEW.admin_course_id;
    IF v_course_colegio IS DISTINCT FROM v_teacher_colegio THEN
      RAISE EXCEPTION 'No puedes asignarte a un curso de otro colegio.';
    END IF;
  ELSE
    -- Docente autónomo: no puede vincular admin_course_id
    IF NEW.admin_course_id IS NOT NULL THEN
      RAISE EXCEPTION 'Docentes sin colegio no pueden vincular admin_course_id.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_teacher_assignment_scope ON public.teacher_assignments;
CREATE TRIGGER trg_validate_teacher_assignment_scope
BEFORE INSERT OR UPDATE ON public.teacher_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_teacher_assignment_scope();
