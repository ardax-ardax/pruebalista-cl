ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS show_institutional_landing boolean NOT NULL DEFAULT true;

GRANT SELECT (id, show_institutional_landing) ON public.global_settings TO anon;

DROP POLICY IF EXISTS "Public can read landing flags" ON public.global_settings;
CREATE POLICY "Public can read landing flags"
ON public.global_settings
FOR SELECT
TO anon
USING (true);