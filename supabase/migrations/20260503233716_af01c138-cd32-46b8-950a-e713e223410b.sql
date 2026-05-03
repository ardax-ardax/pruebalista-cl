-- Create plans table
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  label text NOT NULL,
  max_assessments integer DEFAULT NULL,
  max_assignments integer DEFAULT NULL,
  can_export_docx boolean NOT NULL DEFAULT false,
  show_watermark boolean NOT NULL DEFAULT false,
  can_edit_layout boolean NOT NULL DEFAULT true,
  default_credits integer NOT NULL DEFAULT 20,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read plans
CREATE POLICY "Authenticated can read plans"
  ON public.plans FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage plans
CREATE POLICY "Admin can insert plans"
  ON public.plans FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update plans"
  ON public.plans FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete plans"
  ON public.plans FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial plans
INSERT INTO public.plans (id, label, max_assessments, max_assignments, can_export_docx, show_watermark, can_edit_layout, default_credits, is_default, sort_order) VALUES
  ('free', 'Plan Gratuito', 10, 5, false, true, true, 20, true, 0),
  ('pro', 'Plan Pro', NULL, NULL, true, false, true, 50, false, 1),
  ('institucional', 'Plan Institucional', NULL, NULL, true, false, false, 100, false, 2);

-- Replace validate_plan_type trigger function to validate against plans table
CREATE OR REPLACE FUNCTION public.validate_plan_type()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = NEW.plan_type) THEN
    RAISE EXCEPTION 'plan_type inválido: %', NEW.plan_type;
  END IF;
  RETURN NEW;
END;
$function$;

-- Replace validate_teacher_assignment_limit to read from plans table
CREATE OR REPLACE FUNCTION public.validate_teacher_assignment_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  current_count integer;
  user_plan text;
  plan_max integer;
BEGIN
  SELECT plan_type INTO user_plan
  FROM public.user_usage
  WHERE user_id = NEW.teacher_user_id;

  SELECT max_assignments INTO plan_max
  FROM public.plans
  WHERE id = COALESCE(user_plan, 'free');

  -- NULL means unlimited
  IF plan_max IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO current_count
  FROM public.teacher_assignments
  WHERE teacher_user_id = NEW.teacher_user_id;

  IF current_count >= plan_max THEN
    RAISE EXCEPTION 'Tu plan permite máximo % asignaciones de curso/asignatura', plan_max;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update handle_new_user to read default_credits from plans table
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
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

  -- Read default credits from the default plan
  SELECT default_credits INTO v_default_credits
  FROM public.plans
  WHERE is_default = true
  LIMIT 1;
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
$function$;