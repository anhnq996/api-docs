"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EndpointDetail } from "@/components/EndpointDetail";
import { ExportModal } from "@/components/ExportModal";
import { Sidebar } from "@/components/Sidebar";
import { SourceModal } from "@/components/SourceModal";
import { useTheme } from "@/components/ThemeProvider";
import { isAuthenticated } from "@/lib/auth";
import { loadProjects, saveProjects, type Project } from "@/lib/data/projects";

function ProjectDocsContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const router = useRouter();
  const { theme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [selectedBaseUrl, setSelectedBaseUrl] = useState("");

  useEffect(() => {
    try {
      if (!isAuthenticated()) {
        router.replace("/login");
        return;
      }
      setProjects(loadProjects());
      setInitialized(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!initialized) return;
    if (projects.length === 0) return;
    saveProjects(projects);
  }, [projects, initialized]);

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
    if (initialized && (!projectId || (projects.length > 0 && !activeProject))) {
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

  if (!activeProject) return null;
  const active = allEndpoints.find((e) => e.id === activeId) ?? allEndpoints[0];

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
            OpenAPI đã tải nhưng chưa tìm thấy endpoint hợp lệ để hiển thị.
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
      {showSource && (
        <SourceModal
          currentSourceName={activeProject.sourceName}
          onClose={() => setShowSource(false)}
          onLoad={(newSpec, sourceName) => {
            setProjects((list) =>
              list.map((p) =>
                p.id === activeProject.id ? { ...p, spec: newSpec, sourceName } : p
              )
            );
          }}
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
