DELETE FROM public.support_tickets t
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = t.user_id);

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;