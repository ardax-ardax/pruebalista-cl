
CREATE TABLE public.mineduc_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sige_code integer NOT NULL UNIQUE,
  nombre text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.mineduc_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read mineduc_subjects"
  ON public.mineduc_subjects FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin can insert mineduc_subjects"
  ON public.mineduc_subjects FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update mineduc_subjects"
  ON public.mineduc_subjects FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete mineduc_subjects"
  ON public.mineduc_subjects FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mineduc_subjects_nombre ON public.mineduc_subjects USING btree (nombre);
