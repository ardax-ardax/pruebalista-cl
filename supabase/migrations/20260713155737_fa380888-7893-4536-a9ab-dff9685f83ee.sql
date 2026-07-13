
-- 1) pending_invitations: scope by colegio + block admin role for non-admin staff
DROP POLICY IF EXISTS "Staff can insert invitations" ON public.pending_invitations;
DROP POLICY IF EXISTS "Staff can update invitations" ON public.pending_invitations;
DROP POLICY IF EXISTS "Staff can delete invitations" ON public.pending_invitations;
DROP POLICY IF EXISTS "Staff can read invitations" ON public.pending_invitations;

CREATE POLICY "Admin manages invitations"
ON public.pending_invitations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "UTP reads own colegio invitations"
ON public.pending_invitations FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'utp_head'::app_role)
  AND colegio_id IS NOT NULL
  AND colegio_id = (SELECT colegio_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "UTP inserts own colegio invitations"
ON public.pending_invitations FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'utp_head'::app_role)
  AND role IN ('docente'::app_role, 'utp_head'::app_role)
  AND colegio_id IS NOT NULL
  AND colegio_id = (SELECT colegio_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "UTP updates own colegio invitations"
ON public.pending_invitations FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'utp_head'::app_role)
  AND colegio_id = (SELECT colegio_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'utp_head'::app_role)
  AND role IN ('docente'::app_role, 'utp_head'::app_role)
  AND colegio_id = (SELECT colegio_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "UTP deletes own colegio invitations"
ON public.pending_invitations FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'utp_head'::app_role)
  AND colegio_id = (SELECT colegio_id FROM public.profiles WHERE id = auth.uid())
);

-- 2) teacher_assignments: scope staff by colegio
DROP POLICY IF EXISTS "Teacher reads own, staff reads all" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Staff inserts assignments" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Staff updates assignments" ON public.teacher_assignments;
DROP POLICY IF EXISTS "Staff deletes assignments" ON public.teacher_assignments;

CREATE POLICY "Teacher or same-colegio staff reads assignments"
ON public.teacher_assignments FOR SELECT TO authenticated
USING (
  teacher_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'utp_head'::app_role) AND is_same_colegio(auth.uid(), teacher_user_id))
);

CREATE POLICY "Same-colegio staff inserts assignments"
ON public.teacher_assignments FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'utp_head'::app_role) AND is_same_colegio(auth.uid(), teacher_user_id))
);

CREATE POLICY "Same-colegio staff updates assignments"
ON public.teacher_assignments FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'utp_head'::app_role) AND is_same_colegio(auth.uid(), teacher_user_id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'utp_head'::app_role) AND is_same_colegio(auth.uid(), teacher_user_id))
);

CREATE POLICY "Same-colegio staff deletes assignments"
ON public.teacher_assignments FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'utp_head'::app_role) AND is_same_colegio(auth.uid(), teacher_user_id))
);

-- 3) user_usage: scope staff by colegio
DROP POLICY IF EXISTS "Staff reads all usage" ON public.user_usage;
DROP POLICY IF EXISTS "Staff manages usage" ON public.user_usage;

CREATE POLICY "Same-colegio staff reads usage"
ON public.user_usage FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'utp_head'::app_role) AND is_same_colegio(auth.uid(), user_id))
);

CREATE POLICY "Same-colegio staff updates usage"
ON public.user_usage FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'utp_head'::app_role) AND is_same_colegio(auth.uid(), user_id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'utp_head'::app_role) AND is_same_colegio(auth.uid(), user_id))
);

-- 4) hide_question_for_user: always use auth.uid()
CREATE OR REPLACE FUNCTION public.hide_question_for_user(_question_id uuid, _user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.question_bank
  SET hidden_by_users = array_append(hidden_by_users, v_uid)
  WHERE id = _question_id
    AND NOT (v_uid = ANY(hidden_by_users));
  RETURN FOUND;
END;
$function$;

-- 5) institutional_pricing_tiers: restrict to authenticated
DROP POLICY IF EXISTS "read tiers" ON public.institutional_pricing_tiers;
CREATE POLICY "Authenticated can read tiers"
ON public.institutional_pricing_tiers FOR SELECT TO authenticated
USING (true);
