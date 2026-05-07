"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  Braces,
  FileText,
  Wand2,
  FormInput,
  ListPlus,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Endpoint, Param, RequestBodySpec } from "@/lib/data/apiSpec";
import { CodeBlock } from "./CodeBlock";
import { MethodBadge } from "./MethodBadge";
import { StatusBadge } from "./StatusBadge";

type RequestTab = "params" | "headers" | "body";
type ResponseTab = "body" | "headers";
type BodyMode = "none" | "json" | "form-data" | "form-urlencoded" | "raw";
type CaptureSource = "body" | "header";

type KeyValueRow = {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
};

type RunnerValues = {
  params: Record<string, string>;
  hiddenParams: string[];
  disabledParams: string[];
  customParams: KeyValueRow[];
  headers: Record<string, string>;
  customHeaders: KeyValueRow[];
  bodies: Record<string, string>;
  bodyMode?: BodyMode;
  rawBody: string;
  rawContentType: string;
  formDataRows: KeyValueRow[];
  formUrlRows: KeyValueRow[];
  requestTab: RequestTab;
  responseTab: ResponseTab;
  responseCaptures: ResponseCapture[];
};

type RunnerResponse = {
  status: number;
  statusText: string;
  durationMs: number;
  headers: [string, string][];
  body: string;
  contentType: string;
};

type ResponseCapture = {
  id: string;
  enabled: boolean;
  source: CaptureSource;
  path: string;
  variableName: string;
};

type EnvironmentVariable = {
  id: string;
  name: string;
  value: string;
  updatedAt: string;
};

type FieldOption = {
  source: CaptureSource;
  path: string;
  label: string;
  preview: string;
};

const EMPTY_VALUES: RunnerValues = {
  params: {},
  hiddenParams: [],
  disabledParams: [],
  customParams: [],
  headers: {},
  customHeaders: [],
  bodies: {},
  rawBody: "",
  rawContentType: "text/plain",
  formDataRows: [],
  formUrlRows: [],
  requestTab: "params",
  responseTab: "body",
  responseCaptures: [],
};

const BODY_MODES: {
  value: BodyMode;
  label: string;
  icon: ReactNode;
}[] = [
  { value: "none", label: "No body", icon: <X className="size-3.5" /> },
  { value: "json", label: "JSON", icon: <Braces className="size-3.5" /> },
  { value: "form-data", label: "form-data", icon: <ListPlus className="size-3.5" /> },
  {
    value: "form-urlencoded",
    label: "x-www-form-urlencoded",
    icon: <FormInput className="size-3.5" />,
  },
  { value: "raw", label: "Raw", icon: <FileText className="size-3.5" /> },
];

const codeFont = '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace';

const runnerDarkStyle: { [key: string]: React.CSSProperties } = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...(oneDark['pre[class*="language-"]'] as React.CSSProperties),
    background: "#0d1117",
    margin: 0,
    padding: "0.75rem",
    fontSize: "0.75rem",
    lineHeight: "1.65",
    fontFamily: codeFont,
  },
  'code[class*="language-"]': {
    ...(oneDark['code[class*="language-"]'] as React.CSSProperties),
    background: "transparent",
    fontFamily: codeFont,
  },
};

const runnerLightStyle: { [key: string]: React.CSSProperties } = {
  ...oneLight,
  'pre[class*="language-"]': {
    ...(oneLight['pre[class*="language-"]'] as React.CSSProperties),
    background: "#f6f8fa",
    margin: 0,
    padding: "0.75rem",
    fontSize: "0.75rem",
    lineHeight: "1.65",
    fontFamily: codeFont,
  },
  'code[class*="language-"]': {
    ...(oneLight['code[class*="language-"]'] as React.CSSProperties),
    background: "transparent",
    fontFamily: codeFont,
  },
};

function useIsDark() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function makeRow(key = "", value = ""): KeyValueRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    enabled: true,
    key,
    value,
  };
}

