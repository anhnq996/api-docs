"use client";

import type { InputHTMLAttributes } from "react";
import { useRef, useState } from "react";
import yaml from "js-yaml";
import {
  AlertCircle,
  CheckCircle2,
  FileJson,
  FolderOpen,
  Link as LinkIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import type { ApiSpec, Endpoint, Tag } from "@/lib/data/apiSpec";
import { convertOpenApi } from "@/lib/utils/openapiConverter";

interface Props {
  onClose: () => void;
  onLoad: (spec: ApiSpec, sourceName: string) => void;
  currentSourceName?: string;
}

type SourceTab = "file" | "folder" | "url";
type FolderFileStatus = {
  name: string;
  path: string;
  size: number;
  status: "pending" | "loaded" | "skipped" | "error";
  message?: string;
};

const OPENAPI_EXTENSIONS = [".json", ".yaml", ".yml"];

const folderInputProps = {
  webkitdirectory: "",
  directory: "",
} as InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory: string;
  directory: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isOpenApiFile(file: File) {
  const name = file.name.toLowerCase();
  return OPENAPI_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function getDisplayPath(file: File) {
  return file.webkitRelativePath || file.name;
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function parseSpecText(text: string, filename = ""): ApiSpec {
  const trimmed = text.trim();
  let doc: unknown;
  if (trimmed.startsWith("{") || filename.endsWith(".json")) {
    doc = JSON.parse(trimmed);
  } else {
    doc = yaml.load(trimmed);
  }
  if (!doc || typeof doc !== "object") throw new Error("File không hợp lệ");
  return convertOpenApi(doc);
}

function uniqueEndpointId(endpoint: Endpoint, usedIds: Set<string>, sourceIndex: number) {
  if (!usedIds.has(endpoint.id)) return endpoint.id;
  const base = endpoint.id || `${endpoint.method.toLowerCase()}-${endpoint.path}`;
  let next = `${base}-${sourceIndex + 1}`;
  let count = 2;
  while (usedIds.has(next)) {
    next = `${base}-${sourceIndex + 1}-${count}`;
    count += 1;
  }
  return next;
}

function mergeApiSpecs(items: { spec: ApiSpec; sourceName: string }[]): ApiSpec {
  const [first] = items;
  const tagMap = new Map<string, Tag>();
  const usedIds = new Set<string>();
  const serverMap = new Map<string, { url: string; description?: string }>();

  items.forEach(({ spec }, sourceIndex) => {
    spec.info.servers?.forEach((server) => {
      if (server.url && !serverMap.has(server.url)) {
        serverMap.set(server.url, server);
      }
    });
    if (spec.info.baseUrl && !serverMap.has(spec.info.baseUrl)) {
      serverMap.set(spec.info.baseUrl, { url: spec.info.baseUrl });
    }

    spec.tags.forEach((tag) => {
      const current =
        tagMap.get(tag.name) ||
        ({
          name: tag.name,
          description: tag.description,
          endpoints: [],
        } satisfies Tag);

      tag.endpoints.forEach((endpoint) => {
        const id = uniqueEndpointId(endpoint, usedIds, sourceIndex);
        usedIds.add(id);
        current.endpoints.push(id === endpoint.id ? endpoint : { ...endpoint, id });
      });

      tagMap.set(tag.name, current);
    });
  });

  const servers = Array.from(serverMap.values());
  const title =
    items.length === 1 ? first.spec.info.title : `${first.spec.info.title} + ${items.length - 1}`;

  return {
    info: {
      title,
      version: first.spec.info.version,
      description:
        first.spec.info.description ||
        `Gộp từ ${items.map((item) => item.sourceName).join(", ")}`,
      baseUrl: servers[0]?.url ?? first.spec.info.baseUrl,
      servers,
    },
    tags: Array.from(tagMap.values()).filter((tag) => tag.endpoints.length > 0),
  };
}

export function SourceModal({ onClose, onLoad, currentSourceName }: Props) {
  const [tab, setTab] = useState<SourceTab>("file");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [folderFiles, setFolderFiles] = useState<FolderFileStatus[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = parseSpecText(text, file.name.toLowerCase());
      onLoad(parsed, file.name);
      onClose();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Không thể đọc file"));
    } finally {
      setLoading(false);
    }
  };

  const handleFolder = async (files: FileList | File[]) => {
    const allFiles = Array.from(files).sort((a, b) =>
      getDisplayPath(a).localeCompare(getDisplayPath(b))
    );
    const initial: FolderFileStatus[] = allFiles.map((file) => ({
      name: file.name,
      path: getDisplayPath(file),
      size: file.size,
      status: isOpenApiFile(file) ? "pending" : "skipped",
      message: isOpenApiFile(file) ? undefined : "Bỏ qua",
    }));

    setError(null);
    setFolderFiles(initial);
    setLoading(true);

    const loaded: { spec: ApiSpec; sourceName: string }[] = [];
    const next = [...initial];

    for (let index = 0; index < allFiles.length; index += 1) {
      const file = allFiles[index];
      if (!isOpenApiFile(file)) continue;

      try {
        const text = await file.text();
        const parsed = parseSpecText(text, file.name.toLowerCase());
        loaded.push({ spec: parsed, sourceName: getDisplayPath(file) });
        next[index] = { ...next[index], status: "loaded", message: "Đã đọc" };
      } catch (e: unknown) {
        next[index] = {
          ...next[index],
          status: "error",
          message: getErrorMessage(e, "Không đọc được"),
        };
      }
      setFolderFiles([...next]);
    }

    try {
      if (!loaded.length) {
        throw new Error("Không tìm thấy file OpenAPI hợp lệ trong thư mục");
      }
      const merged = mergeApiSpecs(loaded);
      const rootName = loaded[0].sourceName.split(/[\\/]/)[0] || "Folder";
      onLoad(merged, `${rootName} (${loaded.length} specs)`);
      onClose();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Không thể gộp thư mục"));
    } finally {
      setLoading(false);
    }
  };

  const handleUrl = async () => {
    if (!url.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(url.trim());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseSpecText(text, url.toLowerCase());
      onLoad(parsed, url.trim());
      onClose();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Không thể tải URL"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileJson className="size-5 text-primary" />
            <div style={{ fontWeight: 600 }}>Nguồn OpenAPI</div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-md hover:bg-accent flex items-center justify-center"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          {currentSourceName && (
            <div className="text-xs text-muted-foreground mb-3 truncate">
              Hiện tại: <span className="font-mono text-foreground">{currentSourceName}</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-muted/50 mb-4">
            <button
              onClick={() => setTab("file")}
              className={`px-2 py-1.5 rounded text-sm flex items-center justify-center gap-1.5 transition-colors ${
                tab === "file" ? "bg-background shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="size-3.5" /> File
            </button>
            <button
              onClick={() => setTab("folder")}
              className={`px-2 py-1.5 rounded text-sm flex items-center justify-center gap-1.5 transition-colors ${
                tab === "folder" ? "bg-background shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderOpen className="size-3.5" /> Thư mục
            </button>
            <button
              onClick={() => setTab("url")}
              className={`px-2 py-1.5 rounded text-sm flex items-center justify-center gap-1.5 transition-colors ${
                tab === "url" ? "bg-background shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LinkIcon className="size-3.5" /> Từ URL
            </button>
          </div>
        </div>

        <div className="px-5 pb-5">
          {tab === "file" ? (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-accent/40 transition-colors"
            >
              <Upload className="size-8 mx-auto mb-3 text-muted-foreground" />
              <div className="text-sm mb-1">Kéo thả hoặc click để chọn file</div>
              <div className="text-xs text-muted-foreground">
                Hỗ trợ .json, .yaml, .yml (OpenAPI 3.x)
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.yaml,.yml,application/json,text/yaml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
          ) : tab === "folder" ? (
            <div className="space-y-3">
              <div
                onClick={() => folderRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = e.dataTransfer.files;
                  if (files?.length) handleFolder(files);
                }}
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-accent/40 transition-colors"
              >
                <FolderOpen className="size-8 mx-auto mb-3 text-muted-foreground" />
                <div className="text-sm mb-1">Chọn hoặc kéo thả thư mục OpenAPI</div>
                <div className="text-xs text-muted-foreground">
                  Tự đọc .json, .yaml, .yml và gộp các spec hợp lệ
                </div>
                <input
                  ref={folderRef}
                  type="file"
                  multiple
                  className="hidden"
                  {...folderInputProps}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files?.length) handleFolder(files);
                    e.target.value = "";
                  }}
                />
              </div>

              {folderFiles.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
                    <span>{folderFiles.length} files</span>
                    <span>
                      {folderFiles.filter((file) => file.status === "loaded").length} specs
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {folderFiles.map((file) => (
                      <div
                        key={file.path}
                        className="flex items-start gap-2 px-3 py-2 border-b border-border/60 last:border-b-0"
                      >
                        {file.status === "loaded" ? (
                          <CheckCircle2 className="size-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                        ) : file.status === "error" ? (
                          <AlertCircle className="size-4 mt-0.5 text-destructive flex-shrink-0" />
                        ) : file.status === "pending" ? (
                          <Loader2 className="size-4 mt-0.5 animate-spin text-muted-foreground flex-shrink-0" />
                        ) : (
                          <FileJson className="size-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-mono">{file.path}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatSize(file.size)}
                            {file.message ? ` · ${file.message}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  URL file swagger
                </label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/openapi.yaml"
                  className="w-full px-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
                />
              </div>
              <button
                onClick={handleUrl}
                disabled={loading || !url.trim()}
                className="w-full px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LinkIcon className="size-4" />
                )}
                Tải spec
              </button>
            </div>
          )}

          {loading && tab !== "url" && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang xử lý...
            </div>
          )}
          {error && (
            <div className="mt-3 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
