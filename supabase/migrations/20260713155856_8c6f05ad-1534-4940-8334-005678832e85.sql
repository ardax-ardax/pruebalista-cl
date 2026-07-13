
-- Restrict policies to authenticated role (defense-in-depth)

-- flow_payment_orders
DROP POLICY IF EXISTS "own orders read" ON public.flow_payment_orders;
DROP POLICY IF EXISTS "admin all orders" ON public.flow_payment_orders;

CREATE POLICY "own orders read" ON public.flow_payment_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin all orders" ON public.flow_payment_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- profiles select
DROP POLICY IF EXISTS "Users can view own profile or same-colegio staff" ON public.profiles;
CREATE POLICY "Users can view own profile or same-colegio staff" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_same_colegio(auth.uid(), id)
  );
