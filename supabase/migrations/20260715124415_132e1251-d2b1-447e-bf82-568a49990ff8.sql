
-- 1. Hard-block admin invitations at trigger level (defense in depth over RLS)
CREATE OR REPLACE FUNCTION public.enforce_pending_invitation_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin'::public.app_role
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede crear invitaciones con rol admin.';
  END IF;
  -- UTP heads can only invite for their own colegio
  IF public.has_role(auth.uid(), 'utp_head'::public.app_role)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.colegio_id IS DISTINCT FROM (
      SELECT colegio_id FROM public.profiles WHERE id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'No puedes invitar a otro colegio.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pending_invitation_role ON public.pending_invitations;
CREATE TRIGGER trg_enforce_pending_invitation_role
BEFORE INSERT OR UPDATE ON public.pending_invitations
FOR EACH ROW EXECUTE FUNCTION public.enforce_pending_invitation_role();

-- 2. Column-level lockdown on global_settings sensitive column
REVOKE SELECT (default_free_credits) ON public.global_settings FROM authenticated, anon;

-- 3. Revoke EXECUTE on SECURITY DEFINER trigger-only functions from PUBLIC/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_teacher_assignment_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_teacher_assignment_scope() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_colegio_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_pending_invitation_role() FROM PUBLIC, anon, authenticated;

-- 4. Revoke from anon on app-callable definer functions (keep authenticated for RLS/app)
REVOKE EXECUTE ON FUNCTION public.deduct_credit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hide_question_for_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_same_colegio(uuid, uuid) FROM PUBLIC, anon;
