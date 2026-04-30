-- Helper: is_staff (admin OR utp_head)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'utp_head'::public.app_role)
  )
$$;

-- Lock down: function is intended for internal RLS use only via SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO postgres, service_role;

-- Assessments: include utp_head
DROP POLICY IF EXISTS "Users can view own or admin all" ON public.assessments;
DROP POLICY IF EXISTS "Users can update own or admin all" ON public.assessments;
DROP POLICY IF EXISTS "Users can delete own or admin all" ON public.assessments;

CREATE POLICY "Users can view own or staff all"
ON public.assessments FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR public.is_staff(auth.uid()));

CREATE POLICY "Users can update own or staff all"
ON public.assessments FOR UPDATE TO authenticated
USING ((user_id = auth.uid()) OR public.is_staff(auth.uid()))
WITH CHECK ((user_id = auth.uid()) OR public.is_staff(auth.uid()));

CREATE POLICY "Users can delete own or staff all"
ON public.assessments FOR DELETE TO authenticated
USING ((user_id = auth.uid()) OR public.is_staff(auth.uid()));

-- Curriculum: extend to staff
DROP POLICY IF EXISTS "Admins can insert curriculum" ON public.curriculum_base;
DROP POLICY IF EXISTS "Admins can update curriculum" ON public.curriculum_base;
DROP POLICY IF EXISTS "Admins can delete curriculum" ON public.curriculum_base;

CREATE POLICY "Staff can insert curriculum"
ON public.curriculum_base FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update curriculum"
ON public.curriculum_base FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete curriculum"
ON public.curriculum_base FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

-- Profiles: staff can read all
DROP POLICY IF EXISTS "Users can view own profile or admin all" ON public.profiles;
CREATE POLICY "Users can view own profile or staff all"
ON public.profiles FOR SELECT TO authenticated
USING ((id = auth.uid()) OR public.is_staff(auth.uid()));

-- teacher_assignments
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL,
  grade_value text NOT NULL,
  subject_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_user_id, grade_value, subject_value)
);

CREATE INDEX IF NOT EXISTS teacher_assignments_teacher_idx
  ON public.teacher_assignments(teacher_user_id);

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher reads own, staff reads all"
ON public.teacher_assignments FOR SELECT TO authenticated
USING ((teacher_user_id = auth.uid()) OR public.is_staff(auth.uid()));

CREATE POLICY "Staff inserts assignments"
ON public.teacher_assignments FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff updates assignments"
ON public.teacher_assignments FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff deletes assignments"
ON public.teacher_assignments FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));