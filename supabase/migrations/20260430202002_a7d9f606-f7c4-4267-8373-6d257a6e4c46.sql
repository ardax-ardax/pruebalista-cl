ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS institution_name text NOT NULL DEFAULT 'New Little College La Florida',
  ADD COLUMN IF NOT EXISTS institution_logo text;