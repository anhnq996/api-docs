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
  AlertCircle,
  Braces,
  Check,
  Copy,
  ChevronDown,
  FileText,
  Wand2,
  FormInput,
  ListPlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Send,
  Terminal,
  Trash2,
  Variable,
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

type RequestTab = "params" | "headers" | "body" | "auth" | "scripts";
type ResponseTab = "pretty" | "raw" | "preview" | "headers";
type BodyMode = "none" | "json" | "form-data" | "form-urlencoded" | "raw";
type CaptureSource = "body" | "header";
type AuthType = "none" | "bearer" | "basic" | "api-key" | "oauth2";

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
  auth: AuthConfig;
  preScript: string;
  postScript: string;
  responseCaptures: ResponseCapture[];
};

type RunnerResponse = {
  status: number;
  statusText: string;
  durationMs: number;
  size: number;
  headers: [string, string][];
  body: string;
  rawBody: string;
  contentType: string;
};

type RunnerProxyBody =
  | { bodyType: "none"; body?: undefined }
  | { bodyType: "text"; body: string }
  | { bodyType: "form-data"; body: [string, string][] };

type RunnerProxyResponse = {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
  error?: string;
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

type AuthConfig = {
  type: AuthType;
  bearerToken: string;
  basicUsername: string;
  basicPassword: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyIn: "header" | "query";
  oauth2AccessToken: string;
  oauth2TokenUrl: string;
  oauth2ClientId: string;
  oauth2ClientSecret: string;
  oauth2Scope: string;
};

type ConsoleEntry = {
  id: string;
  time: number;
  level: "log" | "info" | "warn" | "error";
  source: "pre" | "post" | "system";
  parts: string[];
};

type FieldOption = {
  source: CaptureSource;
  path: string;
  label: string;
  preview: string;
};

type SuggestionOption = {
  value: string;
  label?: string;
  detail?: string;
};

type EnvTrigger = {
  start: number;
  query: string;
};

const DEFAULT_AUTH: AuthConfig = {
  type: "none",
  bearerToken: "",
  basicUsername: "",
  basicPassword: "",
  apiKeyName: "X-API-Key",
  apiKeyValue: "",
  apiKeyIn: "header",
  oauth2AccessToken: "",
  oauth2TokenUrl: "",
  oauth2ClientId: "",
  oauth2ClientSecret: "",
  oauth2Scope: "",
};

const DEFAULT_PRE_SCRIPT =
  "// Runs before Send.\n// pm.environment.set('traceId', Date.now().toString());\n// pm.request.headers.set('X-Trace-Id', pm.environment.get('traceId'));\n";

const DEFAULT_POST_SCRIPT =
  "// Runs after the response.\n// const data = pm.response.json();\n// pm.environment.set('token', data.access_token);\n// console.log('status', pm.response.status);\n";

const RUNNER_PROXY_PATH = "/api/runner-proxy";

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
  responseTab: "pretty",
  auth: DEFAULT_AUTH,
  preScript: DEFAULT_PRE_SCRIPT,
  postScript: DEFAULT_POST_SCRIPT,
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

const COMMON_HEADER_PRESETS: {
  name: string;
  detail: string;
  values: string[];
}[] = [
  {
    name: "Accept",
    detail: "Response media type",
    values: ["application/json", "application/xml", "text/plain", "*/*"],
  },
  {
    name: "Accept-Charset",
    detail: "Response charset",
    values: ["utf-8"],
  },
  {
    name: "Accept-Encoding",
    detail: "Response compression",
    values: ["gzip, deflate, br", "gzip"],
  },
  {
    name: "Accept-Language",
    detail: "Preferred language",
    values: ["en-US,en;q=0.9", "vi-VN,vi;q=0.9,en-US;q=0.8"],
  },
  {
    name: "Authorization",
    detail: "Bearer, Basic, or token auth",
    values: ["Bearer {{access_token}}", "Basic {{basic_token}}"],
  },
  {
    name: "Cache-Control",
    detail: "Cache behavior",
    values: ["no-cache", "no-store", "max-age=0"],
  },
  {
    name: "Content-MD5",
    detail: "Body checksum",
    values: ["{{content_md5}}"],
  },
  {
    name: "Content-Type",
    detail: "Request body media type",
    values: [
      "application/json",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "text/plain",
      "application/xml",
      "application/octet-stream",
    ],
  },
  {
    name: "Cookie",
    detail: "Cookie header",
    values: ["session={{session_id}}", "token={{access_token}}"],
  },
  {
    name: "DNT",
    detail: "Do not track",
    values: ["1"],
  },
  {
    name: "Idempotency-Key",
    detail: "Safe retry key",
    values: ["{{idempotency_key}}"],
  },
  {
    name: "If-Match",
    detail: "Conditional request ETag",
    values: ["{{etag}}"],
  },
  {
    name: "If-Modified-Since",
    detail: "Conditional request date",
    values: ["Wed, 21 Oct 2015 07:28:00 GMT"],
  },
  {
    name: "If-None-Match",
    detail: "Conditional request ETag",
    values: ["{{etag}}", "*"],
  },
  {
    name: "Origin",
    detail: "Request origin",
    values: ["https://example.com"],
  },
  {
    name: "Prefer",
    detail: "Server preference",
    values: ["return=representation", "return=minimal"],
  },
  {
    name: "Range",
    detail: "Partial content range",
    values: ["bytes=0-1023"],
  },
  {
    name: "Referer",
    detail: "Referring page",
    values: ["https://example.com"],
  },
  {
    name: "User-Agent",
    detail: "Client identifier",
    values: ["ApiDocsRunner/1.0"],
  },
  {
    name: "X-API-Key",
    detail: "API key auth",
    values: ["{{api_key}}"],
  },
  {
    name: "X-Auth-Token",
    detail: "Token auth",
    values: ["{{auth_token}}"],
  },
  {
    name: "X-Client-ID",
    detail: "Client identifier",
    values: ["{{client_id}}"],
  },
  {
    name: "X-Client-Secret",
    detail: "Client secret",
    values: ["{{client_secret}}"],
  },
  {
    name: "X-Correlation-ID",
    detail: "Distributed trace correlation",
    values: ["{{correlation_id}}"],
  },
  {
    name: "X-CSRF-Token",
    detail: "CSRF protection token",
    values: ["{{csrf_token}}"],
  },
  {
    name: "X-Forwarded-For",
    detail: "Original client IP",
    values: ["203.0.113.10"],
  },
  {
    name: "X-HTTP-Method-Override",
    detail: "Method override",
    values: ["PATCH", "PUT", "DELETE"],
  },
  {
    name: "X-Request-ID",
    detail: "Request tracing",
    values: ["{{request_id}}"],
  },
  {
    name: "X-Tenant-ID",
    detail: "Tenant routing",
    values: ["{{tenant_id}}"],
  },
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

function responseLanguage(contentType: string) {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("json")) return "json";
  if (normalized.includes("html")) return "html";
  if (normalized.includes("xml")) return "xml";
  if (normalized.includes("yaml") || normalized.includes("yml")) return "yaml";
  if (normalized.includes("css")) return "css";
  if (normalized.includes("javascript")) return "javascript";
  return "text";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isSuccessfulStatus(status: number) {
  return status >= 200 && status < 300;
}

function headerValue(headers: [string, string][], name: string) {
  return headers.find(([headerName]) => headerName.toLowerCase() === name.toLowerCase())?.[1];
}

function serializeRunnerProxyBody(body: BodyInit | undefined): RunnerProxyBody {
  if (body === undefined) return { bodyType: "none" };
  if (typeof body === "string") return { bodyType: "text", body };
  if (body instanceof URLSearchParams) {
    return { bodyType: "text", body: body.toString() };
  }
  if (body instanceof FormData) {
    return {
      bodyType: "form-data",
      body: Array.from(body.entries()).map(([name, value]) => [
        name,
        typeof value === "string" ? value : value.name,
      ]),
    };
  }
  return { bodyType: "text", body: String(body) };
}

function normalizeProxyHeaders(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is [unknown, unknown] => Array.isArray(item) && item.length >= 2)
    .map(([name, headerValue]) => [String(name), String(headerValue)]);
}

async function runnerProxyFetch({
  url,
  method,
  headers,
  body,
}: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: BodyInit;
}): Promise<RunnerProxyResponse> {
  const response = await fetch(RUNNER_PROXY_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      method,
      headers,
      ...serializeRunnerProxyBody(body),
    }),
  });
  const text = await response.text();
  const payload = parseJsonBody(text) as Partial<RunnerProxyResponse> | undefined;

  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Runner proxy failed with ${response.status} ${response.statusText}`.trim()
    );
  }

  if (!payload || typeof payload.status !== "number" || typeof payload.body !== "string") {
    throw new Error("Runner proxy returned an invalid response.");
  }

  return {
    status: payload.status,
    statusText: typeof payload.statusText === "string" ? payload.statusText : "",
    headers: normalizeProxyHeaders(payload.headers),
    body: payload.body,
  };
}

function quoteShellValue(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
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
        throw new Error(`Missing path parameter: ${param.name}`);
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
  const requestTab =
    value.requestTab === "headers" ||
    value.requestTab === "body" ||
    value.requestTab === "auth" ||
    value.requestTab === "scripts"
      ? value.requestTab
      : "params";
  const responseTab =
    value.responseTab === "raw" ||
    value.responseTab === "preview" ||
    value.responseTab === "headers"
      ? value.responseTab
      : "pretty";
  const auth = {
    ...DEFAULT_AUTH,
    ...(value.auth && typeof value.auth === "object" ? value.auth : {}),
  };
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
    requestTab,
    responseTab,
    auth,
    preScript: typeof value.preScript === "string" ? value.preScript : DEFAULT_PRE_SCRIPT,
    postScript: typeof value.postScript === "string" ? value.postScript : DEFAULT_POST_SCRIPT,
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

function consolePart(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function environmentValue(variables: EnvironmentVariable[], name: string) {
  return variables.find((item) => item.name === name)?.value;
}

function upsertEnvironmentValue(
  variables: EnvironmentVariable[],
  name: string,
  value: unknown
) {
  const normalizedName = normalizeVariableName(name);
  if (!normalizedName) return variables;
  const stringValue = stringifyEnvValue(value);
  const updatedAt = new Date().toISOString();
  const index = variables.findIndex((item) => item.name === normalizedName);
  if (index < 0) {
    return [
      ...variables,
      {
        id: makeRow().id,
        name: normalizedName,
        value: stringValue,
        updatedAt,
      },
    ].sort((a, b) => a.name.localeCompare(b.name));
  }
  return variables
    .map((item, itemIndex) =>
      itemIndex === index ? { ...item, value: stringValue, updatedAt } : item
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function removeEnvironmentValue(variables: EnvironmentVariable[], name: string) {
  const normalizedName = normalizeVariableName(name);
  return variables.filter((item) => item.name !== normalizedName);
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

function uniqueSuggestionOptions(options: SuggestionOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterSuggestionOptions(options: SuggestionOption[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options.slice(0, 12);
  return options
    .filter((option) => {
      const label = option.label ?? option.value;
      return (
        option.value.toLowerCase().includes(normalized) ||
        label.toLowerCase().includes(normalized) ||
        option.detail?.toLowerCase().includes(normalized)
      );
    })
    .sort((a, b) => {
      const aValue = a.value.toLowerCase();
      const bValue = b.value.toLowerCase();
      const aStarts = aValue.startsWith(normalized);
      const bStarts = bValue.startsWith(normalized);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.value.localeCompare(b.value);
    })
    .slice(0, 12);
}

function headerNameSuggestions() {
  return COMMON_HEADER_PRESETS.map((header) => ({
    value: header.name,
    label: header.name,
    detail: header.values[0] ? `${header.detail} · ${header.values[0]}` : header.detail,
  }));
}

function headerValueSuggestions(headerName: string, preferredContentType = "") {
  const normalized = headerName.trim().toLowerCase();
  const preset = COMMON_HEADER_PRESETS.find(
    (header) => header.name.toLowerCase() === normalized
  );
  const values =
    preset || normalized
      ? preset?.values ?? []
      : COMMON_HEADER_PRESETS.flatMap((header) => header.values);
  const preferred =
    normalized === "content-type" && preferredContentType.trim()
      ? [preferredContentType]
      : [];

  return uniqueSuggestionOptions(
    [...preferred, ...values].map((value) => ({
      value,
      label: value,
      detail: preset?.name ?? "Header value",
    }))
  );
}

function envTriggerAt(value: string, caret: number): EnvTrigger | null {
  const beforeCaret = value.slice(0, caret);
  const start = beforeCaret.lastIndexOf("{{");
  if (start < 0) return null;
  if (beforeCaret.lastIndexOf("}}") > start) return null;
  const rawQuery = beforeCaret.slice(start + 2);
  if (!/^\s*[\w.-]*$/.test(rawQuery)) return null;
  return { start, query: rawQuery.trimStart() };
}

function envReferenceSuggestions(variables: EnvironmentVariable[]) {
  return variables.map((variable) => ({
    value: `{{${variable.name}}}`,
    label: `{{${variable.name}}}`,
    detail: "environment variable",
  }));
}

function SuggestionMenu({
  options,
  activeIndex,
  onSelect,
}: {
  options: SuggestionOption[];
  activeIndex: number;
  onSelect: (option: SuggestionOption) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl">
      {options.map((option, index) => (
        <button
          key={`${option.value}-${index}`}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(option);
          }}
          className={`block w-full rounded px-2 py-1.5 text-left text-xs ${
            index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent"
          }`}
        >
          <span className="block truncate font-mono">{option.label ?? option.value}</span>
          {option.detail && (
            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
              {option.detail}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function AutocompleteInput({
  value,
  onChange,
  suggestions = [],
  envVariables = [],
  className,
  wrapperClassName,
  onBlur,
  onClick,
  onFocus,
  onKeyDown,
  ...inputProps
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className"> & {
  value: string;
  onChange: (value: string) => void;
  suggestions?: SuggestionOption[];
  envVariables?: EnvironmentVariable[];
  className?: string;
  wrapperClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(value.length);
  const [activeIndex, setActiveIndex] = useState(0);
  const trigger = envTriggerAt(value, caret);
  const envOptions = trigger
    ? filterSuggestionOptions(envReferenceSuggestions(envVariables), trigger.query)
    : [];
  const normalOptions = trigger ? [] : filterSuggestionOptions(suggestions, value);
  const options = trigger ? envOptions : normalOptions;
  const showMenu = focused && options.length > 0 && (Boolean(trigger) || suggestions.length > 0);

  const updateCaret = (target: HTMLInputElement) => {
    setCaret(target.selectionStart ?? target.value.length);
  };

  const selectOption = (option: SuggestionOption) => {
    const input = inputRef.current;
    const currentCaret = input?.selectionStart ?? caret;
    if (trigger) {
      const nextValue = `${value.slice(0, trigger.start)}${option.value}${value.slice(
        currentCaret
      )}`;
      const nextCaret = trigger.start + option.value.length;
      onChange(nextValue);
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(nextCaret, nextCaret);
        setCaret(nextCaret);
      });
    } else {
      onChange(option.value);
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(option.value.length, option.value.length);
        setCaret(option.value.length);
      });
    }
    setActiveIndex(0);
    setFocused(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (showMenu) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + options.length) % options.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectOption(options[activeIndex] ?? options[0]);
        return;
      }
      if (event.key === "Escape") {
        setFocused(false);
        return;
      }
    }
    onKeyDown?.(event);
  };

  return (
    <div className={`relative ${wrapperClassName ?? ""}`}>
      <input
        {...inputProps}
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          updateCaret(event.target);
          setFocused(true);
          setActiveIndex(0);
        }}
        onFocus={(event) => {
          setFocused(true);
          updateCaret(event.target);
          onFocus?.(event);
        }}
        onClick={(event) => {
          updateCaret(event.currentTarget);
          onClick?.(event);
        }}
        onKeyUp={(event) => updateCaret(event.currentTarget)}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className={className}
      />
      {showMenu && (
        <SuggestionMenu
          options={options}
          activeIndex={activeIndex}
          onSelect={selectOption}
        />
      )}
    </div>
  );
}

function EnvAutocompleteTextarea({
  value,
  onChange,
  envVariables = [],
  className,
  wrapperClassName,
  onBlur,
  onClick,
  onFocus,
  onKeyDown,
  ...textareaProps
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "className"> & {
  value: string;
  onChange: (value: string) => void;
  envVariables?: EnvironmentVariable[];
  className?: string;
  wrapperClassName?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(value.length);
  const [activeIndex, setActiveIndex] = useState(0);
  const trigger = envTriggerAt(value, caret);
  const options = trigger
    ? filterSuggestionOptions(envReferenceSuggestions(envVariables), trigger.query)
    : [];
  const showMenu = focused && options.length > 0 && Boolean(trigger);

  const updateCaret = (target: HTMLTextAreaElement) => {
    setCaret(target.selectionStart ?? target.value.length);
  };

  const selectOption = (option: SuggestionOption) => {
    const textarea = textareaRef.current;
    const currentCaret = textarea?.selectionStart ?? caret;
    if (!trigger) return;
    const nextValue = `${value.slice(0, trigger.start)}${option.value}${value.slice(
      currentCaret
    )}`;
    const nextCaret = trigger.start + option.value.length;
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
    setActiveIndex(0);
    setFocused(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMenu) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + options.length) % options.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectOption(options[activeIndex] ?? options[0]);
        return;
      }
      if (event.key === "Escape") {
        setFocused(false);
        return;
      }
    }
    onKeyDown?.(event);
  };

  return (
    <div className={`relative ${wrapperClassName ?? ""}`}>
      <textarea
        {...textareaProps}
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          updateCaret(event.target);
          setFocused(true);
          setActiveIndex(0);
        }}
        onFocus={(event) => {
          setFocused(true);
          updateCaret(event.target);
          onFocus?.(event);
        }}
        onClick={(event) => {
          updateCaret(event.currentTarget);
          onClick?.(event);
        }}
        onKeyUp={(event) => updateCaret(event.currentTarget)}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className={className}
      />
      {showMenu && (
        <SuggestionMenu
          options={options}
          activeIndex={activeIndex}
          onSelect={selectOption}
        />
      )}
    </div>
  );
}

function MiniTabs<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T;
  items: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex h-9 max-w-full items-center justify-start overflow-x-auto rounded-xl bg-muted p-[3px] text-muted-foreground">
      {items.map((item) => (
        <button
          type="button"
          key={item.value}
          onClick={() => onChange(item.value)}
          className={`inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-transparent px-3 py-1 text-sm font-medium transition-[color,box-shadow] focus-visible:outline-1 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 ${
            value === item.value
              ? "bg-card text-foreground shadow-sm dark:border-input dark:bg-input/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function EnvironmentPopover({
  variables,
  onChange,
  onClose,
}: {
  variables: EnvironmentVariable[];
  onChange: (variables: EnvironmentVariable[]) => void;
  onClose: () => void;
}) {
  const updateVariable = (id: string, patch: Partial<EnvironmentVariable>) => {
    const updatedAt = new Date().toISOString();
    onChange(
      variables.map((variable) =>
        variable.id === id ? { ...variable, ...patch, updatedAt } : variable
      )
    );
  };

  const addVariable = () => {
    let index = 1;
    let name = "var";
    while (variables.some((variable) => variable.name === name)) {
      index += 1;
      name = `var${index}`;
    }
    onChange([
      ...variables,
      {
        id: makeRow().id,
        name,
        value: "",
        updatedAt: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-[380px] rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-sm" style={{ fontWeight: 600 }}>
          Environment variables
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded hover:bg-accent"
          aria-label="Close environment variables"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto p-2">
        {variables.length ? (
          <div className="space-y-1">
            {variables.map((variable) => (
              <div key={variable.id} className="flex items-center gap-1">
                <input
                  value={variable.name}
                  onChange={(event) =>
                    updateVariable(variable.id, { name: event.target.value })
                  }
                  className="w-1/3 rounded border border-border bg-input-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  value={variable.value}
                  onChange={(event) =>
                    updateVariable(variable.id, { value: event.target.value })
                  }
                  className="min-w-0 flex-1 rounded border border-border bg-input-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange(variables.filter((item) => item.id !== variable.id))
                  }
                  className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove variable"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No variables yet. Add one here or save a response field.
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={addVariable}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="size-3" />
          Add
        </button>
        <span className="font-mono text-[11px] text-muted-foreground">
          {"{{name}}"} in URL/header/body
        </span>
      </div>
    </div>
  );
}

function KeyValueEditor({
  rows,
  emptyText,
  onChange,
  showEmptyState = true,
  keySuggestions = [],
  valueSuggestions = [],
  keyEnvVariables = [],
  valueEnvVariables = [],
}: {
  rows: KeyValueRow[];
  emptyText: string;
  onChange: (rows: KeyValueRow[]) => void;
  showEmptyState?: boolean;
  keySuggestions?: SuggestionOption[];
  valueSuggestions?: SuggestionOption[] | ((row: KeyValueRow) => SuggestionOption[]);
  keyEnvVariables?: EnvironmentVariable[];
  valueEnvVariables?: EnvironmentVariable[];
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
            <AutocompleteInput
              value={row.key}
              onChange={(key) => updateRow(row.id, { key })}
              placeholder="Key"
              suggestions={keySuggestions}
              envVariables={keyEnvVariables}
              wrapperClassName="min-w-0"
              className="w-full min-w-0 rounded-md border border-border bg-input-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <AutocompleteInput
              value={row.value}
              onChange={(value) => updateRow(row.id, { value })}
              placeholder="Value"
              suggestions={
                typeof valueSuggestions === "function"
                  ? valueSuggestions(row)
                  : valueSuggestions
              }
              envVariables={valueEnvVariables}
              wrapperClassName="min-w-0"
              className="w-full min-w-0 rounded-md border border-border bg-input-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
      ) : showEmptyState ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : null}
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

function ResponsePreview({ response }: { response: RunnerResponse }) {
  const body = response.rawBody || response.body;
  const contentType = response.contentType.toLowerCase();
  const parsedJson = contentType.includes("json") ? parseJsonBody(body) : undefined;

  if (!body.trim()) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        No response body.
      </div>
    );
  }

  if (contentType.includes("html")) {
    return (
      <iframe
        title="Response preview"
        srcDoc={body}
        sandbox=""
        className="h-[520px] w-full rounded-lg border border-border bg-white"
      />
    );
  }

  if (parsedJson && typeof parsedJson === "object") {
    const entries = Array.isArray(parsedJson)
      ? parsedJson.slice(0, 50).map((item, index) => [`[${index}]`, item] as const)
      : Object.entries(parsedJson as Record<string, unknown>).slice(0, 80);
    return (
      <div className="max-h-[520px] overflow-auto rounded-lg border border-border">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="grid grid-cols-[160px_1fr] gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0"
          >
            <div className="min-w-0 break-all font-mono text-muted-foreground">
              {key}
            </div>
            <div className="min-w-0 break-all font-mono">
              {previewValue(value)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
      {body}
    </pre>
  );
}

function ScriptEditor({
  value,
  onChange,
  rows = 8,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      rows={rows}
      className="w-full resize-y rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function formatJsonText(value: string) {
  return JSON.stringify(JSON.parse(value), null, 2);
}

function JsonEditor({
  value,
  onChange,
  envVariables = [],
  rows = 13,
}: {
  value: string;
  onChange: (value: string) => void;
  envVariables?: EnvironmentVariable[];
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
      setFormatError(e instanceof Error ? e.message : "Invalid JSON.");
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
        className="relative overflow-visible rounded-xl transition-all"
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
          <EnvAutocompleteTextarea
            value={value}
            onChange={(event) => {
              onChange(event);
              if (formatError) setFormatError(null);
            }}
            onKeyDown={onKeyDown}
            onScroll={onScroll}
            envVariables={envVariables}
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
          Invalid JSON: {formatError}
        </div>
      )}
      <div className="text-[11px] text-muted-foreground">
        Press <span className="font-mono">Alt + Shift + F</span> to format JSON.
      </div>
    </div>
  );
}

export function ApiRunner({
  endpoint,
  baseUrl,
  baseUrlOptions = [],
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
  baseUrlOptions?: string[];
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
  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [envOpen, setEnvOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleLog, setConsoleLog] = useState<ConsoleEntry[]>([]);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const envLoadedRef = useRef(false);
  const selectableBaseUrls = useMemo(
    () => Array.from(new Set([baseUrl, ...baseUrlOptions].filter(Boolean))),
    [baseUrl, baseUrlOptions]
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setBaseUrlInput(baseUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

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

  const setAuth = (auth: Partial<AuthConfig>) =>
    setValues((current) => ({ ...current, auth: { ...current.auth, ...auth } }));

  const pushConsole = (
    level: ConsoleEntry["level"],
    source: ConsoleEntry["source"],
    parts: unknown[]
  ) => {
    setConsoleLog((current) =>
      [
        ...current,
        {
          id: makeRow().id,
          time: Date.now(),
          level,
          source,
          parts: parts.map(consolePart),
        },
      ].slice(-200)
    );
  };

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

  const mergeEnvironmentUpdates = (
    current: EnvironmentVariable[],
    updates: { name: string; value: string }[]
  ) => {
    if (!updates.length) return current;
    const next = [...current];
    const updatedAt = new Date().toISOString();
    updates.forEach((update) => {
      const name = normalizeVariableName(update.name);
      if (!name) return;
      const existingIndex = next.findIndex((item) => item.name === name);
      const item = {
        id: existingIndex >= 0 ? next[existingIndex].id : makeRow().id,
        name,
        value: update.value,
        updatedAt,
      };
      if (existingIndex >= 0) {
        next[existingIndex] = item;
      } else {
        next.push(item);
      }
    });
    return next.sort((a, b) => a.name.localeCompare(b.name));
  };

  const saveEnvironmentVariables = (updates: { name: string; value: string }[]) => {
    if (!updates.length) return;
    setEnvironment((current) => mergeEnvironmentUpdates(current, updates));
  };

  const responseCaptureUpdates = (nextResponse: RunnerResponse) =>
    values.responseCaptures
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
    setConsoleLog([]);
    try {
      const activeEnvironment = envLoadedRef.current
        ? environment
        : readEnvironment(envKey, legacyEnvKey);
      if (!envLoadedRef.current) {
        setEnvironment(activeEnvironment);
        envLoadedRef.current = true;
      }
      let workingEnvironment = activeEnvironment;
      let workingUrl = buildUrl(baseUrlInput, endpoint, params, values, workingEnvironment);
      const requestHeaders: Record<string, string> = {};
      headers.forEach((header) => {
        const value = resolveEnvReferences(
          values.headers[header.name] ?? defaultHeaderValue(header, activeBody, bodyMode),
          workingEnvironment
        );
        if (value.trim()) requestHeaders[header.name] = value;
      });
      values.customHeaders
        .filter((row) => row.enabled && row.key.trim())
        .forEach((row) => {
          requestHeaders[row.key] = resolveEnvReferences(row.value, workingEnvironment);
        });

      const auth = values.auth;
      if (auth.type === "bearer" && auth.bearerToken.trim()) {
        requestHeaders.Authorization = `Bearer ${resolveEnvReferences(
          auth.bearerToken,
          workingEnvironment
        )}`;
      } else if (auth.type === "basic") {
        requestHeaders.Authorization = `Basic ${btoa(
          `${resolveEnvReferences(auth.basicUsername, workingEnvironment)}:${resolveEnvReferences(
            auth.basicPassword,
            workingEnvironment
          )}`
        )}`;
      } else if (auth.type === "api-key" && auth.apiKeyName.trim()) {
        const key = resolveEnvReferences(auth.apiKeyName, workingEnvironment);
        const value = resolveEnvReferences(auth.apiKeyValue, workingEnvironment);
        if (auth.apiKeyIn === "header") {
          requestHeaders[key] = value;
        } else {
          const url = new URL(workingUrl);
          url.searchParams.set(key, value);
          workingUrl = url.toString();
        }
      } else if (auth.type === "oauth2" && auth.oauth2AccessToken.trim()) {
        requestHeaders.Authorization = `Bearer ${resolveEnvReferences(
          auth.oauth2AccessToken,
          workingEnvironment
        )}`;
      }

      let requestBody = buildBody(workingEnvironment);
      if (
        requestBody.contentType &&
        !Object.keys(requestHeaders).some((name) => name.toLowerCase() === "content-type")
      ) {
        requestHeaders["Content-Type"] = requestBody.contentType;
      }
      let workingBody = typeof requestBody.body === "string" ? requestBody.body : "";
      let bodyOverriddenByScript = false;

      const makeEnvironmentApi = () => ({
        get: (name: string) => environmentValue(workingEnvironment, name),
        set: (name: string, value: unknown) => {
          workingEnvironment = upsertEnvironmentValue(workingEnvironment, name, value);
        },
        unset: (name: string) => {
          workingEnvironment = removeEnvironmentValue(workingEnvironment, name);
        },
        all: () =>
          Object.fromEntries(workingEnvironment.map((item) => [item.name, item.value])),
      });

      const pmPre = {
        environment: makeEnvironmentApi(),
        request: {
          method: endpoint.method,
          get url() {
            return workingUrl;
          },
          set url(value: string) {
            workingUrl = value;
          },
          headers: {
            set: (name: string, value: string) => {
              requestHeaders[name] = value;
            },
            get: (name: string) =>
              Object.entries(requestHeaders).find(
                ([key]) => key.toLowerCase() === name.toLowerCase()
              )?.[1],
            remove: (name: string) => {
              const key = Object.keys(requestHeaders).find(
                (item) => item.toLowerCase() === name.toLowerCase()
              );
              if (key) delete requestHeaders[key];
            },
            all: () => ({ ...requestHeaders }),
          },
          get body() {
            return workingBody;
          },
          set body(value: string) {
            workingBody = String(value);
            bodyOverriddenByScript = true;
          },
        },
      };
      pushConsole("info", "system", [`Send ${endpoint.method} ${endpoint.path}`]);
      const preResult = runScript(
        values.preScript,
        "pre",
        pmPre as unknown as Record<string, unknown>,
        workingEnvironment
      );
      if (!preResult.ok) {
        setLoading(false);
        return;
      }

      if (bodyOverriddenByScript) {
        requestBody = { body: workingBody, contentType: requestBody.contentType };
      } else {
        requestBody = buildBody(workingEnvironment);
      }

      // eslint-disable-next-line react-hooks/purity
      const started = performance.now();
      const canSendBody = !["GET", "HEAD"].includes(endpoint.method);
      const resolvedUrl = resolveEnvReferences(workingUrl, workingEnvironment);
      const resolvedHeaders = Object.fromEntries(
        Object.entries(requestHeaders).map(([name, value]) => [
          resolveEnvReferences(name, workingEnvironment),
          resolveEnvReferences(value, workingEnvironment),
        ])
      );
      const proxyResponse = await runnerProxyFetch({
        url: resolvedUrl,
        method: endpoint.method,
        headers: resolvedHeaders,
        body: canSendBody ? requestBody.body : undefined,
      });
      const text = proxyResponse.body;
      const responseContentType = headerValue(proxyResponse.headers, "content-type") ?? "";
      const nextResponse: RunnerResponse = {
        status: proxyResponse.status,
        statusText: proxyResponse.statusText,
        // eslint-disable-next-line react-hooks/purity
        durationMs: Math.round(performance.now() - started),
        size: new Blob([text]).size,
        headers: proxyResponse.headers,
        body: formatResponseBody(text, responseContentType),
        rawBody: text,
        contentType: responseContentType,
      };
      setResponse(nextResponse);
      const captureUpdates = responseCaptureUpdates(nextResponse);
      workingEnvironment = mergeEnvironmentUpdates(workingEnvironment, captureUpdates);
      setValues((current) => ({ ...current, responseTab: "pretty" }));
      pushConsole("info", "system", [
        `Response ${nextResponse.status} ${nextResponse.statusText} - ${
          nextResponse.durationMs
        } ms - ${formatSize(nextResponse.size)}`,
      ]);

      const pmPost = {
        environment: makeEnvironmentApi(),
        response: {
          status: nextResponse.status,
          statusText: nextResponse.statusText,
          ok: isSuccessfulStatus(nextResponse.status),
          headers: Object.fromEntries(nextResponse.headers),
          text: nextResponse.rawBody,
          json: () => parseJsonBody(nextResponse.rawBody) ?? null,
        },
      };
      runScript(
        values.postScript,
        "post",
        pmPost as unknown as Record<string, unknown>,
        workingEnvironment
      );
      updateEnvironmentVariables(workingEnvironment);
    } catch (e: unknown) {
      pushConsole("error", "system", [
        e instanceof Error ? e.message : "Could not send the request.",
      ]);
      setError(
        e instanceof Error
          ? e.message
          : "Could not send the request. If the API is on another domain, check CORS."
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
      return buildUrl(baseUrlInput, endpoint, params, values, environment);
    } catch (e: unknown) {
      return e instanceof Error ? e.message : "";
    }
  }, [baseUrlInput, endpoint, environment, params, values]);

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

  const updateEnvironmentVariables = (next: EnvironmentVariable[]) => {
    const normalized = next
      .map((item) => ({
        ...item,
        name: normalizeVariableName(item.name),
        updatedAt: item.updatedAt || new Date().toISOString(),
      }))
      .filter((item) => item.name);
    const sorted = normalized.sort((a, b) => a.name.localeCompare(b.name));
    setEnvironment(sorted);
    try {
      localStorage.setItem(envKey, JSON.stringify(sorted));
    } catch {
      // ignore
    }
  };

  const copyText = async (text: string, key: string) => {
    const markCopied = (value: string) => {
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    };
    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copiedWithFallback = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!copiedWithFallback) throw new Error("Could not copy text.");
    };

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy();
      }
      markCopied(key);
    } catch {
      try {
        fallbackCopy();
        markCopied(key);
      } catch {
        markCopied(`${key}-error`);
      }
    }
  };

  const runScript = (
    code: string,
    source: "pre" | "post",
    pm: Record<string, unknown>,
    currentEnvironment: EnvironmentVariable[]
  ) => {
    const trimmed = code.trim();
    if (!trimmed || /^(\/\/.*\n?)+$/.test(trimmed)) {
      return { environment: currentEnvironment, ok: true };
    }

    const sandboxConsole = {
      log: (...parts: unknown[]) => pushConsole("log", source, parts),
      info: (...parts: unknown[]) => pushConsole("info", source, parts),
      warn: (...parts: unknown[]) => pushConsole("warn", source, parts),
      error: (...parts: unknown[]) => pushConsole("error", source, parts),
    };

    try {
      const fn = new Function("pm", "console", code);
      fn(pm, sandboxConsole);
      return { environment: currentEnvironment, ok: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      pushConsole("error", source, [message]);
      return { environment: currentEnvironment, ok: false };
    }
  };

  const fetchOAuthToken = async () => {
    const auth = values.auth;
    if (!auth.oauth2TokenUrl.trim()) {
      pushConsole("error", "system", ["OAuth2 token URL is required."]);
      return;
    }
    setOauthLoading(true);
    try {
      const body = new URLSearchParams();
      body.set("grant_type", "client_credentials");
      if (auth.oauth2ClientId) body.set("client_id", resolveEnvReferences(auth.oauth2ClientId, environment));
      if (auth.oauth2ClientSecret) {
        body.set("client_secret", resolveEnvReferences(auth.oauth2ClientSecret, environment));
      }
      if (auth.oauth2Scope) body.set("scope", resolveEnvReferences(auth.oauth2Scope, environment));
      const response = await runnerProxyFetch({
        url: resolveEnvReferences(auth.oauth2TokenUrl, environment),
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const text = response.body;
      const json = parseJsonBody(text) as Record<string, unknown> | undefined;
      const token = typeof json?.access_token === "string" ? json.access_token : "";
      if (!isSuccessfulStatus(response.status) || !token) {
        throw new Error(
          token
            ? `${response.status} ${response.statusText}`
            : "Token response does not include access_token."
        );
      }
      setAuth({ oauth2AccessToken: token });
      pushConsole("info", "system", ["OAuth2 token saved."]);
    } catch (error: unknown) {
      pushConsole("error", "system", [
        error instanceof Error ? error.message : "Could not fetch OAuth2 token.",
      ]);
    } finally {
      setOauthLoading(false);
    }
  };

  const requestPathPreview = useMemo(() => {
    try {
      const url = new URL(
        buildUrl("https://api-docs.local", endpoint, params, values, environment)
      );
      return `${url.pathname}${url.search}`;
    } catch {
      return endpoint.path;
    }
  }, [endpoint, environment, params, values]);

  const curlText = useMemo(() => {
    const lines = [`curl -X ${endpoint.method} ${quoteShellValue(requestUrlPreview || baseUrlInput)}`];
    const headerNames = new Set<string>();
    const pushHeader = (name: string, value: string) => {
      if (!name.trim() || !value.trim()) return;
      headerNames.add(name.toLowerCase());
      lines.push(`  -H ${quoteShellValue(`${name}: ${value}`)}`);
    };

    visibleHeaders.forEach(({ param, value }) =>
      pushHeader(param.name, resolveEnvReferences(value, environment))
    );
    values.customHeaders
      .filter((row) => row.enabled && row.key.trim())
      .forEach((row) => pushHeader(row.key, resolveEnvReferences(row.value, environment)));

    const canSendBody = !["GET", "HEAD"].includes(endpoint.method);
    if (canSendBody && bodyMode !== "none") {
      if (bodyMode === "json") {
        const contentType = contentTypeForMode("json", activeBody, values);
        if (contentType && !headerNames.has("content-type")) pushHeader("Content-Type", contentType);
        lines.push(
          `  --data-raw ${quoteShellValue(resolveEnvReferences(getJsonBodyText(activeBody, values), environment))}`
        );
      } else if (bodyMode === "raw") {
        const contentType = contentTypeForMode("raw", activeBody, values);
        if (contentType && !headerNames.has("content-type")) pushHeader("Content-Type", contentType);
        lines.push(
          `  --data-raw ${quoteShellValue(
            resolveEnvReferences(values.rawBody || stringifyExample(activeBody?.example), environment)
          )}`
        );
      } else if (bodyMode === "form-urlencoded") {
        if (!headerNames.has("content-type")) {
          pushHeader("Content-Type", "application/x-www-form-urlencoded");
        }
        formUrlRows
          .filter((row) => row.enabled && row.key.trim())
          .forEach((row) =>
            lines.push(
              `  --data-urlencode ${quoteShellValue(
                `${row.key}=${resolveEnvReferences(row.value, environment)}`
              )}`
            )
          );
      } else if (bodyMode === "form-data") {
        formDataRows
          .filter((row) => row.enabled && row.key.trim())
          .forEach((row) =>
            lines.push(
              `  -F ${quoteShellValue(`${row.key}=${resolveEnvReferences(row.value, environment)}`)}`
            )
          );
      }
    }

    return lines.join(" \\\n");
  }, [
    activeBody,
    baseUrlInput,
    bodyMode,
    endpoint.method,
    environment,
    formDataRows,
    formUrlRows,
    requestUrlPreview,
    values,
    visibleHeaders,
  ]);

  return (
    <aside
      className="fixed right-0 top-0 z-40 flex h-screen w-full max-w-[680px] flex-col border-l border-border bg-sidebar text-sidebar-foreground shadow-2xl"
      style={{ boxShadow: "-8px 0 32px rgba(0,0,0,0.25)" }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm" style={{ fontWeight: 600 }}>
            API Runner
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {endpoint.summary}
          </div>
        </div>
        <div className="relative flex shrink-0 flex-nowrap items-center gap-1">
          <button
            type="button"
            onClick={() => setConsoleOpen((open) => !open)}
            className={`flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-xs ${
              consoleOpen
                ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                : "border-border hover:bg-accent"
            }`}
            title="Console"
          >
            <Terminal className="size-3.5 shrink-0" />
            Console{consoleLog.length ? ` (${consoleLog.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setEnvOpen((open) => !open)}
            className={`flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-xs ${
              envOpen
                ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border hover:bg-accent"
            }`}
            title="Environment variables"
          >
            <Variable className="size-3.5 shrink-0" />
            Env{environment.length ? ` (${environment.length})` : ""}
          </button>
          {envOpen && (
            <EnvironmentPopover
              variables={environment}
              onChange={updateEnvironmentVariables}
              onClose={() => setEnvOpen(false)}
            />
          )}
          <button
            type="button"
            onClick={() => copyText(curlText, "curl")}
            className={`flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-xs hover:bg-accent ${
              copied === "curl-error"
                ? "border-destructive text-destructive"
                : "border-border"
            }`}
            title={
              copied === "curl"
                ? "Copied cURL command"
                : copied === "curl-error"
                  ? "Could not copy cURL command"
                  : "Copy as cURL"
            }
          >
            {copied === "curl" ? (
              <Check className="size-3.5 shrink-0 text-emerald-500" />
            ) : copied === "curl-error" ? (
              <AlertCircle className="size-3.5 shrink-0" />
            ) : (
              <Terminal className="size-3.5 shrink-0" />
            )}
            {copied === "curl"
              ? "Copied"
              : copied === "curl-error"
                ? "Copy failed"
                : "cURL"}
          </button>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close runner"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MethodBadge method={endpoint.method} compact />
          <div className="relative w-56 min-w-0">
            <input
              list="runner-base-url-options"
              value={baseUrlInput}
              onChange={(e) => setBaseUrlInput(e.target.value)}
              placeholder="Base URL"
              className="w-full rounded-md border border-border bg-input-background py-1.5 pl-2 pr-7 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <datalist id="runner-base-url-options">
              {selectableBaseUrls.map((url) => (
                <option key={url} value={url} />
              ))}
            </datalist>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          </div>
          <code className="min-w-0 flex-1 truncate rounded-md bg-muted/50 px-2 py-1.5 font-mono text-xs">
            {requestPathPreview}
          </code>
          <button
            type="button"
            onClick={() => copyText(requestUrlPreview, "url")}
            className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-accent"
            title="Copy URL"
          >
            {copied === "url" ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
          <button
            onClick={send}
            disabled={loading}
            className="flex h-8 items-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 px-3 text-sm text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </button>
        </div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {requestUrlPreview}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <MiniTabs<RequestTab>
          value={values.requestTab}
          onChange={setRequestTab}
          items={[
            { value: "params", label: "Params" },
            { value: "headers", label: "Headers" },
            { value: "body", label: "Body" },
            { value: "auth", label: "Auth" },
            { value: "scripts", label: "Script" },
          ]}
        />

        {values.requestTab === "params" && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            {visibleSpecParams.length > 0 && (
              <div className="space-y-2">
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
                        <AutocompleteInput
                          value={values.params[id] ?? defaultParamValue(param)}
                          onChange={(value) => setParam(param, value)}
                          placeholder={param.description || param.type}
                          disabled={!enabled}
                          envVariables={environment}
                          wrapperClassName="min-w-0"
                          className="w-full min-w-0 rounded-md border border-border bg-input-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                        />
                        <button
                          onClick={() => hideParam(param)}
                          disabled={isPath}
                          className="size-9 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 flex items-center justify-center"
                          aria-label="Remove param"
                          title={isPath ? "Path parameters cannot be removed" : "Remove parameter"}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                Restore {hiddenSpecQueryParams.length} removed parameters
              </button>
            )}

            <KeyValueEditor
              rows={values.customParams}
              emptyText="No custom query params."
              showEmptyState={visibleSpecParams.length === 0}
              valueEnvVariables={environment}
              onChange={(customParams) =>
                setValues((current) => ({ ...current, customParams }))
              }
            />
          </div>
        )}

        {values.requestTab === "headers" && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            {visibleHeaders.length > 0 && (
              <div className="space-y-2">
                {visibleHeaders.map(({ param, value, helper }) => (
                  <label key={param.name} className="block">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{param.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {param.required ? "required" : "optional"}
                      </span>
                    </div>
                    <AutocompleteInput
                      value={value}
                      onChange={(nextValue) => setHeader(param, nextValue)}
                      placeholder={helper}
                      suggestions={headerValueSuggestions(
                        param.name,
                        contentTypeForMode(bodyMode, activeBody, values) ||
                          activeBody?.contentType ||
                          ""
                      )}
                      envVariables={environment}
                      className="w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                ))}
              </div>
            )}

            <KeyValueEditor
              rows={values.customHeaders}
              emptyText="No custom headers."
              showEmptyState={visibleHeaders.length === 0}
              keySuggestions={headerNameSuggestions()}
              valueSuggestions={(row) =>
                headerValueSuggestions(
                  row.key,
                  contentTypeForMode(bodyMode, activeBody, values) || activeBody?.contentType || ""
                )
              }
              keyEnvVariables={environment}
              valueEnvVariables={environment}
              onChange={(customHeaders) =>
                setValues((current) => ({ ...current, customHeaders }))
              }
            />
          </div>
        )}

        {values.requestTab === "body" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Body type</div>
              <MiniTabs<BodyMode>
                value={bodyMode}
                onChange={setBodyMode}
                items={BODY_MODES.map((mode) => ({
                  value: mode.value,
                  label: (
                    <>
                      {mode.icon}
                      {mode.label}
                    </>
                  ),
                }))}
              />
            </div>

            {bodies.length > 1 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Spec media type</div>
                <MiniTabs<string>
                  value={activeBody?.contentType ?? bodies[0]?.contentType ?? ""}
                  onChange={onBodyChange}
                  items={bodies.map((body) => ({
                    value: body.contentType,
                    label: <span className="font-mono text-xs">{body.contentType}</span>,
                  }))}
                />
              </div>
            )}

            {bodyMode === "none" && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                This request will be sent without a body.
              </div>
            )}

            {bodyMode === "json" && (
              <JsonEditor
                value={getJsonBodyText(activeBody, values)}
                onChange={setJsonBody}
                envVariables={environment}
              />
            )}

            {bodyMode === "raw" && (
              <div className="space-y-2">
                <AutocompleteInput
                  value={values.rawContentType}
                  onChange={(rawContentType) =>
                    setValues((current) => ({
                      ...current,
                      rawContentType,
                    }))
                  }
                  placeholder="text/plain"
                  suggestions={headerValueSuggestions(
                    "Content-Type",
                    activeBody?.contentType || ""
                  )}
                  className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <EnvAutocompleteTextarea
                  value={values.rawBody || stringifyExample(activeBody?.example)}
                  onChange={(rawBody) =>
                    setValues((current) => ({ ...current, rawBody }))
                  }
                  envVariables={environment}
                  spellCheck={false}
                  rows={13}
                  className="w-full resize-y rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {bodyMode === "form-data" && (
              <KeyValueEditor
                rows={formDataRows}
                emptyText="No form-data fields yet."
                valueEnvVariables={environment}
                onChange={(formDataRows) =>
                  setValues((current) => ({ ...current, formDataRows }))
                }
              />
            )}

            {bodyMode === "form-urlencoded" && (
              <KeyValueEditor
                rows={formUrlRows}
                emptyText="No form-urlencoded fields yet."
                valueEnvVariables={environment}
                onChange={(formUrlRows) =>
                  setValues((current) => ({ ...current, formUrlRows }))
                }
              />
            )}
          </div>
        )}

        {values.requestTab === "auth" && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs text-muted-foreground">Auth type</span>
              {(["none", "bearer", "basic", "api-key", "oauth2"] as AuthType[]).map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setAuth({ type })}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    values.auth.type === type
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {values.auth.type === "none" && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                This request will be sent without auth.
              </div>
            )}

            {values.auth.type === "bearer" && (
              <label className="block space-y-1.5">
                <span className="text-xs text-muted-foreground">Bearer token</span>
                <AutocompleteInput
                  value={values.auth.bearerToken}
                  onChange={(bearerToken) => setAuth({ bearerToken })}
                  placeholder="eyJ... or {{token}}"
                  envVariables={environment}
                  className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="block text-[11px] text-muted-foreground">
                  Adds <span className="font-mono">Authorization: Bearer token</span>.
                </span>
              </label>
            )}

            {values.auth.type === "basic" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted-foreground">Username</span>
                  <AutocompleteInput
                    value={values.auth.basicUsername}
                    onChange={(basicUsername) => setAuth({ basicUsername })}
                    envVariables={environment}
                    className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted-foreground">Password</span>
                  <AutocompleteInput
                    type="password"
                    value={values.auth.basicPassword}
                    onChange={(basicPassword) => setAuth({ basicPassword })}
                    envVariables={environment}
                    className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>
            )}

            {values.auth.type === "api-key" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs text-muted-foreground">Key</span>
                    <AutocompleteInput
                      value={values.auth.apiKeyName}
                      onChange={(apiKeyName) => setAuth({ apiKeyName })}
                      suggestions={
                        values.auth.apiKeyIn === "header" ? headerNameSuggestions() : []
                      }
                      envVariables={environment}
                      className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs text-muted-foreground">Value</span>
                    <AutocompleteInput
                      value={values.auth.apiKeyValue}
                      onChange={(apiKeyValue) => setAuth({ apiKeyValue })}
                      placeholder="{{api_key}}"
                      envVariables={environment}
                      className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Add to</span>
                  {(["header", "query"] as const).map((place) => (
                    <label key={place} className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        checked={values.auth.apiKeyIn === place}
                        onChange={() => setAuth({ apiKeyIn: place })}
                      />
                      {place}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {values.auth.type === "oauth2" && (
              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted-foreground">Access token</span>
                  <AutocompleteInput
                    value={values.auth.oauth2AccessToken}
                    onChange={(oauth2AccessToken) => setAuth({ oauth2AccessToken })}
                    placeholder="{{access_token}}"
                    envVariables={environment}
                    className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <div className="rounded-md border border-border bg-background/60 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      Client Credentials token helper
                    </div>
                    <button
                      type="button"
                      onClick={fetchOAuthToken}
                      disabled={oauthLoading}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      {oauthLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      Get token
                    </button>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs text-muted-foreground">Token URL</span>
                    <AutocompleteInput
                      value={values.auth.oauth2TokenUrl}
                      onChange={(oauth2TokenUrl) => setAuth({ oauth2TokenUrl })}
                      placeholder="https://auth.example.com/oauth/token"
                      envVariables={environment}
                      className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-xs text-muted-foreground">Client ID</span>
                      <AutocompleteInput
                        value={values.auth.oauth2ClientId}
                        onChange={(oauth2ClientId) => setAuth({ oauth2ClientId })}
                        envVariables={environment}
                        className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs text-muted-foreground">Client secret</span>
                      <AutocompleteInput
                        type="password"
                        value={values.auth.oauth2ClientSecret}
                        onChange={(oauth2ClientSecret) => setAuth({ oauth2ClientSecret })}
                        envVariables={environment}
                        className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs text-muted-foreground">Scope</span>
                    <AutocompleteInput
                      value={values.auth.oauth2Scope}
                      onChange={(oauth2Scope) => setAuth({ oauth2Scope })}
                      placeholder="read write"
                      envVariables={environment}
                      className="w-full rounded-md border border-border bg-input-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {values.requestTab === "scripts" && (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Pre-request script
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  pm.environment / pm.request
                </span>
              </div>
              <ScriptEditor
                value={values.preScript}
                onChange={(preScript) => setValues((current) => ({ ...current, preScript }))}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Post-response script
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  pm.environment / pm.response
                </span>
              </div>
              <ScriptEditor
                value={values.postScript}
                onChange={(postScript) => setValues((current) => ({ ...current, postScript }))}
              />
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <code className="font-mono">pm.environment.set(name, value)</code> ·{" "}
              <code className="font-mono">pm.environment.get(name)</code>
              <br />
              <code className="font-mono">pm.request.headers.set(k, v)</code> ·{" "}
              <code className="font-mono">pm.request.body = &quot;...&quot;</code>
              <br />
              <code className="font-mono">pm.response.json()</code> ·{" "}
              <code className="font-mono">pm.response.status</code> ·{" "}
              <code className="font-mono">console.log(...)</code>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={resetCurrentEndpoint}
            className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Reset saved values"
          >
            <RotateCcw className="size-4" />
            Reset
          </button>
        </div>

        {response && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={response.status} />
                <span className="text-sm">{response.statusText || "Response"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {response.durationMs} ms · {formatSize(response.size)}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(response.rawBody || response.body, "response")}
                  className="flex h-7 items-center gap-1 rounded-md border border-border px-2 hover:bg-accent hover:text-foreground"
                >
                  {copied === "response" ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  Copy
                </button>
              </div>
            </div>

            <MiniTabs<ResponseTab>
              value={values.responseTab}
              onChange={setResponseTab}
              items={[
                { value: "pretty", label: "Pretty" },
                { value: "raw", label: "Raw" },
                { value: "preview", label: "Preview" },
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

            {values.responseTab === "pretty" && (
              <div className="max-h-[520px] overflow-auto rounded-xl">
                <CodeBlock
                  code={response.body || "// No content"}
                  language={responseLanguage(response.contentType)}
                />
              </div>
            )}

            {values.responseTab === "raw" && (
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
                {response.rawBody || response.body || "// No content"}
              </pre>
            )}

            {values.responseTab === "preview" && <ResponsePreview response={response} />}

            {values.responseTab === "headers" && (
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
      {consoleOpen && (
        <div className="flex h-56 flex-col border-t border-sidebar-border bg-[#0d1117] text-[#e6edf3]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <Terminal className="size-3.5 text-sky-400" />
              <span style={{ fontWeight: 600 }}>Console</span>
              <span className="text-muted-foreground">{consoleLog.length} entries</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConsoleLog([])}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setConsoleOpen(false)}
                className="flex size-6 items-center justify-center rounded hover:bg-white/10"
                aria-label="Close console"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 font-mono text-[11px] leading-5">
            {consoleLog.length === 0 ? (
              <div className="px-1 text-muted-foreground italic">No logs yet.</div>
            ) : (
              consoleLog.map((entry) => {
                const levelClass =
                  entry.level === "error"
                    ? "text-rose-400"
                    : entry.level === "warn"
                      ? "text-amber-400"
                      : entry.level === "info"
                        ? "text-sky-400"
                        : "text-[#e6edf3]";
                const sourceClass =
                  entry.source === "pre"
                    ? "text-fuchsia-400"
                    : entry.source === "post"
                      ? "text-emerald-400"
                      : "text-muted-foreground";
                const tag =
                  entry.source === "pre"
                    ? "[pre]"
                    : entry.source === "post"
                      ? "[post]"
                      : "[sys]";
                return (
                  <div key={entry.id} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground/70">
                      {new Date(entry.time).toLocaleTimeString()}
                    </span>
                    <span className={`shrink-0 ${sourceClass}`}>{tag}</span>
                    <span className={`break-all ${levelClass}`}>{entry.parts.join(" ")}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
