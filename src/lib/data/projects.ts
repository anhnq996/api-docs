import type { ApiSpec } from "./apiSpec";
import { spec as sampleSpec } from "./apiSpec";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface Project {
  id: string;
  name: string;
  description: string;
  spec: ApiSpec;
  sourceName: string;
  createdAt: string;
  color: string;
  rawText?: string;
  rawFormat?: "json" | "yaml";
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

function fromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    spec: row.spec,
    sourceName: row.source_name,
    createdAt: row.created_at,
    color: row.color,
    rawText: row.raw_text ?? undefined,
    rawFormat: row.raw_format ?? undefined,
  };
}

function toRow(project: Project, ownerId: string) {
  return {
    id: project.id,
    owner_id: ownerId,
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

export async function loadProjects(ownerId: string): Promise<Project[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("api_projects")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as ProjectRow[]).map(fromRow);
}

export async function upsertProject(project: Project, ownerId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("api_projects")
    .upsert(toRow(project, ownerId), { onConflict: "id" });

  if (error) throw error;
}

export async function deleteProject(projectId: string, ownerId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("api_projects")
    .delete()
    .eq("id", projectId)
    .eq("owner_id", ownerId);

  if (error) throw error;
}
