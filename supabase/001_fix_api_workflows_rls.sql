-- 001 - Fix RLS for creating workflow rows.
-- Run after schema.sql.
-- Copy and run this whole file in Supabase SQL Editor.

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

alter table public.api_workflows enable row level security;

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

grant select, insert, update, delete on public.api_workflows to authenticated;
