
-- Tabla banco de preguntas
CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_data jsonb NOT NULL,
  question_type text NOT NULL,
  subject_value text,
  grade_value text,
  oa_code text,
  difficulty text,
  source text NOT NULL DEFAULT 'manual',
  title text,
  prompt_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_qb_user ON public.question_bank (user_id);
CREATE INDEX idx_qb_type ON public.question_bank (question_type);
CREATE INDEX idx_qb_subject_grade ON public.question_bank (subject_value, grade_value);

-- RLS
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

-- Docentes ven sus propias preguntas
CREATE POLICY "Users read own questions"
  ON public.question_bank FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Staff ve todas
CREATE POLICY "Staff reads all questions"
  ON public.question_bank FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

-- Usuarios insertan sus propias preguntas
CREATE POLICY "Users insert own questions"
  ON public.question_bank FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Docentes borran sus propias preguntas, admin borra cualquiera
CREATE POLICY "Users delete own or admin all"
  ON public.question_bank FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
