import type { ApiSpec } from "./apiSpec";
import { spec as sampleSpec } from "./apiSpec";
import { toError } from "@/lib/errors";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface Project {
  id: string;
  ownerId?: string;
  name: string;
  description: string;
  spec: ApiSpec;
  sourceName: string;
  createdAt: string;
  updatedAt?: string;
  color: string;
  rawText?: string;
  rawFormat?: "json" | "yaml";
  memberIds?: string[];
}

type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  spec: ApiSpec;
  source_name: string;
  raw_text: string | null;
  raw_format: "json" | "yaml" | null;
  color: string;
  created_at: string;
  updated_at: string | null;
};

type ProjectMemberRow = {
  project_id: string;
  user_id: string;
};

const COLORS = [
  "from-indigo-500 to-fuchsia-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-sky-500 to-blue-500",
  "from-violet-500 to-purple-500",
];

export function randomColor(i = Math.floor(Math.random() * COLORS.length)) {
  return COLORS[i % COLORS.length];
}

function fromRow(row: ProjectRow, memberIds: string[] = []): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description ?? "",
    spec: row.spec,
    sourceName: row.source_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    color: row.color,
    rawText: row.raw_text ?? undefined,
    rawFormat: row.raw_format ?? undefined,
    memberIds,
  };
}

function toRow(project: Project, ownerId: string) {
  return {
    id: project.id,
    owner_id: project.ownerId ?? ownerId,
    name: project.name,
    description: project.description,
    spec: project.spec,
    source_name: project.sourceName,
    raw_text: project.rawText ?? null,
    raw_format: project.rawFormat ?? null,
    color: project.color,
    created_at: project.createdAt,
  };
}

export function sampleProject(): Project {
  return {
    id: "sample-nebula",
    name: sampleSpec.info.title,
    description: sampleSpec.info.description,
    spec: sampleSpec,
    sourceName: "Built-in sample",
    createdAt: new Date().toISOString(),
    color: COLORS[0],
  };
}

export async function loadProjects(_currentUserId: string): Promise<Project[]> {
  void _currentUserId;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("api_projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw toError(error, "Could not load projects.");
  const rows = (data ?? []) as ProjectRow[];
  if (!rows.length) return [];

  const { data: memberRows, error: memberError } = await supabase
    .from("project_members")
    .select("project_id,user_id")
    .in(
      "project_id",
      rows.map((row) => row.id)
    );

  if (memberError) throw toError(memberError, "Could not load project members.");
  const membersByProject = new Map<string, string[]>();
  ((memberRows ?? []) as ProjectMemberRow[]).forEach((row) => {
    const ids = membersByProject.get(row.project_id) ?? [];
    ids.push(row.user_id);
    membersByProject.set(row.project_id, ids);
  });

  return rows.map((row) => fromRow(row, membersByProject.get(row.id) ?? []));
}

export async function upsertProject(project: Project, ownerId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("api_projects")
    .upsert(toRow(project, ownerId), { onConflict: "id" });

  if (error) throw toError(error, "Could not save the project.");
}

export async function deleteProject(projectId: string, ownerId: string) {
  const supabase = getSupabaseClient();
  const { error: detachError } = await supabase
    .from("api_workflows")
    .update({ project_id: null })
    .eq("project_id", projectId)
    .eq("owner_id", ownerId);

  if (detachError) throw toError(detachError, "Could not detach workflows from the project.");

  const { error } = await supabase
    .from("api_projects")
    .delete()
    .eq("id", projectId)
    .eq("owner_id", ownerId);

  if (error) throw toError(error, "Could not delete the project.");
}

export async function updateProjectMembers(projectId: string, memberIds: string[]) {
  const supabase = getSupabaseClient();
  const normalizedIds = Array.from(new Set(memberIds.filter(Boolean)));
  const { error: deleteError } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId);

  if (deleteError) throw toError(deleteError, "Could not update project members.");
  if (!normalizedIds.length) return;

  const { error: insertError } = await supabase.from("project_members").insert(
    normalizedIds.map((userId) => ({
      project_id: projectId,
      user_id: userId,
    }))
  );

  if (insertError) throw toError(insertError, "Could not update project members.");
}
