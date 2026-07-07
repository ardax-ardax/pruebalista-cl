
-- 1. Migrate any users in basic/medium to free (defensive; currently none)
UPDATE public.user_usage SET plan_type = 'free' WHERE plan_type IN ('basic','medium');

-- 2. Delete basic/medium plans
DELETE FROM public.plan_allowed_courses WHERE plan_id IN ('basic','medium');
DELETE FROM public.plans WHERE id IN ('basic','medium');

-- 3. Add price columns
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS price_clp_monthly integer,
  ADD COLUMN IF NOT EXISTS price_clp_yearly integer;

-- 4. Update flags & pricing
UPDATE public.plans SET
  can_use_answer_key = true,
  can_use_omr = false,
  can_export_docx = false,
  show_watermark = true,
  max_assessments = 10,
  default_credits = 20,
  price_clp_monthly = 0,
  price_clp_yearly = 0
WHERE id = 'free';

UPDATE public.plans SET
  can_use_answer_key = true,
  can_use_omr = true,
  can_export_docx = true,
  show_watermark = false,
  max_assessments = 100,
  default_credits = 200,
  can_edit_layout = true,
  price_clp_monthly = 7990,
  price_clp_yearly = 59990,
  sort_order = 1
WHERE id = 'pro';

UPDATE public.plans SET
  can_use_answer_key = true,
  can_use_omr = true,
  can_export_docx = true,
  show_watermark = false,
  max_assessments = NULL,
  can_edit_layout = true,
  allowed_templates = NULL,
  price_clp_monthly = NULL,
  price_clp_yearly = NULL,
  sort_order = 2
WHERE id = 'institucional';

-- 5. Institutional pricing tiers
CREATE TABLE IF NOT EXISTS public.institutional_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_teachers integer NOT NULL,
  max_teachers integer,
  price_per_teacher_clp_monthly integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.institutional_pricing_tiers TO authenticated, anon;
GRANT ALL ON public.institutional_pricing_tiers TO service_role;
ALTER TABLE public.institutional_pricing_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read tiers" ON public.institutional_pricing_tiers FOR SELECT USING (true);
CREATE POLICY "admin manage tiers" ON public.institutional_pricing_tiers FOR ALL
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

INSERT INTO public.institutional_pricing_tiers (min_teachers, max_teachers, price_per_teacher_clp_monthly)
VALUES (1,10,4990),(11,30,3990),(31,NULL,2990)
ON CONFLICT DO NOTHING;

-- 6. Colegios: seats + expiration
ALTER TABLE public.colegios
  ADD COLUMN IF NOT EXISTS seats_purchased integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_billing_cycle text;

-- 7. Flow payment orders
CREATE TABLE IF NOT EXISTS public.flow_payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','yearly')),
  amount_clp integer NOT NULL,
  seats integer,
  colegio_id uuid REFERENCES public.colegios(id) ON DELETE SET NULL,
  commerce_order text NOT NULL UNIQUE,
  flow_token text,
  flow_order text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected','cancelled')),
  flow_env text NOT NULL DEFAULT 'sandbox',
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.flow_payment_orders TO authenticated;
GRANT ALL ON public.flow_payment_orders TO service_role;
ALTER TABLE public.flow_payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders read" ON public.flow_payment_orders FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "admin all orders" ON public.flow_payment_orders FOR ALL
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_flow_orders_user ON public.flow_payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_orders_token ON public.flow_payment_orders(flow_token);

CREATE TRIGGER trg_flow_orders_updated BEFORE UPDATE ON public.flow_payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pricing_tiers_updated BEFORE UPDATE ON public.institutional_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
