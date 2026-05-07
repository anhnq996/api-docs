"use client";

import { useEffect, useState } from "react";
import {
  FileJson,
  FolderOpen,
  LogOut,
  Moon,
  Plus,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SourceModal } from "@/components/SourceModal";
import { useTheme } from "@/components/ThemeProvider";
import { getAuthUser, logout, type AuthUser } from "@/lib/auth";
import type { ApiSpec } from "@/lib/data/apiSpec";
import type { Project } from "@/lib/data/projects";
import { loadProjects, randomColor, saveProjects } from "@/lib/data/projects";

type CreateStep = "idle" | "meta" | "source";

export default function HomePage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState<CreateStep>("idle");
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  useEffect(() => {
    try {
      const currentUser = getAuthUser();
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setUser(currentUser);
      setProjects(loadProjects());
    } catch {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (user) saveProjects(projects);
  }, [projects, user]);

  if (!user) return null;

  const resetCreate = () => {
    setStep("idle");
    setDraft({ name: "", description: "" });
  };

  const handleSourceLoaded = (spec: ApiSpec, sourceName: string) => {
    const project: Project = {
      id: `proj-${Date.now()}`,
      name: draft.name.trim() || spec.info.title,
      description: draft.description.trim() || spec.info.description,
      spec,
      sourceName,
      createdAt: new Date().toISOString(),
      color: randomColor(),
    };
    setProjects((list) => {
      const next = [...list, project];
      saveProjects(next);
      return next;
    });
    resetCreate();
    router.push(`/projects?projectId=${project.id}`);
  };

  const confirmDeleteProject = () => {
    if (!projectToDelete) return;
    setProjects((list) => list.filter((item) => item.id !== projectToDelete.id));
    setProjectToDelete(null);
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white">
              <Zap className="size-4" />
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>API Docs</div>
              <div className="text-xs text-muted-foreground">Quản lý dự án</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground mr-2">
              <div className="size-7 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span>{user.name}</span>
            </div>
            <button
              onClick={toggleTheme}
              className="size-9 rounded-md border border-border hover:bg-accent flex items-center justify-center"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="h-9 px-3 rounded-md border border-border hover:bg-accent flex items-center gap-1.5 text-sm"
            >
              <LogOut className="size-4" /> Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl" style={{ fontWeight: 600 }}>
              Dự án của bạn
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Chọn một dự án để xem tài liệu API, hoặc tạo dự án mới.
            </p>
          </div>
          <button
            onClick={() => setStep("meta")}
            className="h-10 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-2 text-sm"
          >
            <Plus className="size-4" /> Tạo dự án
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <FolderOpen className="size-10 mx-auto mb-3 text-muted-foreground" />
            <div className="mb-1">Chưa có dự án nào</div>
            <div className="text-sm text-muted-foreground mb-4">
              Tạo dự án đầu tiên bằng cách upload file OpenAPI hoặc nhập URL.
            </div>
            <button
              onClick={() => setStep("meta")}
              className="h-10 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-2 text-sm"
            >
              <Plus className="size-4" /> Tạo dự án
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const endpointCount = p.spec.tags.reduce(
                (a, t) => a + t.endpoints.length,
                0
              );
              return (
                <div
                  key={p.id}
                  className="group relative rounded-xl border border-border bg-card text-card-foreground p-5 hover:border-ring transition-all hover:shadow-lg cursor-pointer"
                  onClick={() => router.push(`/projects?projectId=${p.id}`)}
                >
                  <div
                    className={`size-10 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center text-white mb-3`}
                  >
                    <FileJson className="size-5" />
                  </div>
                  <div className="truncate" style={{ fontWeight: 600 }}>
                    {p.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    v{p.spec.info.version}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2 min-h-10">
                    {p.description || "Không có mô tả."}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{endpointCount} endpoints</span>
                    <span>{p.spec.tags.length} groups</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectToDelete(p);
                    }}
                    className="absolute top-3 right-3 size-8 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-opacity"
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {step === "meta" && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={resetCreate}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4" style={{ fontWeight: 600 }}>
              Tạo dự án mới
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Tên dự án
                </label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="(Tuỳ chọn — lấy từ spec nếu để trống)"
                  className="w-full px-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Mô tả
                </label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={resetCreate}
                className="flex-1 h-10 rounded-md border border-border hover:bg-accent text-sm"
              >
                Huỷ
              </button>
              <button
                onClick={() => setStep("source")}
                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-sm"
              >
                Tiếp tục: chọn nguồn
              </button>
            </div>
          </div>
        </div>
      )}

      {projectToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setProjectToDelete(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0">
                  <Trash2 className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-base" style={{ fontWeight: 700 }}>
                    Xóa dự án?
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Dự án này sẽ bị xóa khỏi danh sách trên trình duyệt hiện tại.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="truncate text-sm" style={{ fontWeight: 600 }}>
                  {projectToDelete.name}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>v{projectToDelete.spec.info.version}</span>
                  <span>
                    {projectToDelete.spec.tags.reduce(
                      (total, tag) => total + tag.endpoints.length,
                      0
                    )}{" "}
                    endpoints
                  </span>
                  <span>{projectToDelete.spec.tags.length} groups</span>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setProjectToDelete(null)}
                  className="flex-1 h-10 rounded-md border border-border hover:bg-accent text-sm"
                >
                  Huỷ
                </button>
                <button
                  onClick={confirmDeleteProject}
                  className="flex-1 h-10 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 className="size-4" />
                  Xóa dự án
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "source" && <SourceModal onClose={resetCreate} onLoad={handleSourceLoaded} />}
    </div>
  );
}
