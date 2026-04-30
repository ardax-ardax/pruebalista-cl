create table public.curriculum_base (
  id uuid primary key default gen_random_uuid(),
  grade_value text not null,
  subject_value text not null,
  oa_code text not null,
  oa_description text not null,
  eje text,
  indicators jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (grade_value, subject_value, oa_code)
);

alter table public.curriculum_base enable row level security;

create policy "Authenticated can read curriculum"
  on public.curriculum_base for select
  to authenticated using (true);

create policy "Admins can insert curriculum"
  on public.curriculum_base for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update curriculum"
  on public.curriculum_base for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete curriculum"
  on public.curriculum_base for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger curriculum_base_set_updated_at
  before update on public.curriculum_base
  for each row execute function public.set_updated_at();

create index curriculum_base_grade_subject_idx
  on public.curriculum_base (grade_value, subject_value);