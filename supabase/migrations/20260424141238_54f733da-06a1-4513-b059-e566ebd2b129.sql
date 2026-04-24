
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users can view their own roles"
on public.user_roles for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles"
on public.user_roles for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- Assessments
create table public.assessments (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default '',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assessments_user_id_idx on public.assessments(user_id);
create index assessments_updated_at_idx on public.assessments(updated_at desc);

alter table public.assessments enable row level security;

create policy "Users can view own or admin all"
on public.assessments for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Users can insert own"
on public.assessments for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own or admin all"
on public.assessments for update
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Users can delete own or admin all"
on public.assessments for delete
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assessments_set_updated_at
before update on public.assessments
for each row execute function public.set_updated_at();

-- Auto-asignar admin a admin@cnlc.cl en cada signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email = 'admin@cnlc.cl' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  else
    insert into public.user_roles (user_id, role)
    values (new.id, 'user')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Si el admin ya existiera, asignarle el rol
insert into public.user_roles (user_id, role)
select id, 'admin'::app_role from auth.users where email = 'admin@cnlc.cl'
on conflict (user_id, role) do nothing;
