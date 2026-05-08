
-- 1. admin_courses: created_by + colegio_id
ALTER TABLE public.admin_courses
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS colegio_id uuid REFERENCES public.colegios(id) ON DELETE CASCADE;

-- Nuevas políticas: utp_head puede gestionar sus propios cursos
DROP POLICY IF EXISTS "UTP can insert own admin_courses" ON public.admin_courses;
CREATE POLICY "UTP can insert own admin_courses"
  ON public.admin_courses FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'utp_head'::app_role)
    AND created_by = auth.uid()
    AND colegio_id = (SELECT colegio_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "UTP can update own admin_courses" ON public.admin_courses;
CREATE POLICY "UTP can update own admin_courses"
  ON public.admin_courses FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'utp_head'::app_role) AND created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'utp_head'::app_role) AND created_by = auth.uid());

DROP POLICY IF EXISTS "UTP can delete own admin_courses" ON public.admin_courses;
CREATE POLICY "UTP can delete own admin_courses"
  ON public.admin_courses FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'utp_head'::app_role) AND created_by = auth.uid());

-- 2. colegios: UTP puede actualizar su propio colegio (solo logo via trigger)
DROP POLICY IF EXISTS "UTP can update own colegio" ON public.colegios;
CREATE POLICY "UTP can update own colegio"
  ON public.colegios FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'utp_head'::app_role)
    AND id = (SELECT colegio_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'utp_head'::app_role)
    AND id = (SELECT colegio_id FROM public.profiles WHERE id = auth.uid())
  );

-- Trigger: solo admin puede cambiar el nombre del colegio
CREATE OR REPLACE FUNCTION public.protect_colegio_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nombre IS DISTINCT FROM OLD.nombre AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Solo el Administrador puede modificar el nombre del colegio.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_colegio_name_trigger ON public.colegios;
CREATE TRIGGER protect_colegio_name_trigger
  BEFORE UPDATE ON public.colegios
  FOR EACH ROW EXECUTE FUNCTION public.protect_colegio_name();

-- 3. Storage: bucket user-logos, política para colegios/{colegio_id}/...
DROP POLICY IF EXISTS "Staff can manage colegio logos" ON storage.objects;
CREATE POLICY "Staff can manage colegio logos"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'user-logos'
    AND (storage.foldername(name))[1] = 'colegios'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        has_role(auth.uid(), 'utp_head'::app_role)
        AND (storage.foldername(name))[2] = (SELECT colegio_id::text FROM public.profiles WHERE id = auth.uid())
      )
    )
  )
  WITH CHECK (
    bucket_id = 'user-logos'
    AND (storage.foldername(name))[1] = 'colegios'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        has_role(auth.uid(), 'utp_head'::app_role)
        AND (storage.foldername(name))[2] = (SELECT colegio_id::text FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- 4. handle_new_user: créditos=0 para institucionales
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Institucionales: saldo personal = 0 (dependen de la bolsa del colegio)
  IF v_colegio_id IS NOT NULL THEN
    v_default_credits := 0;
  ELSE
    SELECT default_credits INTO v_default_credits
    FROM public.plans
    WHERE is_default = true
    LIMIT 1;
    IF v_default_credits IS NULL THEN v_default_credits := 20; END IF;
  END IF;

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
