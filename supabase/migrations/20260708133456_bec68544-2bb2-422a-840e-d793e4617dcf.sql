ALTER TABLE public.curriculum_base
  ADD COLUMN IF NOT EXISTS curriculum_decree text,
  ADD COLUMN IF NOT EXISTS curriculum_period text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz NOT NULL DEFAULT now();