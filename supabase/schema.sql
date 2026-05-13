-- Run this in Supabase SQL Editor after creating the first admin user in Supabase Auth.
-- Replace the admin UUID/email in the final INSERT with your Supabase Auth user.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.api_projects (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  spec jsonb not null,
  source_name text not null,
  raw_text text,
  raw_format text check (raw_format in ('json', 'yaml')),
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_api_projects_updated_at on public.api_projects;
create trigger set_api_projects_updated_at
before update on public.api_projects
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.api_projects enable row level security;

drop policy if exists "Admins can read their own admin row" on public.admin_users;
create policy "Admins can read their own admin row"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read their own projects" on public.api_projects;
create policy "Admins can read their own projects"
on public.api_projects
for select
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.admin_users admin
    where admin.user_id = auth.uid()
  )
);

drop policy if exists "Admins can insert their own projects" on public.api_projects;
create policy "Admins can insert their own projects"
on public.api_projects
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.admin_users admin
    where admin.user_id = auth.uid()
  )
);

drop policy if exists "Admins can update their own projects" on public.api_projects;
create policy "Admins can update their own projects"
on public.api_projects
for update
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.admin_users admin
    where admin.user_id = auth.uid()
  )
)
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.admin_users admin
    where admin.user_id = auth.uid()
  )
);

drop policy if exists "Admins can delete their own projects" on public.api_projects;
create policy "Admins can delete their own projects"
on public.api_projects
for delete
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.admin_users admin
    where admin.user_id = auth.uid()
  )
);

-- After creating the admin account in Authentication > Users, copy its UUID here.
-- insert into public.admin_users (user_id, email, name)
-- values ('00000000-0000-0000-0000-000000000000', 'admin@example.com', 'Admin');
