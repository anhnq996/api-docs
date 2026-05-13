"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EndpointDetail } from "@/components/EndpointDetail";
import { ExportModal } from "@/components/ExportModal";
import { Sidebar } from "@/components/Sidebar";
import { SourceModal } from "@/components/SourceModal";
import { SpecEditor } from "@/components/SpecEditor";
import { useTheme } from "@/components/ThemeProvider";
import type { ApiSpec } from "@/lib/data/apiSpec";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { loadProjects, upsertProject, type Project } from "@/lib/data/projects";
import { buildOpenApiDocument } from "@/lib/utils/exportUtils";

function ProjectDocsContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const router = useRouter();
  const { theme } = useTheme();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [selectedBaseUrl, setSelectedBaseUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const currentUser = await getAuthUser();
        if (!currentUser) {
          router.replace("/login");
          return;
        }
        const loadedProjects = await loadProjects(currentUser.id);
        if (!active) return;
        setUser(currentUser);
        setProjects(loadedProjects);
        setInitialized(true);
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Could not load projects.");
        setInitialized(true);
      }
    }

    init();
    return () => {
      active = false;
    };
  }, [router]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId]
  );

  const allEndpoints = useMemo(
    () => (activeProject ? activeProject.spec.tags.flatMap((t) => t.endpoints) : []),
    [activeProject]
  );

  const baseUrls = useMemo(() => {
    if (!activeProject) return [];
    const urls =
      activeProject.spec.info.servers?.map((server) => server.url).filter(Boolean) ?? [];
    return urls.length ? urls : [activeProject.spec.info.baseUrl].filter(Boolean);
  }, [activeProject]);

  useEffect(() => {
    if (initialized && (!projectId || !activeProject)) {
      router.replace("/");
    }
  }, [initialized, projectId, projects.length, activeProject, router]);

  useEffect(() => {
    if (allEndpoints.length && !allEndpoints.find((e) => e.id === activeId)) {
      setActiveId(allEndpoints[0].id);
    }
  }, [allEndpoints, activeId]);

  const activeBaseUrl =
    selectedBaseUrl && baseUrls.includes(selectedBaseUrl)
      ? selectedBaseUrl
      : baseUrls[0] ?? activeProject?.spec.info.baseUrl ?? "";

  if (!activeProject) {
    return error ? (
      <div className="min-h-screen bg-background p-6 text-destructive">{error}</div>
    ) : null;
  }
  const active = allEndpoints.find((e) => e.id === activeId) ?? allEndpoints[0];
  const updateProjectSpec = async (
    spec: ApiSpec,
    sourceName: string,
    rawText?: string,
    rawFormat?: "json" | "yaml",
    preserveRaw = true
  ) => {
    if (!user) throw new Error("Missing authenticated user.");
    const updated: Project = {
      ...activeProject,
      spec,
      sourceName,
      rawText: rawText ?? (preserveRaw ? activeProject.rawText : undefined),
      rawFormat: rawFormat ?? (preserveRaw ? activeProject.rawFormat : undefined),
    };
    await upsertProject(updated, user.id);
    setProjects((list) => list.map((p) => (p.id === activeProject.id ? updated : p)));
  };
  const editorInitialFormat: "json" | "yaml" = activeProject.rawFormat ?? "json";
  const editorInitialText =
    activeProject.rawText ??
    JSON.stringify(buildOpenApiDocument(activeProject.spec, activeProject.name), null, 2);

  return (
    <div className="size-full min-h-screen flex bg-background text-foreground">
      <Sidebar
        spec={activeProject.spec}
        projectName={activeProject.name}
        activeId={active?.id ?? ""}
        onSelect={setActiveId}
        query={query}
        onQueryChange={setQuery}
        onExport={() => setShowExport(true)}
        onOpenSource={() => setShowSource(true)}
        onToggleEditor={() => setShowEditor((open) => !open)}
        editorOpen={showEditor}
        onBackToProjects={() => router.push("/")}
        selectedBaseUrl={activeBaseUrl}
        onBaseUrlChange={setSelectedBaseUrl}
      />
      <main className="flex-1 overflow-y-auto">
        {active ? (
          <EndpointDetail
            key={active.id}
            endpoint={active}
            spec={activeProject.spec}
            baseUrl={activeBaseUrl}
            projectName={activeProject.name}
            runnerStorageScope={activeProject.id}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            The OpenAPI source loaded, but no valid endpoints were found to display.
          </div>
        )}
      </main>
      {showExport && (
        <ExportModal
          spec={activeProject.spec}
          projectName={activeProject.name}
          baseUrl={activeBaseUrl}
          theme={theme}
          onClose={() => setShowExport(false)}
        />
      )}
      {showEditor && (
        <SpecEditor
          key={activeProject.id}
          initialText={editorInitialText}
          initialFormat={editorInitialFormat}
          onClose={() => setShowEditor(false)}
          onChange={(newSpec, rawText, rawFormat) =>
            updateProjectSpec(newSpec, activeProject.sourceName, rawText, rawFormat)
          }
        />
      )}
      {showSource && (
        <SourceModal
          currentSourceName={activeProject.sourceName}
          onClose={() => setShowSource(false)}
          onLoad={(newSpec, sourceName, rawText, rawFormat) =>
            updateProjectSpec(newSpec, sourceName, rawText, rawFormat, false)
          }
        />
      )}
    </div>
  );
}

export default function ProjectDocsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectDocsContent />
    </Suspense>
  );
}
