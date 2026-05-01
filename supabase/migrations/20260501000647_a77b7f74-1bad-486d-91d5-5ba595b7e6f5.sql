-- Tabla de cursos
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read courses"
  ON public.courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert courses"
  ON public.courses FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update courses"
  ON public.courses FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete courses"
  ON public.courses FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER courses_set_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabla de estudiantes
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rut TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_course_id ON public.students(course_id);
CREATE INDEX idx_students_rut ON public.students(rut);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read students"
  ON public.students FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert students"
  ON public.students FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update students"
  ON public.students FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete students"
  ON public.students FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER students_set_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();