
-- Tabla de uso y plan por usuario
CREATE TABLE public.user_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  credits_available int NOT NULL DEFAULT 20,
  plan_type text NOT NULL DEFAULT 'free',
  last_reset timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validar plan_type con trigger (evitar CHECK constraint para restauraciones)
CREATE OR REPLACE FUNCTION public.validate_plan_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.plan_type NOT IN ('free', 'pro', 'institucional') THEN
    RAISE EXCEPTION 'plan_type inválido: %', NEW.plan_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_plan_type
BEFORE INSERT OR UPDATE ON public.user_usage
FOR EACH ROW EXECUTE FUNCTION public.validate_plan_type();

-- RLS
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own usage"
ON public.user_usage FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admin manages usage"
ON public.user_usage FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Actualizar handle_new_user para crear fila en user_usage
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invited_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Crear fila de uso/créditos
  INSERT INTO public.user_usage (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Buscar invitación pendiente por email (case-insensitive).
  SELECT role INTO invited_role
  FROM public.pending_invitations
  WHERE lower(email) = lower(NEW.email)
    AND consumed_at IS NULL
  LIMIT 1;

  IF NEW.email = 'admin@cnlc.cl' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF invited_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invited_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.pending_invitations
      SET consumed_at = now()
      WHERE lower(email) = lower(NEW.email)
        AND consumed_at IS NULL;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Crear filas de user_usage para usuarios existentes que aún no tengan
INSERT INTO public.user_usage (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_usage)
ON CONFLICT (user_id) DO NOTHING;
