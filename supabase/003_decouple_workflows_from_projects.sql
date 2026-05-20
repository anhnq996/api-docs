-- 003 - Preserve workflows when source API docs projects are deleted.
-- Workflow steps are copied from a project for autofill only; they should not
-- be lifecycle-linked to that project.

alter table public.api_workflows
drop constraint if exists api_workflows_project_id_fkey;

comment on column public.api_workflows.project_id is
'Optional source project used to list endpoints for workflow step autofill. Not a lifecycle relationship.';