function stringifyExample(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stringifyEnvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function previewValue(value: unknown) {
  const text = stringifyEnvValue(value);
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

function formatResponseBody(body: string, contentType: string) {
  if (!body) return "";
  if (!contentType.includes("json")) return body;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function storageKey(scope: string, endpoint: Endpoint) {
  return `api-docs.runner.v2:${scope}:${endpoint.method}:${endpoint.path}:${endpoint.id}`;
}

function environmentStorageKey(scope: string) {
  return `api-docs.runner.env.v1:${scope}`;
}

function globalEnvironmentStorageKey() {
  return "api-docs.runner.env.v2";
}

function paramKey(param: Param) {
  return `${param.in}:${param.name}`;
}

function defaultParamValue(param: Param) {
  return param.example === undefined ? "" : String(param.example);
}

function inferBodyMode(body?: RequestBodySpec): BodyMode {
  if (!body) return "none";
  const contentType = body.contentType.toLowerCase();
  if (contentType.includes("json")) return "json";
  if (contentType.includes("multipart/form-data")) return "form-data";
  if (contentType.includes("x-www-form-urlencoded")) return "form-urlencoded";
  return "raw";
}

function contentTypeForMode(mode: BodyMode, activeBody?: RequestBodySpec, values?: RunnerValues) {
  if (mode === "json") {
    return activeBody?.contentType.toLowerCase().includes("json")
      ? activeBody.contentType
      : "application/json";
  }
  if (mode === "form-urlencoded") return "application/x-www-form-urlencoded";
  if (mode === "form-data") return "";
  if (mode === "raw") return values?.rawContentType || activeBody?.contentType || "text/plain";
  return "";
}

function defaultHeaderValue(param: Param, activeBody: RequestBodySpec | undefined, mode: BodyMode) {
  if (param.name.toLowerCase() === "content-type") {
    return contentTypeForMode(mode, activeBody) || activeBody?.contentType || "";
  }
  return param.example === undefined ? "" : String(param.example);
}

function defaultRowsFromBody(body?: RequestBodySpec) {
  if (!body?.fields.length) return [makeRow()];
  return body.fields.map((field) => makeRow(field.name, stringifyExample(field.example)));
}

function joinBaseAndPath(baseUrl: string, endpointPath: string) {
  const base = new URL(baseUrl);
  const basePath = base.pathname.endsWith("/")
    ? base.pathname.slice(0, -1)
    : base.pathname;
  const childPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  base.pathname = `${basePath}${childPath}`.replace(/\/{2,}/g, "/");
  base.search = "";
  base.hash = "";
  return base;
}

function buildUrl(
  baseUrl: string,
  endpoint: Endpoint,
  params: Param[],
  values: RunnerValues,
  environment: EnvironmentVariable[] = []
) {
  let path = endpoint.path;
  params
    .filter((param) => param.in === "path")
    .forEach((param) => {
      const value = resolveEnvReferences(
        values.params[paramKey(param)] ?? defaultParamValue(param),
        environment
      );
      if (param.required && !value.trim()) {
        throw new Error(`Thiếu path param: ${param.name}`);
      }
      path = path.replaceAll(`{${param.name}}`, encodeURIComponent(value));
    });

  const url = joinBaseAndPath(baseUrl, path);
  params
    .filter((param) => param.in === "query")
    .forEach((param) => {
      if (values.hiddenParams.includes(paramKey(param))) return;
      if (values.disabledParams.includes(paramKey(param))) return;
      const value = resolveEnvReferences(
        values.params[paramKey(param)] ?? defaultParamValue(param),
        environment
      );
      if (value.trim()) url.searchParams.set(param.name, value);
    });
  values.customParams
    .filter((row) => row.enabled && row.key.trim())
    .forEach((row) => {
      url.searchParams.set(row.key, resolveEnvReferences(row.value, environment));
    });
  return url.toString();
}

function getJsonBodyText(body: RequestBodySpec | undefined, values: RunnerValues) {
  if (!body) return values.bodies.__customJson ?? "{}";
  return values.bodies[body.contentType] ?? stringifyExample(body.example);
}

function normalizeValues(raw: unknown): RunnerValues {
  if (!raw || typeof raw !== "object") return EMPTY_VALUES;
  const value = raw as Partial<RunnerValues>;
  return {
    ...EMPTY_VALUES,
    ...value,
    params: value.params ?? {},
    hiddenParams: Array.isArray(value.hiddenParams) ? value.hiddenParams : [],
    disabledParams: Array.isArray(value.disabledParams) ? value.disabledParams : [],
    customParams: value.customParams ?? [],
    headers: value.headers ?? {},
    customHeaders: value.customHeaders ?? [],
    bodies: value.bodies ?? {},
    formDataRows: value.formDataRows ?? [],
    formUrlRows: value.formUrlRows ?? [],
    responseCaptures: value.responseCaptures ?? [],
  };
}

function normalizeEnvironment(raw: unknown): EnvironmentVariable[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Partial<EnvironmentVariable> =>
      Boolean(item && typeof item === "object")
    )
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : makeRow().id,
      name: typeof item.name === "string" ? item.name : "",
      value: typeof item.value === "string" ? item.value : "",
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
    }))
    .filter((item) => item.name.trim());
}

function readEnvironment(globalKey: string, legacyKey?: string) {
  const read = (key: string) => {
    const raw = localStorage.getItem(key);
    return raw ? normalizeEnvironment(JSON.parse(raw)) : [];
  };
  const globalEnvironment = read(globalKey);
  if (globalEnvironment.length || !legacyKey) return globalEnvironment;
  return read(legacyKey);
}

function normalizeVariableName(value: string) {
  return value.trim().replace(/[^\w.-]/g, "_");
}

