GRANT SELECT ON public.plans TO anon;
CREATE POLICY "Anyone can read plans" ON public.plans FOR SELECT TO anon USING (true);