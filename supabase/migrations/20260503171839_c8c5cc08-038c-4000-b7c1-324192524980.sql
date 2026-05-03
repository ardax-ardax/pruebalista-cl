
-- PASO 1: Drop default antes de convertir a text
ALTER TABLE public.pending_invitations ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.pending_invitations ALTER COLUMN role TYPE text USING role::text;

-- PASO 2: Drop ALL dependent policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own profile or admin all" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile or admin all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or staff all" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can insert app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin manages usage" ON public.user_usage;
DROP POLICY IF EXISTS "Staff manages usage" ON public.user_usage;
DROP POLICY IF EXISTS "Staff reads all usage" ON public.user_usage;
DROP POLICY IF EXISTS "Admin can read global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Admin can update global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Users delete own or admin all" ON public.question_bank;
DROP POLICY IF EXISTS "Users read own questions" ON public.question_bank;
DROP POLICY IF EXISTS "Staff reads all questions" ON public.question_bank;
DROP POLICY IF EXISTS "Users can view own or staff all" ON public.assessments;
DROP POLICY IF EXISTS "Users can delete own or staff all" ON public.assessments;
DROP POLICY IF EXISTS "Users can insert own or staff all" ON public.assessments;
DROP POLICY IF EXISTS "Staff can update any assessment" ON public.assessments;
DROP POLICY IF EXISTS "Teachers can update own draft/rejected" ON public.assessments;
DROP POLICY IF EXISTS "Staff can insert curriculum" ON public.curriculum_base;
DROP POLICY IF EXISTS "Staff can update curriculum" ON public.curriculum_base;
DROP POLICY IF EXISTS "Staff can delete curriculum" ON public.curriculum_base;
DROP POLICY IF EXISTS "Teacher reads own, staff reads all" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Staff inserts assignments" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Staff updates assignments" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Staff deletes assignments" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Staff can read invitations" ON public.pending_invitations;
DROP POLICY IF EXISTS "Staff can insert invitations" ON public.pending_invitations;
DROP POLICY IF EXISTS "Staff can update invitations" ON public.pending_invitations;
DROP POLICY IF EXISTS "Staff can delete invitations" ON public.pending_invitations;
DROP POLICY IF EXISTS "Staff can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Staff can update courses" ON public.courses;
DROP POLICY IF EXISTS "Staff can delete courses" ON public.courses;
DROP POLICY IF EXISTS "Staff can insert students" ON public.students;
DROP POLICY IF EXISTS "Staff can update students" ON public.students;
DROP POLICY IF EXISTS "Staff can delete students" ON public.students;
DROP POLICY IF EXISTS "Staff reads all ai_generation_log" ON public.ai_generation_log;

-- PASO 3: Drop functions, update data, recreate enum
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_staff(uuid);

UPDATE public.user_roles SET role = 'docente' WHERE role = 'user';
UPDATE public.pending_invitations SET role = 'docente' WHERE role = 'user';

DROP TYPE public.app_role;
CREATE TYPE public.app_role AS ENUM ('admin', 'utp_head', 'docente');

ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::public.app_role;
ALTER TABLE public.pending_invitations ALTER COLUMN role TYPE public.app_role USING role::public.app_role;
ALTER TABLE public.pending_invitations ALTER COLUMN role SET DEFAULT 'docente'::public.app_role;

-- PASO 4: Recrear funciones
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'utp_head'::public.app_role)) $$;

-- PASO 5: Tabla colegios
CREATE TABLE public.colegios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  logo_url text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.colegios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read colegios" ON public.colegios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert colegios" ON public.colegios FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admin can update colegios" ON public.colegios FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admin can delete colegios" ON public.colegios FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER update_colegios_updated_at BEFORE UPDATE ON public.colegios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PASO 6: colegio_id
ALTER TABLE public.profiles ADD COLUMN colegio_id uuid REFERENCES public.colegios(id) ON DELETE SET NULL;
ALTER TABLE public.pending_invitations ADD COLUMN colegio_id uuid REFERENCES public.colegios(id) ON DELETE SET NULL;

-- PASO 7: is_same_colegio
CREATE OR REPLACE FUNCTION public.is_same_colegio(_staff_id uuid, _target_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _staff_id AND role = 'admin'::public.app_role)
    OR _staff_id = _target_user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p1.colegio_id = p2.colegio_id
      WHERE p1.id = _staff_id AND p2.id = _target_user_id AND p1.colegio_id IS NOT NULL
    )
