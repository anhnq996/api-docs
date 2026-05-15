-- Add per-workflow members and RLS policies.
-- Copy and run this whole file in Supabase SQL Editor.

create table if not exists public.workflow_members (
  workflow_id text not null references public.api_workflows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workflow_id, user_id)
);

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

alter table public.workflow_members enable row level security;
alter table public.api_workflows enable row level security;

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

grant select, insert, update, delete on public.workflow_members to authenticated;
grant select, insert, update, delete on public.api_workflows to authenticated;
