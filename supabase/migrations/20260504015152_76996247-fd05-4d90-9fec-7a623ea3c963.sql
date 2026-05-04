
-- 1. Tabla admin_courses
CREATE TABLE public.admin_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_value text NOT NULL UNIQUE,
  label text NOT NULL,
  level text NOT NULL DEFAULT 'Básica',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read admin_courses"
  ON public.admin_courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert admin_courses"
  ON public.admin_courses FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update admin_courses"
  ON public.admin_courses FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete admin_courses"
  ON public.admin_courses FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Tabla admin_course_subjects
CREATE TABLE public.admin_course_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.admin_courses(id) ON DELETE CASCADE NOT NULL,
  subject_value text NOT NULL,
  subject_label text NOT NULL,
  UNIQUE(course_id, subject_value)
);

ALTER TABLE public.admin_course_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read admin_course_subjects"
  ON public.admin_course_subjects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert admin_course_subjects"
  ON public.admin_course_subjects FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update admin_course_subjects"
  ON public.admin_course_subjects FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete admin_course_subjects"
  ON public.admin_course_subjects FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Tabla plan_allowed_courses
CREATE TABLE public.plan_allowed_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text REFERENCES public.plans(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.admin_courses(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(plan_id, course_id)
);

ALTER TABLE public.plan_allowed_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read plan_allowed_courses"
  ON public.plan_allowed_courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert plan_allowed_courses"
  ON public.plan_allowed_courses FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete plan_allowed_courses"
  ON public.plan_allowed_courses FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Columna section_letter en teacher_assignments
ALTER TABLE public.teacher_assignments ADD COLUMN section_letter text NOT NULL DEFAULT 'A';

-- 5. Seed: cursos existentes
INSERT INTO public.admin_courses (grade_value, label, level, sort_order) VALUES
  ('1ºBásico', '1° Básico', 'Básica', 1),
  ('2ºBásico', '2° Básico', 'Básica', 2),
  ('3ºBásico', '3° Básico', 'Básica', 3),
  ('4ºBásico', '4° Básico', 'Básica', 4),
  ('5ºBásico', '5° Básico', 'Básica', 5),
  ('6ºBásico', '6° Básico', 'Básica', 6),
  ('7ºBásico', '7° Básico', 'Básica', 7),
  ('8ºBásico', '8° Básico', 'Básica', 8),
  ('IMedio', 'I Medio', 'Media', 9),
  ('IIMedio', 'II Medio', 'Media', 10),
  ('IIIMedio', 'III Medio', 'Media', 11),
  ('IVMedio', 'IV Medio', 'Media', 12);
