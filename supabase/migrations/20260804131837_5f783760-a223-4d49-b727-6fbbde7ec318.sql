CREATE TABLE public.assessment_gradings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE CASCADE,
  assessment_title text,
  student_name text,
  student_rut text,
  course_label text,
  total_slots integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  incorrect_count integer NOT NULL DEFAULT 0,
  blank_count integer NOT NULL DEFAULT 0,
  score_percent numeric NOT NULL DEFAULT 0,
  grade numeric NOT NULL DEFAULT 1,
  passing_percent integer NOT NULL DEFAULT 60,
  max_grade numeric NOT NULL DEFAULT 7.0,
  min_grade numeric NOT NULL DEFAULT 1.0,
  scan_confidence numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_gradings_user ON public.assessment_gradings(user_id, created_at DESC);
CREATE INDEX idx_gradings_assessment ON public.assessment_gradings(assessment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_gradings TO authenticated;
GRANT ALL ON public.assessment_gradings TO service_role;
ALTER TABLE public.assessment_gradings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their gradings"
  ON public.assessment_gradings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.assessment_grading_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grading_id uuid NOT NULL REFERENCES public.assessment_gradings(id) ON DELETE CASCADE,
  slot_num integer NOT NULL,
  marked text,
  expected text,
  is_correct boolean NOT NULL DEFAULT false,
  ambiguous boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_grading_answers_grading ON public.assessment_grading_answers(grading_id, slot_num);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_grading_answers TO authenticated;
GRANT ALL ON public.assessment_grading_answers TO service_role;
ALTER TABLE public.assessment_grading_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their grading answers"
  ON public.assessment_grading_answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_gradings g WHERE g.id = grading_id AND g.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assessment_gradings g WHERE g.id = grading_id AND g.user_id = auth.uid()));