function resolveEnvReferences(value: string, variables: EnvironmentVariable[]) {
  if (!value.includes("{{")) return value;
  const envMap = new Map(variables.map((item) => [item.name, item.value]));
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name: string) =>
    envMap.has(name) ? envMap.get(name) ?? "" : match
  );
}

function valueFromCapture(response: RunnerResponse, capture: ResponseCapture) {
  const json =
    response.contentType.includes("json") && response.body
      ? parseJsonBody(response.body)
      : undefined;
  const headerMap = new Map(response.headers.map(([name, value]) => [name.toLowerCase(), value]));
  if (capture.source === "header") return headerMap.get(capture.path.toLowerCase());
  if (json === undefined) return capture.path === "$" ? response.body : undefined;
  return extractJsonPath(json, capture.path);
}

function parseJsonBody(body: string) {
  if (!body.trim()) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function pathSegment(segment: string) {
  return /^[A-Za-z_$][\w$]*$/.test(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`;
}

function joinJsonPath(parent: string, segment: string | number) {
  if (typeof segment === "number") return `${parent}[${segment}]`;
  if (parent === "$") return `$${pathSegment(segment)}`;
  return `${parent}${pathSegment(segment)}`;
}

function flattenJsonFields(value: unknown, parent = "$", depth = 0): FieldOption[] {
  if (depth > 5) return [];
  if (Array.isArray(value)) {
    const own = value.length
      ? [{ source: "body" as const, path: parent, label: parent, preview: previewValue(value) }]
      : [];
    return [
      ...own,
      ...value
        .slice(0, 20)
        .flatMap((item, index) => flattenJsonFields(item, joinJsonPath(parent, index), depth + 1)),
    ];
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 80);
    const own =
      parent === "$"
        ? []
        : [{ source: "body" as const, path: parent, label: parent, preview: previewValue(value) }];
    return [
      ...own,
      ...entries.flatMap(([key, item]) =>
        flattenJsonFields(item, joinJsonPath(parent, key), depth + 1)
      ),
    ];
  }
  return [{ source: "body", path: parent, label: parent, preview: previewValue(value) }];
}

function parsePath(path: string) {
  const segments: Array<string | number> = [];
  let index = path.startsWith("$") ? 1 : 0;
  while (index < path.length) {
    if (path[index] === ".") {
      index += 1;
      const start = index;
      while (index < path.length && /[\w$]/.test(path[index])) index += 1;
      segments.push(path.slice(start, index));
      continue;
    }
    if (path[index] === "[") {
      const end = path.indexOf("]", index);
      if (end === -1) return segments;
      const raw = path.slice(index + 1, end);
      if (/^\d+$/.test(raw)) {
        segments.push(Number(raw));
      } else {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed === "string") segments.push(parsed);
        } catch {
          segments.push(raw);
        }
      }
      index = end + 1;
      continue;
    }
    index += 1;
  }
  return segments;
}

function extractJsonPath(value: unknown, path: string) {
  if (path === "$") return value;
  return parsePath(path).reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined;
    if (typeof segment === "number" && Array.isArray(current)) return current[segment];
    if (typeof segment === "string" && typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);
}

function responseFieldOptions(response: RunnerResponse): FieldOption[] {
  const options = response.headers.map(([name, value]) => ({
    source: "header" as const,
    path: name,
    label: `header:${name}`,
    preview: previewValue(value),
  }));
  const json = response.contentType.includes("json") ? parseJsonBody(response.body) : undefined;
  if (json !== undefined) return [...flattenJsonFields(json), ...options];
  if (response.body) {
    return [
      { source: "body", path: "$", label: "$", preview: previewValue(response.body) },
      ...options,
    ];
  }
  return options;
}

function makeCapture(source: CaptureSource, path: string, variableName = ""): ResponseCapture {
  return {
    id: makeRow().id,
    enabled: true,
    source,
    path,
    variableName,
  };
}

function MiniTabs<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T;
  items: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 rounded-lg bg-muted/50 p-1">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={`rounded-md px-2 py-2 text-xs transition-colors ${
            value === item.value
              ? "bg-background text-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function KeyValueEditor({
  rows,
  emptyText,
  onChange,
}: {
  rows: KeyValueRow[];
  emptyText: string;
  onChange: (rows: KeyValueRow[]) => void;
}) {
  const updateRow = (id: string, patch: Partial<KeyValueRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-2">
      {rows.length ? (
        rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
              className="mt-2.5"
              aria-label="Enable row"
            />
            <input
              value={row.key}
              onChange={(e) => updateRow(row.id, { key: e.target.value })}
              placeholder="Key"
              className="min-w-0 rounded-md border border-border bg-input-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={row.value}
              onChange={(e) => updateRow(row.id, { value: e.target.value })}
              placeholder="Value"
              className="min-w-0 rounded-md border border-border bg-input-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
              className="size-9 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
              aria-label="Remove row"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))
      ) : (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}
      <button
        onClick={() => onChange([...rows, makeRow()])}
        className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2"
      >
        <Plus className="size-4" />
        Add row
      </button>
    </div>
  );
}

function formatJsonText(value: string) {
  return JSON.stringify(JSON.parse(value), null, 2);
}

function JsonEditor({
  value,
  onChange,
  rows = 13,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const isDark = useIsDark();
  const highlighterRef = useRef<HTMLDivElement>(null);
  const [formatError, setFormatError] = useState<string | null>(null);

  const format = () => {
    try {
      onChange(formatJsonText(value));
      setFormatError(null);
    } catch (e: unknown) {
      setFormatError(e instanceof Error ? e.message : "JSON không hợp lệ.");
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      format();
    }
  };

  const onScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    if (!highlighterRef.current) return;
    highlighterRef.current.scrollTop = target.scrollTop;
    highlighterRef.current.scrollLeft = target.scrollLeft;
  };

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-xl transition-all"
        style={{
          border: isDark ? "1px solid #30363d" : "1px solid #d0d7de",
          background: isDark ? "#0d1117" : "#f6f8fa",
        }}
      >
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{
            background: isDark ? "#161b22" : "#eaeef2",
            borderBottom: isDark ? "1px solid #30363d" : "1px solid #d0d7de",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span
              className="ml-2 font-mono text-[11px] uppercase tracking-widest"
              style={{ color: isDark ? "#8b949e" : "#57606a" }}
            >
              json
            </span>
          </div>
          <button
            type="button"
            onClick={format}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors hover:bg-background/70"
            style={{ color: isDark ? "#8b949e" : "#57606a" }}
            title="Format JSON (Alt + Shift + F)"
          >
            <Wand2 className="size-3.5" />
            Format
          </button>
        </div>
        <div className="relative">
          <div ref={highlighterRef} className="pointer-events-none absolute inset-0 overflow-hidden">
            <SyntaxHighlighter
              language="json"
              style={isDark ? runnerDarkStyle : runnerLightStyle}
              showLineNumbers={false}
              wrapLines={false}
              customStyle={{ margin: 0, borderRadius: 0, minHeight: "100%" }}
              codeTagProps={{ style: { fontFamily: codeFont } }}
            >
              {value || " "}
            </SyntaxHighlighter>
          </div>
          <textarea
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              if (formatError) setFormatError(null);
            }}
            onKeyDown={onKeyDown}
            onScroll={onScroll}
            spellCheck={false}
            rows={rows}
            className="relative block w-full resize-y overflow-auto bg-transparent p-3 font-mono text-xs leading-[1.65] text-transparent caret-foreground selection:bg-primary/25 focus:outline-none"
            style={{
              fontFamily: codeFont,
              WebkitTextFillColor: "transparent",
              tabSize: 2,
            }}
          />
        </div>
      </div>
      {formatError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          JSON không hợp lệ: {formatError}
        </div>
      )}
      <div className="text-[11px] text-muted-foreground">
        Nhấn <span className="font-mono">Alt + Shift + F</span> để format JSON.
      </div>
    </div>
  );
}

