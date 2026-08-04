-- 1) Function: persist downgrade for a single user
CREATE OR REPLACE FUNCTION public.sync_expired_plan(_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default text;
  v_plan text;
  v_expires timestamptz;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- only the user themself or an admin may trigger this
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
          monthly_quota = NULL
      WHERE user_id = _user_id;
    RETURN v_default;
  END IF;

  RETURN v_plan;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_expired_plan(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_expired_plan(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_expired_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_expired_plan(uuid) TO service_role;

-- 2) Bulk sweep (admin / service_role only)
CREATE OR REPLACE FUNCTION public.sync_all_expired_plans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      SET plan_type = v_default, monthly_quota = NULL
      WHERE plan_type <> v_default
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at <= now()
      RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_all_expired_plans() FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_all_expired_plans() FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_all_expired_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_expired_plans() TO service_role;

-- 3) Assignment limit must respect expiration too
CREATE OR REPLACE FUNCTION public.validate_teacher_assignment_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  current_count integer;
  user_plan text;
  user_expires timestamptz;
  v_default text;
  plan_max integer;
BEGIN
  SELECT COALESCE((SELECT id FROM public.plans WHERE is_default LIMIT 1), 'free') INTO v_default;

  SELECT plan_type, plan_expires_at INTO user_plan, user_expires
  FROM public.user_usage
  WHERE user_id = NEW.teacher_user_id;

  IF user_plan IS DISTINCT FROM v_default AND user_expires IS NOT NULL AND user_expires <= now() THEN
    user_plan := v_default;
  END IF;

  SELECT max_assignments INTO plan_max
  FROM public.plans
  WHERE id = COALESCE(user_plan, v_default);

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

-- 4) Retroactive fix right now
UPDATE public.user_usage
  SET plan_type = COALESCE((SELECT id FROM public.plans WHERE is_default LIMIT 1), 'free'),
      monthly_quota = NULL
  WHERE plan_type <> COALESCE((SELECT id FROM public.plans WHERE is_default LIMIT 1), 'free')
    AND plan_expires_at IS NOT NULL
    AND plan_expires_at <= now();
