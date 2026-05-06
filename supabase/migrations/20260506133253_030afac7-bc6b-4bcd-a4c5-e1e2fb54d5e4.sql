
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS secondary_email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS document_id text;
