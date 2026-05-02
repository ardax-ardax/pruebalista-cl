-- Add global AI toggle
ALTER TABLE public.global_settings
ADD COLUMN ai_enabled boolean NOT NULL DEFAULT true;

-- Add per-user AI toggle
ALTER TABLE public.user_usage
ADD COLUMN ai_enabled boolean NOT NULL DEFAULT true;

-- Allow authenticated users to read ai_enabled from global_settings
CREATE POLICY "Authenticated can read ai_enabled"
ON public.global_settings
FOR SELECT
TO authenticated
USING (true);