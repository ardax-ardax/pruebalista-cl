CREATE OR REPLACE FUNCTION public.sync_expired_plan(_user_id uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_default text;
  v_plan text;
  v_expires timestamptz;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE((SELECT id FROM public.plans WHERE is_default LIMIT 1), 'free') INTO v_default;

  SELECT plan_type, plan_expires_at INTO v_plan, v_expires
  FROM public.user_usage WHERE user_id = _user_id FOR UPDATE;

  IF v_plan IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_plan <> v_default AND v_expires IS NOT NULL AND v_expires <= now() THEN
    UPDATE public.user_usage
      SET plan_type = v_default,
          monthly_quota = NULL,
          plan_expires_at = NULL
      WHERE user_id = _user_id;
    RETURN v_default;
  END IF;

  RETURN v_plan;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_all_expired_plans()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_default text;
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE((SELECT id FROM public.plans WHERE is_default LIMIT 1), 'free') INTO v_default;

  WITH upd AS (
    UPDATE public.user_usage
      SET plan_type = v_default, monthly_quota = NULL, plan_expires_at = NULL
      WHERE plan_type <> v_default
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at <= now()
      RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN v_count;
END;
$function$;

-- Retroactivo: limpiar fechas viejas en usuarios ya degradados
UPDATE public.user_usage uu
SET plan_expires_at = NULL
WHERE uu.plan_expires_at IS NOT NULL
  AND uu.plan_expires_at <= now()
  AND uu.plan_type = COALESCE((SELECT id FROM public.plans WHERE is_default LIMIT 1), 'free');