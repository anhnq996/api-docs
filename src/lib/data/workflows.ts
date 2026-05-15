"use client";

import { toError } from "@/lib/errors";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  DEFAULT_WORKFLOW_CONFIG,
  type Workflow,
  type WorkflowGlobalConfig,
  type WorkflowStep,
} from "./workflowData";

type WorkflowRow = {
  id: string;
  project_id: string | null;
  owner_id: string;
  name: string;
  description: string | null;
  steps: WorkflowStep[] | null;
  config: WorkflowGlobalConfig | null;
  env: Record<string, string> | null;
  created_at: string;
  updated_at: string | null;
};

function fromRow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description ?? "",
    steps: Array.isArray(row.steps) ? row.steps : [],
    config: { ...DEFAULT_WORKFLOW_CONFIG, ...(row.config ?? {}) },
    env: row.env ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function toRow(workflow: Workflow, ownerId: string) {
  return {
    id: workflow.id,
    project_id: workflow.projectId ?? null,
    owner_id: workflow.ownerId ?? ownerId,
    name: workflow.name,
    description: workflow.description,
    steps: workflow.steps,
    config: workflow.config,
    env: workflow.env,
    created_at: workflow.createdAt,
    updated_at: workflow.updatedAt,
  };
}

export async function loadWorkflows(): Promise<Workflow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("api_workflows")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw toError(error, "Could not load workflows.");
  return ((data ?? []) as WorkflowRow[]).map(fromRow);
}

export async function upsertWorkflow(workflow: Workflow, ownerId: string) {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("api_workflows")
    .upsert(toRow({ ...workflow, updatedAt: now }, ownerId), { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw toError(error, "Could not save the workflow.");
  return fromRow(data as WorkflowRow);
}

export async function deleteWorkflow(workflowId: string, ownerId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("api_workflows")
    .delete()
    .eq("id", workflowId)
    .eq("owner_id", ownerId);

  if (error) throw toError(error, "Could not delete the workflow.");
}
