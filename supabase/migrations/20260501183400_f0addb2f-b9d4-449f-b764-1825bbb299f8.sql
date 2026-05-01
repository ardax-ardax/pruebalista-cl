
-- 1. Tabla global_settings (single-row)
CREATE TABLE public.global_settings (
  id boolean PRIMARY KEY DEFAULT true,
  enable_payments boolean NOT NULL DEFAULT false,
  default_free_credits integer NOT NULL DEFAULT 20,
  maintenance_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = true)
);

-- Insertar fila única
INSERT INTO public.global_settings (id) VALUES (true);

-- RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read global_settings"
ON public.global_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update global_settings"
ON public.global_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Agregar plan_expires_at a user_usage
ALTER TABLE public.user_usage
ADD COLUMN plan_expires_at timestamptz DEFAULT NULL;

-- 3. Actualizar handle_new_user para leer default_free_credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invited_role public.app_role;
  v_default_credits integer;
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

  -- Leer créditos por defecto desde global_settings
  SELECT default_free_credits INTO v_default_credits
  FROM public.global_settings
  WHERE id = true;

  IF v_default_credits IS NULL THEN
    v_default_credits := 20;
  END IF;

  INSERT INTO public.user_usage (user_id, credits_available)
  VALUES (NEW.id, v_default_credits)
  ON CONFLICT (user_id) DO NOTHING;

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
$function$;
