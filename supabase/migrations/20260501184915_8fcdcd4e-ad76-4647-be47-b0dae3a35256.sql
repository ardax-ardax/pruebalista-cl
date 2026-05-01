
-- 1. Agregar hide_credits_from_teachers a app_settings
ALTER TABLE public.app_settings
ADD COLUMN hide_credits_from_teachers boolean NOT NULL DEFAULT false;

-- 2. Agregar monthly_quota a user_usage
ALTER TABLE public.user_usage
ADD COLUMN monthly_quota integer DEFAULT NULL;

-- 3. Crear tabla de auditoría de generaciones IA
CREATE TABLE public.ai_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  oa_code text,
  question_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generation_log ENABLE ROW LEVEL SECURITY;

-- El usuario puede ver sus propios registros
CREATE POLICY "Users read own ai_generation_log"
ON public.ai_generation_log
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Staff puede ver todos los registros
CREATE POLICY "Staff reads all ai_generation_log"
ON public.ai_generation_log
FOR SELECT TO authenticated
USING (is_staff(auth.uid()));

-- Solo inserción vía service role (edge function), pero permitir insert autenticado para consistencia
CREATE POLICY "Authenticated can insert ai_generation_log"
ON public.ai_generation_log
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. Permitir que staff lea todos los user_usage (para panel UTP)
CREATE POLICY "Staff reads all usage"
ON public.user_usage
FOR SELECT TO authenticated
USING (is_staff(auth.uid()));

-- 5. Permitir que staff actualice user_usage (recargar créditos, cuota)
CREATE POLICY "Staff manages usage"
ON public.user_usage
FOR UPDATE TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));