export function ApiRunner({
  endpoint,
  baseUrl,
  params,
  headers,
  bodies,
  activeBody,
  onBodyChange,
  storageScope,
  onClose,
}: {
  endpoint: Endpoint;
  baseUrl: string;
  params: Param[];
  headers: Param[];
  bodies: RequestBodySpec[];
  activeBody?: RequestBodySpec;
  onBodyChange: (contentType: string) => void;
  storageScope: string;
  onClose: () => void;
}) {
  const key = storageKey(storageScope, endpoint);
  const envKey = globalEnvironmentStorageKey();
  const legacyEnvKey = environmentStorageKey(storageScope);
  const [values, setValues] = useState<RunnerValues>(EMPTY_VALUES);
  const [environment, setEnvironment] = useState<EnvironmentVariable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<RunnerResponse | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const envLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setResponse(null);
      setError(null);
      try {
        const raw = localStorage.getItem(key);
        loadedKeyRef.current = key;
        setValues(raw ? normalizeValues(JSON.parse(raw)) : EMPTY_VALUES);
      } catch {
        loadedKeyRef.current = key;
        setValues(EMPTY_VALUES);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (loadedKeyRef.current !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(values));
    } catch {
      // ignore
    }
  }, [key, values]);

  useEffect(() => {
    let cancelled = false;
    envLoadedRef.current = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        setEnvironment(readEnvironment(envKey, legacyEnvKey));
      } catch {
        setEnvironment([]);
      } finally {
        envLoadedRef.current = true;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [envKey, legacyEnvKey]);

  useEffect(() => {
    if (!envLoadedRef.current) return;
    try {
      localStorage.setItem(envKey, JSON.stringify(environment));
    } catch {
      // ignore
    }
  }, [envKey, environment]);

  const bodyMode = values.bodyMode ?? inferBodyMode(activeBody);
  const queryParams = params.filter((param) => param.in === "query");
  const pathParams = params.filter((param) => param.in === "path");
  const hiddenParamSet = useMemo(() => new Set(values.hiddenParams), [values.hiddenParams]);
  const disabledParamSet = useMemo(
    () => new Set(values.disabledParams),
    [values.disabledParams]
  );
  const visibleSpecParams = useMemo(
    () => [...pathParams, ...queryParams].filter((param) => !hiddenParamSet.has(paramKey(param))),
    [hiddenParamSet, pathParams, queryParams]
  );
  const hiddenSpecQueryParams = useMemo(
    () => queryParams.filter((param) => hiddenParamSet.has(paramKey(param))),
    [hiddenParamSet, queryParams]
  );

  const formDataRows =
    values.formDataRows.length || !activeBody
      ? values.formDataRows
      : defaultRowsFromBody(activeBody);
  const formUrlRows =
    values.formUrlRows.length || !activeBody
      ? values.formUrlRows
      : defaultRowsFromBody(activeBody);

  const setRequestTab = (requestTab: RequestTab) =>
    setValues((current) => ({ ...current, requestTab }));

  const setResponseTab = (responseTab: ResponseTab) =>
    setValues((current) => ({ ...current, responseTab }));

  const setBodyMode = (mode: BodyMode) =>
    setValues((current) => ({ ...current, bodyMode: mode, requestTab: "body" }));

  const setParam = (param: Param, value: string) =>
    setValues((current) => ({
      ...current,
      params: { ...current.params, [paramKey(param)]: value },
    }));

  const setParamEnabled = (param: Param, enabled: boolean) => {
    if (param.in === "path") return;
    const id = paramKey(param);
    setValues((current) => {
      const next = new Set(current.disabledParams);
      if (enabled) next.delete(id);
      else next.add(id);
      return { ...current, disabledParams: Array.from(next) };
    });
  };

  const hideParam = (param: Param) => {
    if (param.in === "path") return;
    const id = paramKey(param);
    setValues((current) => {
      const hidden = new Set(current.hiddenParams);
      hidden.add(id);
      const disabled = new Set(current.disabledParams);
      disabled.delete(id);
      return {
        ...current,
        hiddenParams: Array.from(hidden),
        disabledParams: Array.from(disabled),
        params: { ...current.params, [id]: "" },
      };
    });
  };

  const setHeader = (header: Param, value: string) =>
    setValues((current) => ({
      ...current,
      headers: { ...current.headers, [header.name]: value },
    }));

  const setJsonBody = (value: string) =>
    setValues((current) => ({
      ...current,
      bodies: { ...current.bodies, [activeBody?.contentType ?? "__customJson"]: value },
    }));

  const resetCurrentEndpoint = () => {
    setValues(EMPTY_VALUES);
    setResponse(null);
    setError(null);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  };

  const saveEnvironmentVariables = (updates: { name: string; value: string }[]) => {
    if (!updates.length) return;
    setEnvironment((current) => {
      const next = [...current];
      updates.forEach((update) => {
        const name = normalizeVariableName(update.name);
        if (!name) return;
        const existingIndex = next.findIndex((item) => item.name === name);
        const item = {
          id: existingIndex >= 0 ? next[existingIndex].id : makeRow().id,
          name,
          value: update.value,
          updatedAt: new Date().toISOString(),
        };
        if (existingIndex >= 0) {
          next[existingIndex] = item;
        } else {
          next.push(item);
        }
      });
      const sorted = next.sort((a, b) => a.name.localeCompare(b.name));
      try {
        localStorage.setItem(envKey, JSON.stringify(sorted));
      } catch {
        // ignore
      }
      return sorted;
    });
  };

  const captureResponseVariables = (nextResponse: RunnerResponse) => {
    const updates = values.responseCaptures
      .filter((capture) => capture.enabled && capture.path && capture.variableName.trim())
      .map((capture) => {
        const value = valueFromCapture(nextResponse, capture);
        if (value === undefined) return null;
        return {
          name: capture.variableName,
          value: stringifyEnvValue(value),
        };
      })
      .filter((item): item is { name: string; value: string } => item !== null);
    saveEnvironmentVariables(updates);
  };

  const saveCaptureNow = (capture: ResponseCapture) => {
    if (!response || !capture.variableName.trim()) return;
    const value = valueFromCapture(response, capture);
    if (value === undefined) return;
    saveEnvironmentVariables([
      {
        name: capture.variableName,
        value: stringifyEnvValue(value),
      },
    ]);
  };

  const buildBody = (activeEnvironment = environment) => {
    if (bodyMode === "none") return { body: undefined, contentType: "" };
    if (bodyMode === "json") {
      return {
        body: resolveEnvReferences(getJsonBodyText(activeBody, values), activeEnvironment),
        contentType: contentTypeForMode("json", activeBody, values),
      };
    }
    if (bodyMode === "raw") {
      return {
        body: resolveEnvReferences(
          values.rawBody || stringifyExample(activeBody?.example),
          activeEnvironment
        ),
        contentType: contentTypeForMode("raw", activeBody, values),
      };
    }
    if (bodyMode === "form-urlencoded") {
      const data = new URLSearchParams();
      formUrlRows
        .filter((row) => row.enabled && row.key.trim())
        .forEach((row) =>
          data.set(row.key, resolveEnvReferences(row.value, activeEnvironment))
        );
      return {
        body: data,
        contentType: contentTypeForMode("form-urlencoded", activeBody, values),
      };
    }
    const data = new FormData();
    formDataRows
      .filter((row) => row.enabled && row.key.trim())
      .forEach((row) => data.set(row.key, resolveEnvReferences(row.value, activeEnvironment)));
    return { body: data, contentType: "" };
  };

  const send = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const activeEnvironment = envLoadedRef.current
        ? environment
        : readEnvironment(envKey, legacyEnvKey);
      if (!envLoadedRef.current) {
        setEnvironment(activeEnvironment);
        envLoadedRef.current = true;
      }
      const url = buildUrl(baseUrl, endpoint, params, values, activeEnvironment);
      const requestHeaders: Record<string, string> = {};
      headers.forEach((header) => {
        const value = resolveEnvReferences(
          values.headers[header.name] ?? defaultHeaderValue(header, activeBody, bodyMode),
          activeEnvironment
        );
        if (value.trim()) requestHeaders[header.name] = value;
      });
      values.customHeaders
        .filter((row) => row.enabled && row.key.trim())
        .forEach((row) => {
          requestHeaders[row.key] = resolveEnvReferences(row.value, activeEnvironment);
        });

      const requestBody = buildBody(activeEnvironment);
      if (
        requestBody.contentType &&
        !Object.keys(requestHeaders).some((name) => name.toLowerCase() === "content-type")
      ) {
        requestHeaders["Content-Type"] = requestBody.contentType;
      }

      const started = performance.now();
      const canSendBody = !["GET", "HEAD"].includes(endpoint.method);
      const res = await fetch(url, {
        method: endpoint.method,
        headers: requestHeaders,
        body: canSendBody ? requestBody.body : undefined,
      });
      const text = await res.text();
      const nextResponse = {
        status: res.status,
        statusText: res.statusText,
        durationMs: Math.round(performance.now() - started),
        headers: Array.from(res.headers.entries()),
        body: formatResponseBody(text, res.headers.get("content-type") ?? ""),
        contentType: res.headers.get("content-type") ?? "",
      };
      setResponse(nextResponse);
      captureResponseVariables(nextResponse);
      setValues((current) => ({ ...current, responseTab: "body" }));
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Không gửi được request. Nếu API khác domain, hãy kiểm tra CORS."
      );
    } finally {
      setLoading(false);
    }
  };

  const visibleHeaders = useMemo(() => {
    const modeContentType = contentTypeForMode(bodyMode, activeBody, values);
    return headers.map((header) => ({
      param: header,
      value: values.headers[header.name] ?? defaultHeaderValue(header, activeBody, bodyMode),
      helper:
        header.name.toLowerCase() === "content-type" && modeContentType
          ? `Auto: ${modeContentType}`
          : header.description || header.type,
    }));
  }, [activeBody, bodyMode, headers, values]);

  const responseOptions = response ? responseFieldOptions(response) : [];
  const requestUrlPreview = useMemo(() => {
    try {
      return buildUrl(baseUrl, endpoint, params, values, environment);
    } catch (e: unknown) {
      return e instanceof Error ? e.message : "";
    }
  }, [baseUrl, endpoint, environment, params, values]);

  const updateCapture = (id: string, patch: Partial<ResponseCapture>) => {
    setValues((current) => ({
      ...current,
      responseCaptures: current.responseCaptures.map((capture) =>
        capture.id === id ? { ...capture, ...patch } : capture
      ),
    }));
  };

  const addCapture = () => {
    const first = responseOptions[0];
    setValues((current) => ({
      ...current,
      responseCaptures: [
        ...current.responseCaptures,
        makeCapture(first?.source ?? "body", first?.path ?? "$"),
      ],
    }));
  };

  return (
    <aside className="rounded-xl border border-border bg-card text-card-foreground shadow-xl xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MethodBadge method={endpoint.method} />
            <div className="truncate font-mono text-sm">{endpoint.path}</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Run API</div>
        </div>
        <button
          onClick={onClose}
          className="size-8 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Close runner"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground mb-1">Request URL</div>
          <div className="break-all font-mono text-xs text-primary">
            {requestUrlPreview}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <SlidersHorizontal className="size-3.5" />
              Environment
            </div>
            <div className="text-[11px] text-muted-foreground">
              Use <span className="font-mono">{"{{name}}"}</span>
            </div>
          </div>
          {environment.length ? (
            <div className="max-h-28 space-y-1 overflow-auto">
              {environment.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-2 rounded-md bg-background/70 px-2 py-1.5 text-xs"
                >
                  <div className="truncate font-mono text-foreground">{item.name}</div>
                  <div className="truncate font-mono text-muted-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              No environment variables yet.
            </div>
          )}
        </div>

        <MiniTabs<RequestTab>
          value={values.requestTab}
          onChange={setRequestTab}
          items={[
            { value: "params", label: "Params" },
            { value: "headers", label: "Headers" },
            { value: "body", label: "Body" },
          ]}
        />

        {values.requestTab === "params" && (
          <div className="space-y-4">
            {visibleSpecParams.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">Spec params</div>
                <div className="space-y-2">
                  {visibleSpecParams.map((param) => {
                    const id = paramKey(param);
                    const isPath = param.in === "path";
                    const enabled = isPath ? true : !disabledParamSet.has(id);
                    return (
                      <div
                        key={id}
                        className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={isPath}
                          onChange={(e) => setParamEnabled(param, e.target.checked)}
                          className="mt-2.5"
                          aria-label="Enable param"
                        />
                        <div className="min-w-0 rounded-md border border-border bg-muted/30 px-2 py-2 font-mono text-xs text-muted-foreground">
                          {param.name}
                          <span className="ml-2 text-[11px] text-muted-foreground/80">
                            {param.in}
                          </span>
                        </div>
                        <input
                          value={values.params[id] ?? defaultParamValue(param)}
                          onChange={(e) => setParam(param, e.target.value)}
                          placeholder={param.description || param.type}
                          disabled={!enabled}
                          className="min-w-0 rounded-md border border-border bg-input-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                        />
                        <button
                          onClick={() => hideParam(param)}
                          disabled={isPath}
                          className="size-9 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 flex items-center justify-center"
                          aria-label="Remove param"
                          title={isPath ? "Path param không thể xóa" : "Xóa param"}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {hiddenSpecQueryParams.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setValues((current) => ({
                        ...current,
                        hiddenParams: current.hiddenParams.filter(
                          (id) => !hiddenSpecQueryParams.some((p) => paramKey(p) === id)
                        ),
                      }))
                    }
                    className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Khôi phục {hiddenSpecQueryParams.length} spec param đã xóa
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Additional query params</div>
              <KeyValueEditor
                rows={values.customParams}
                emptyText="No custom query params."
                onChange={(customParams) =>
                  setValues((current) => ({ ...current, customParams }))
                }
              />
            </div>
          </div>
        )}

        {values.requestTab === "headers" && (
          <div className="space-y-4">
            {visibleHeaders.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">Spec headers</div>
                {visibleHeaders.map(({ param, value, helper }) => (
                  <label key={param.name} className="block">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{param.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {param.required ? "required" : "optional"}
                      </span>
                    </div>
                    <input
                      value={value}
                      onChange={(e) => setHeader(param, e.target.value)}
                      placeholder={helper}
                      className="w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Additional headers</div>
              <KeyValueEditor
                rows={values.customHeaders}
                emptyText="No custom headers."
                onChange={(customHeaders) =>
                  setValues((current) => ({ ...current, customHeaders }))
                }
              />
            </div>
          </div>
        )}

        {values.requestTab === "body" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Body type</div>
              <div className="flex flex-wrap gap-2">
                {BODY_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setBodyMode(mode.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors inline-flex items-center gap-1.5 ${
                      bodyMode === mode.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode.icon}
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {bodies.length > 1 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Spec media type</div>
                <div className="flex flex-wrap gap-2">
                  {bodies.map((body) => (
                    <button
                      key={body.contentType}
                      onClick={() => onBodyChange(body.contentType)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-mono transition-colors ${
                        activeBody?.contentType === body.contentType
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {body.contentType}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {bodyMode === "none" && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Request này sẽ gửi không kèm body.
              </div>
            )}

            {bodyMode === "json" && (
              <JsonEditor
                value={getJsonBodyText(activeBody, values)}
                onChange={setJsonBody}
              />
            )}

            {bodyMode === "raw" && (
              <div className="space-y-2">
                <input
                  value={values.rawContentType}
                  onChange={(e) =>
                    setValues((current) => ({
                      ...current,
                      rawContentType: e.target.value,
                    }))
                  }
                  placeholder="text/plain"
                  className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <textarea
                  value={values.rawBody || stringifyExample(activeBody?.example)}
                  onChange={(e) =>
                    setValues((current) => ({ ...current, rawBody: e.target.value }))
                  }
                  spellCheck={false}
                  rows={13}
                  className="w-full resize-y rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {bodyMode === "form-data" && (
              <KeyValueEditor
                rows={formDataRows}
                emptyText="Chưa có form-data field."
                onChange={(formDataRows) =>
                  setValues((current) => ({ ...current, formDataRows }))
                }
              />
            )}

            {bodyMode === "form-urlencoded" && (
              <KeyValueEditor
                rows={formUrlRows}
                emptyText="Chưa có form-urlencoded field."
                onChange={(formUrlRows) =>
                  setValues((current) => ({ ...current, formUrlRows }))
                }
              />
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={send}
            disabled={loading}
            className="flex-1 h-10 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Send
          </button>
          <button
            onClick={resetCurrentEndpoint}
            className="h-10 rounded-md border border-border px-3 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Reset saved values"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        {response && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={response.status} />
                <span className="text-sm">{response.statusText || "Response"}</span>
              </div>
              <div className="text-xs text-muted-foreground">{response.durationMs} ms</div>
            </div>

            <MiniTabs<ResponseTab>
              value={values.responseTab}
              onChange={setResponseTab}
              items={[
                { value: "body", label: "Body" },
                { value: "headers", label: "Headers" },
              ]}
            />

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Save className="size-3.5" />
                  Save response fields
                </div>
                <button
                  type="button"
                  onClick={addCapture}
                  disabled={!responseOptions.length}
                  className="h-8 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  Add rule
                </button>
              </div>
              {values.responseCaptures.length ? (
                <div className="space-y-2">
                  {values.responseCaptures.map((capture) => {
                    const selectedValue = `${capture.source}:${capture.path}`;
                    return (
                      <div
                        key={capture.id}
                        className="grid grid-cols-[auto_minmax(0,1.35fr)_minmax(0,1fr)_auto_auto] gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={capture.enabled}
                          onChange={(e) =>
                            updateCapture(capture.id, { enabled: e.target.checked })
                          }
                          className="mt-2.5"
                          aria-label="Enable capture"
                        />
                        <select
                          value={selectedValue}
                          onChange={(e) => {
                            const option = responseOptions.find(
                              (item) => `${item.source}:${item.path}` === e.target.value
                            );
                            if (!option) return;
                            const nextCapture = {
                              ...capture,
                              source: option.source,
                              path: option.path,
                            };
                            updateCapture(capture.id, nextCapture);
                            saveCaptureNow(nextCapture);
                          }}
                          className="min-w-0 rounded-md border border-border bg-input-background px-2 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {responseOptions.map((option) => (
                            <option
                              key={`${option.source}:${option.path}`}
                              value={`${option.source}:${option.path}`}
                            >
                              {option.label} = {option.preview}
                            </option>
                          ))}
                          {!responseOptions.some((item) => `${item.source}:${item.path}` === selectedValue) && (
                            <option value={selectedValue}>
                              {capture.source}:{capture.path}
                            </option>
                          )}
                        </select>
                        <input
                          value={capture.variableName}
                          onChange={(e) =>
                            updateCapture(capture.id, { variableName: e.target.value })
                          }
                          onBlur={(e) => {
                            const nextCapture = {
                              ...capture,
                              variableName: normalizeVariableName(e.target.value),
                            };
                            updateCapture(capture.id, nextCapture);
                            saveCaptureNow(nextCapture);
                          }}
                          placeholder="variable_name"
                          className="min-w-0 rounded-md border border-border bg-input-background px-2 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          type="button"
                          onClick={() => saveCaptureNow(capture)}
                          disabled={!capture.variableName.trim()}
                          className="size-9 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 flex items-center justify-center"
                          aria-label="Save capture now"
                          title="Save variable now"
                        >
                          <Save className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setValues((current) => ({
                              ...current,
                              responseCaptures: current.responseCaptures.filter(
                                (item) => item.id !== capture.id
                              ),
                            }))
                          }
                          className="size-9 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
                          aria-label="Remove capture"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="text-[11px] text-muted-foreground">
                    Rules run automatically after each Send for this endpoint.
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  Choose a response field, set a variable name, then save it.
                </div>
              )}
            </div>

            {values.responseTab === "body" ? (
              <div className="max-h-[520px] overflow-auto rounded-xl">
                <CodeBlock
                  code={response.body || "// No content"}
                  language={response.contentType.includes("json") ? "json" : "text"}
                />
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto rounded-lg border border-border">
                {response.headers.map(([name, value]) => (
                  <div
                    key={name}
                    className="grid grid-cols-[140px_1fr] gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0"
                  >
                    <div className="font-mono text-muted-foreground">{name}</div>
                    <div className="min-w-0 break-all font-mono">{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