$$;

-- PASO 8: Recrear TODAS las políticas
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users can view own profile or staff all" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()) OR is_staff(auth.uid()));
CREATE POLICY "Users can update own profile or admin all" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users can insert own profile or admin all" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()) OR has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update app_settings" ON public.app_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert app_settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admin manages usage" ON public.user_usage FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Staff manages usage" ON public.user_usage FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff reads all usage" ON public.user_usage FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Admin can read global_settings" ON public.global_settings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admin can update global_settings" ON public.global_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Staff can insert curriculum" ON public.curriculum_base FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff can update curriculum" ON public.curriculum_base FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff can delete curriculum" ON public.curriculum_base FOR DELETE TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Teacher reads own, staff reads all" ON public.teacher_assignments FOR SELECT TO authenticated USING ((teacher_user_id = auth.uid()) OR is_staff(auth.uid()));
CREATE POLICY "Staff inserts assignments" ON public.teacher_assignments FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff updates assignments" ON public.teacher_assignments FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff deletes assignments" ON public.teacher_assignments FOR DELETE TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Staff can read invitations" ON public.pending_invitations FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Staff can insert invitations" ON public.pending_invitations FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff can update invitations" ON public.pending_invitations FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff can delete invitations" ON public.pending_invitations FOR DELETE TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Staff can insert courses" ON public.courses FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff can update courses" ON public.courses FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff can delete courses" ON public.courses FOR DELETE TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Staff can insert students" ON public.students FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff can update students" ON public.students FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff can delete students" ON public.students FOR DELETE TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "Staff reads all ai_generation_log" ON public.ai_generation_log FOR SELECT TO authenticated USING (is_staff(auth.uid()));

-- PASO 9: RLS assessments con filtro por colegio
CREATE POLICY "View own or same colegio" ON public.assessments FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_same_colegio(auth.uid(), user_id));
CREATE POLICY "Insert own or same colegio" ON public.assessments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR is_same_colegio(auth.uid(), user_id));
CREATE POLICY "Delete own or same colegio" ON public.assessments FOR DELETE TO authenticated USING (user_id = auth.uid() OR is_same_colegio(auth.uid(), user_id));
CREATE POLICY "Update own draft or staff by colegio" ON public.assessments FOR UPDATE TO authenticated
  USING ((user_id = auth.uid() AND status IN ('borrador', 'rechazado')) OR is_same_colegio(auth.uid(), user_id))
  WITH CHECK ((user_id = auth.uid() AND status IN ('borrador', 'rechazado', 'pendiente_revision')) OR is_same_colegio(auth.uid(), user_id));

-- PASO 10: Soft-delete question_bank
ALTER TABLE public.question_bank ADD COLUMN hidden_by_users uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX idx_question_bank_hidden ON public.question_bank USING GIN(hidden_by_users);
CREATE POLICY "Read own not hidden or same colegio" ON public.question_bank FOR SELECT TO authenticated
  USING ((user_id = auth.uid() AND NOT (auth.uid() = ANY(hidden_by_users))) OR is_same_colegio(auth.uid(), user_id));
CREATE POLICY "Admin can delete questions" ON public.question_bank FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Users can update own questions" ON public.question_bank FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- PASO 11: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  invited_role public.app_role;
  v_default_credits integer;
  v_colegio_id uuid;
BEGIN
  SELECT role, colegio_id INTO invited_role, v_colegio_id
  FROM public.pending_invitations
  WHERE lower(email) = lower(NEW.email) AND consumed_at IS NULL LIMIT 1;

  INSERT INTO public.profiles (id, email, display_name, avatar_url, colegio_id)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    v_colegio_id
  ) ON CONFLICT (id) DO UPDATE SET colegio_id = COALESCE(profiles.colegio_id, v_colegio_id);

  SELECT default_free_credits INTO v_default_credits FROM public.global_settings WHERE id = true;
  IF v_default_credits IS NULL THEN v_default_credits := 20; END IF;

  INSERT INTO public.user_usage (user_id, credits_available) VALUES (NEW.id, v_default_credits) ON CONFLICT (user_id) DO NOTHING;

  IF NEW.email = 'admin@cnlc.cl' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF invited_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, invited_role) ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.pending_invitations SET consumed_at = now() WHERE lower(email) = lower(NEW.email) AND consumed_at IS NULL;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'docente') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
