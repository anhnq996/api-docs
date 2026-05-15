"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  Moon,
  Search,
  Settings,
  Sun,
  Zap,
} from "lucide-react";
import type { ApiSpec } from "@/lib/data/apiSpec";
import { MethodBadge } from "./MethodBadge";
import { useTheme } from "./ThemeProvider";

interface Props {
  spec: ApiSpec;
  activeId: string;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (v: string) => void;
  onExport: () => void;
  onOpenSource?: () => void;
  onToggleEditor?: () => void;
  editorOpen?: boolean;
  onBackToProjects?: () => void;
  selectedBaseUrl?: string;
  onBaseUrlChange?: (url: string) => void;
  projectName?: string;
}

export function Sidebar({
  spec,
  activeId,
  onSelect,
  query,
  onQueryChange,
  onExport,
  onOpenSource,
  onToggleEditor,
  editorOpen = false,
  onBackToProjects,
  selectedBaseUrl,
  onBaseUrlChange,
  projectName,
}: Props) {
  const { theme, toggleTheme } = useTheme();
  const q = query.trim().toLowerCase();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean | undefined>>({});
  const servers =
    spec.info.servers && spec.info.servers.length
      ? spec.info.servers
      : [{ url: spec.info.baseUrl }];
  const activeBaseUrl = selectedBaseUrl ?? spec.info.baseUrl;

  const toggle = (name: string, currentIsOpen: boolean) => {
    setOpenGroups((s) => ({ ...s, [name]: !currentIsOpen }));
  };

  return (
    <aside className="w-[300px] shrink-0 h-full border-r border-border bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="px-4 py-4 border-b border-sidebar-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {onBackToProjects ? (
            <button
              onClick={onBackToProjects}
              className="size-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white flex-shrink-0 hover:opacity-90"
              aria-label="Back to projects"
              title="Back to projects"
            >
              <ArrowLeft className="size-4" />
            </button>
          ) : (
            <div className="size-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white flex-shrink-0">
              <Zap className="size-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate" style={{ fontWeight: 600 }}>
              {projectName ?? spec.info.title}
            </div>
            <div className="text-xs text-muted-foreground">v{spec.info.version}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={toggleTheme}
            className="size-8 rounded-md border border-border hover:bg-accent transition-colors flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button
            onClick={onExport}
            className="size-8 rounded-md border border-border hover:bg-accent transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Export"
          >
            <Download className="size-4" />
          </button>
          {onToggleEditor && (
            <button
              onClick={onToggleEditor}
              className={`size-8 rounded-md border transition-colors flex items-center justify-center ${
                editorOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Edit OpenAPI"
              title="View and edit OpenAPI"
            >
              <Code2 className="size-4" />
            </button>
          )}
          {onOpenSource && (
            <button
              onClick={onOpenSource}
              className="size-8 rounded-md border border-border hover:bg-accent transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Source"
            >
              <Settings className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search endpoints..."
            className="w-full pl-9 pr-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {spec.tags.map((tag) => {
          const endpoints = tag.endpoints.filter(
            (e) =>
              !q ||
              e.path.toLowerCase().includes(q) ||
              e.summary.toLowerCase().includes(q) ||
              tag.name.toLowerCase().includes(q)
          );
          if (endpoints.length === 0) return null;
          const containsActive = endpoints.some((ep) => ep.id === activeId);
          const userChoice = openGroups[tag.name];
          const isOpen: boolean = q
            ? true
            : userChoice !== undefined
              ? userChoice
              : containsActive;

          return (
            <div key={tag.name} className="mb-2">
              <button
                onClick={() => toggle(tag.name, isOpen)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent/60 transition-colors"
              >
                <ChevronRight
                  className={`size-3.5 transition-transform duration-200 ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
                <span className="flex-1 text-left">{tag.name}</span>
                <span className="text-[10px] font-mono">{endpoints.length}</span>
              </button>

              {isOpen && (
                <ul className="mt-1">
                  {endpoints.map((ep) => (
                    <li key={ep.id}>
                      <button
                        onClick={() => onSelect(ep.id)}
                        className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 transition-colors ${
                          activeId === ep.id
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "hover:bg-sidebar-accent/60"
                        }`}
                      >
                        <MethodBadge method={ep.method} compact />
                        <span className="truncate text-sm font-mono">{ep.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground mb-2">Base URL</div>
        {servers.length > 1 ? (
          <div className="relative">
            <select
              value={activeBaseUrl}
              onChange={(e) => onBaseUrlChange?.(e.target.value)}
              className="w-full appearance-none rounded-md border border-border bg-input-background py-1.5 pl-2 pr-10 text-xs font-mono text-primary focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Base URL"
            >
              {servers.map((server) => (
                <option key={server.url} value={server.url}>
                  {server.description ? `${server.description} - ${server.url}` : server.url}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-px right-px flex w-8 items-center justify-center rounded-r-[5px] border-l border-border bg-input-background text-muted-foreground">
              <ChevronDown className="size-3.5" />
            </span>
          </div>
        ) : (
          <code className="text-xs text-primary font-mono bg-muted/50 px-2 py-1 rounded block truncate">
            {activeBaseUrl}
          </code>
        )}
      </div>
    </aside>
  );
}
