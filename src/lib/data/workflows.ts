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

type WorkflowMemberRow = {
  workflow_id: string;
  user_id: string;
};

const DEFAULT_STEP_EXECUTION = {
  iterations: 1,
  rampUpDuration: 0,
  delay: 500,
  timeout: 30000,
  retryCount: 0,
};

function normalizeStep(step: WorkflowStep): WorkflowStep {
  return {
    ...step,
    execution: { ...DEFAULT_STEP_EXECUTION, ...(step.execution ?? {}) },
  };
}

function fromRow(row: WorkflowRow, memberIds: string[] = []): Workflow {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    memberIds,
    name: row.name,
    description: row.description ?? "",
    steps: Array.isArray(row.steps) ? row.steps.map(normalizeStep) : [],
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
  const rows = (data ?? []) as WorkflowRow[];
  if (!rows.length) return [];

  const { data: memberRows, error: memberError } = await supabase
    .from("workflow_members")
    .select("workflow_id,user_id")
    .in(
      "workflow_id",
      rows.map((row) => row.id)
    );

  if (memberError) throw toError(memberError, "Could not load workflow members.");
  const membersByWorkflow = new Map<string, string[]>();
  ((memberRows ?? []) as WorkflowMemberRow[]).forEach((row) => {
    const ids = membersByWorkflow.get(row.workflow_id) ?? [];
    ids.push(row.user_id);
    membersByWorkflow.set(row.workflow_id, ids);
  });

  return rows.map((row) => fromRow(row, membersByWorkflow.get(row.id) ?? []));
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
  return fromRow(data as WorkflowRow, workflow.memberIds ?? []);
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

export async function updateWorkflowMembers(workflowId: string, memberIds: string[]) {
  const supabase = getSupabaseClient();
  const normalizedIds = Array.from(new Set(memberIds.filter(Boolean)));
  const { error: deleteError } = await supabase
    .from("workflow_members")
    .delete()
    .eq("workflow_id", workflowId);

  if (deleteError) throw toError(deleteError, "Could not update workflow members.");
  if (!normalizedIds.length) return;

  const { error: insertError } = await supabase.from("workflow_members").insert(
    normalizedIds.map((userId) => ({
      workflow_id: workflowId,
      user_id: userId,
    }))
  );

  if (insertError) throw toError(insertError, "Could not update workflow members.");
}
