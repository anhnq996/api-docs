-- Run this in Supabase SQL Editor.
-- The app now uses normal Supabase Auth accounts, project membership, and stored workflow configs.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text,
  avatar_color text not null default 'from-indigo-500 to-fuchsia-500',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table if not exists public.project_members (
  project_id text not null references public.api_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.api_workflows (
  id text primary key,
  project_id text references public.api_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  steps jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  env jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_members (
  workflow_id text not null references public.api_workflows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workflow_id, user_id)
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

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_api_projects_updated_at on public.api_projects;
create trigger set_api_projects_updated_at
before update on public.api_projects
for each row execute function public.set_updated_at();

drop trigger if exists set_api_workflows_updated_at on public.api_workflows;
create trigger set_api_workflows_updated_at
before update on public.api_workflows
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_color)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    ),
    coalesce(nullif(new.raw_user_meta_data->>'avatar_color', ''), 'from-indigo-500 to-fuchsia-500')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = coalesce(nullif(excluded.name, ''), public.profiles.name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_project_owner(p_project_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.api_projects project
    where project.id = p_project_id
      and project.owner_id = p_user_id
  );
$$;

create or replace function public.is_project_member(p_project_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members member
    where member.project_id = p_project_id
      and member.user_id = p_user_id
  );
$$;

create or replace function public.is_workflow_owner(p_workflow_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.api_workflows workflow
    where workflow.id = p_workflow_id
      and workflow.owner_id = p_user_id
  );
$$;

create or replace function public.is_workflow_member(p_workflow_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workflow_members member
    where member.workflow_id = p_workflow_id
      and member.user_id = p_user_id
  );
$$;

alter table public.admin_users enable row level security;
alter table public.profiles enable row level security;
alter table public.api_projects enable row level security;
alter table public.project_members enable row level security;
alter table public.api_workflows enable row level security;
alter table public.workflow_members enable row level security;

drop policy if exists "Admins can read their own admin row" on public.admin_users;
drop policy if exists "Admins can read their own projects" on public.api_projects;
drop policy if exists "Admins can insert their own projects" on public.api_projects;
drop policy if exists "Admins can update their own projects" on public.api_projects;
drop policy if exists "Admins can delete their own projects" on public.api_projects;

create policy "Users can read their own admin row"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Owners and members can read projects" on public.api_projects;
create policy "Owners and members can read projects"
on public.api_projects
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_project_member(id, auth.uid())
);

drop policy if exists "Users can create their own projects" on public.api_projects;
create policy "Users can create their own projects"
on public.api_projects
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Owners can update projects" on public.api_projects;
create policy "Owners can update projects"
on public.api_projects
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Owners can delete projects" on public.api_projects;
create policy "Owners can delete projects"
on public.api_projects
for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "Project users can read members" on public.project_members;
create policy "Project users can read members"
on public.project_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_project_owner(project_id, auth.uid())
  or public.is_project_member(project_id, auth.uid())
);

drop policy if exists "Owners can add project members" on public.project_members;
create policy "Owners can add project members"
on public.project_members
for insert
to authenticated
with check (
  user_id <> auth.uid()
  and public.is_project_owner(project_id, auth.uid())
);

drop policy if exists "Owners can remove project members" on public.project_members;
create policy "Owners can remove project members"
on public.project_members
for delete
to authenticated
using (public.is_project_owner(project_id, auth.uid()));

drop policy if exists "Workflow users can read members" on public.workflow_members;
create policy "Workflow users can read members"
on public.workflow_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_workflow_owner(workflow_id, auth.uid())
  or public.is_workflow_member(workflow_id, auth.uid())
);

drop policy if exists "Owners can add workflow members" on public.workflow_members;
create policy "Owners can add workflow members"
on public.workflow_members
for insert
to authenticated
with check (
  user_id <> auth.uid()
  and public.is_workflow_owner(workflow_id, auth.uid())
);

drop policy if exists "Owners can remove workflow members" on public.workflow_members;
create policy "Owners can remove workflow members"
on public.workflow_members
for delete
to authenticated
using (public.is_workflow_owner(workflow_id, auth.uid()));

drop policy if exists "Project users can read workflows" on public.api_workflows;
drop policy if exists "Workflow users can read workflows" on public.api_workflows;
create policy "Workflow users can read workflows"
on public.api_workflows
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_workflow_member(id, auth.uid())
);

drop policy if exists "Owners can create workflows" on public.api_workflows;
drop policy if exists "Project users can create workflows" on public.api_workflows;
create policy "Project users can create workflows"
on public.api_workflows
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and (
    project_id is null
    or public.is_project_owner(project_id, auth.uid())
    or public.is_project_member(project_id, auth.uid())
  )
);

drop policy if exists "Owners can update workflows" on public.api_workflows;
create policy "Owners can update workflows"
on public.api_workflows
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Owners can delete workflows" on public.api_workflows;
create policy "Owners can delete workflows"
on public.api_workflows
for delete
to authenticated
using (owner_id = auth.uid());

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.api_projects to authenticated;
grant select, insert, update, delete on public.project_members to authenticated;
grant select, insert, update, delete on public.api_workflows to authenticated;
grant select, insert, update, delete on public.workflow_members to authenticated;
