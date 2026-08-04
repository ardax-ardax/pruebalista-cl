-- assessments: conservar la prueba cuando se elimina el usuario
ALTER TABLE public.assessments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_user_id_fkey;
ALTER TABLE public.assessments
  ADD CONSTRAINT assessments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- question_bank: misma política (no tenía FK)
ALTER TABLE public.question_bank ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.question_bank DROP CONSTRAINT IF EXISTS question_bank_user_id_fkey;
ALTER TABLE public.question_bank
  ADD CONSTRAINT question_bank_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;