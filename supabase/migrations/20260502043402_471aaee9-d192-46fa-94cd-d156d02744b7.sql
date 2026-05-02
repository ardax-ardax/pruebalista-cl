
ALTER TABLE public.question_bank ADD COLUMN content_hash text;

UPDATE public.question_bank SET content_hash = md5(question_data::text);

ALTER TABLE public.question_bank ALTER COLUMN content_hash SET NOT NULL;

CREATE UNIQUE INDEX uq_question_bank_user_hash ON public.question_bank (user_id, content_hash);
