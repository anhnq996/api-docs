"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  History,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Moon,
  Play,
  Plus,
  Save,
  Search,
  Sun,
  Trash2,
  UserPlus,
  Workflow as WorkflowIcon,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MemberAvatars, MemberPickerModal } from "@/components/MemberPickerModal";
import { HistoryView, MultiWorkflowRunner } from "@/components/workflow/WorkflowRuntimeViews";
import { useTheme } from "@/components/ThemeProvider";
import { getAuthUser, logout, type AuthUser } from "@/lib/auth";
import type { Endpoint, HttpMethod } from "@/lib/data/apiSpec";
import { loadProjects, type Project } from "@/lib/data/projects";
import {
  kv,
  makeBlankStep,
  makeBlankWorkflow,
  makeStepFromEndpoint,
  type Assertion,
  type AssertionResult,
  type AssertionOp,
  type AssertionType,
  type BodyMode,
  type CallRecord,
  type KeyValue,
  type RawBodyType,
  type StepRunResult,
  type StepStatus,
  type Workflow,
  type WorkflowGlobalConfig,
  type WorkflowRunResult,
  type WorkflowRunStatus,
  type WorkflowStep,
} from "@/lib/data/workflowData";
import {
  deleteWorkflow,
  loadWorkflows,
  updateWorkflowMembers,
  upsertWorkflow,
} from "@/lib/data/workflows";
import {
  headerValue,
  parseJsonBody,
  runnerProxyFetch,
  type RunnerProxyResponse,
} from "@/lib/runnerProxy";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const BODY_MODES: BodyMode[] = ["none", "raw", "form-data", "url-encoded"];
const RAW_TYPES: RawBodyType[] = ["json", "xml", "text"];
const ASSERTION_TYPES: { value: AssertionType; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "responseTime", label: "Response time" },
  { value: "header", label: "Header" },
  { value: "jsonField", label: "JSON field" },
  { value: "bodyContains", label: "Body contains" },
];
const ASSERTION_OPS: { value: AssertionOp; label: string }[] = [
  { value: "eq", label: "=" },
  { value: "ne", label: "!=" },
  { value: "lt", label: "<" },
  { value: "gt", label: ">" },
  { value: "lte", label: "<=" },
  { value: "gte", label: ">=" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "exists" },
];

type MainView = "builder" | "multi-run" | "history";

type SuggestionOption = {
  value: string;
  label?: string;
  detail?: string;
};

type EnvTrigger = {
  start: number;
  query: string;
};

const VIEW_TABS: { id: MainView; label: string; Icon: LucideIcon }[] = [
  { id: "builder", label: "Builder", Icon: Layers },
  { id: "multi-run", label: "Run workflows", Icon: Zap },
  { id: "history", label: "History", Icon: History },
];

const WORKFLOW_HISTORY_STORAGE_VERSION = 1;

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  POST: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  PUT: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  PATCH: "text-violet-500 bg-violet-500/10 border-violet-500/30",
  DELETE: "text-red-500 bg-red-500/10 border-red-500/30",
};

const RUN_STATUS_UI: Record<WorkflowRunStatus, string> = {
  idle: "text-muted-foreground bg-muted",
  queued: "text-muted-foreground bg-muted",
  running: "text-blue-500 bg-blue-500/10",
  passed: "text-emerald-500 bg-emerald-500/10",
  failed: "text-red-500 bg-red-500/10",
  cancelled: "text-muted-foreground bg-muted",
};

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function workflowHistoryStorageKey(userId: string) {
  return `api-docs.workflow-history.v${WORKFLOW_HISTORY_STORAGE_VERSION}.${userId}`;
}

function loadStoredWorkflowHistory(userId: string) {
  try {
    const raw = localStorage.getItem(workflowHistoryStorageKey(userId));
    if (!raw) return { runResults: [], callHistory: [] };
    const parsed = JSON.parse(raw) as {
      runResults?: WorkflowRunResult[];
      callHistory?: CallRecord[];
    };
    return {
      runResults: Array.isArray(parsed.runResults) ? parsed.runResults : [],
      callHistory: Array.isArray(parsed.callHistory) ? parsed.callHistory : [],
    };
  } catch {
    return { runResults: [], callHistory: [] };
  }
}

function saveStoredWorkflowHistory(
  userId: string,
  runResults: WorkflowRunResult[],
  callHistory: CallRecord[]
) {
  try {
    localStorage.setItem(
      workflowHistoryStorageKey(userId),
      JSON.stringify({
        runResults: runResults.slice(0, 100),
        callHistory: callHistory.slice(0, 1000),
      })
    );
  } catch {
    // Ignore storage quota/private mode failures; history still works in memory.
  }
}

function asNumber(value: string, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function allEndpoints(project: Project | null) {
  return project
    ? project.spec.tags.flatMap((tag) =>
        tag.endpoints.map((endpoint) => ({
          ...endpoint,
          tagName: tag.name,
        }))
      )
    : [];
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

function headerValueSuggestions(headerName: string) {
  const normalized = headerName.trim().toLowerCase();
  const preset = COMMON_HEADER_PRESETS.find(
    (header) => header.name.toLowerCase() === normalized
  );
  const values =
    preset || normalized
      ? preset?.values ?? []
      : COMMON_HEADER_PRESETS.flatMap((header) => header.values);

  return uniqueSuggestionOptions(
    values.map((value) => ({
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

function envReferenceSuggestions(env: Record<string, string>) {
  return Object.keys(env).map((name) => ({
    value: `{{${name}}}`,
    label: `{{${name}}}`,
    detail: "workflow environment variable",
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
  env = {},
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
  env?: Record<string, string>;
  className?: string;
  wrapperClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(value.length);
  const [activeIndex, setActiveIndex] = useState(0);
  const trigger = envTriggerAt(value, caret);
  const envOptions = trigger
    ? filterSuggestionOptions(envReferenceSuggestions(env), trigger.query)
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

function KeyValueRows({
  rows,
  onChange,
  valuePlaceholder = "value",
  keySuggestions = [],
  valueSuggestions = [],
  env = {},
}: {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  valuePlaceholder?: string;
  keySuggestions?: SuggestionOption[];
  valueSuggestions?: SuggestionOption[] | ((row: KeyValue) => SuggestionOption[]);
  env?: Record<string, string>;
}) {
  const update = (id: string, patch: Partial<KeyValue>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[18px_1fr_1fr_28px] gap-2 items-center">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(event) => update(row.id, { enabled: event.target.checked })}
            className="accent-primary"
            aria-label="Enable row"
          />
          <AutocompleteInput
            value={row.key}
            onChange={(key) => update(row.id, { key })}
            placeholder="key"
            suggestions={keySuggestions}
            env={env}
            wrapperClassName="min-w-0"
            className="w-full min-w-0 rounded-md border border-border bg-input-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <AutocompleteInput
            value={row.value}
            onChange={(value) => update(row.id, { value })}
            placeholder={valuePlaceholder}
            suggestions={
              typeof valueSuggestions === "function" ? valueSuggestions(row) : valueSuggestions
            }
            env={env}
            wrapperClassName="min-w-0"
            className="w-full min-w-0 rounded-md border border-border bg-input-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
            className="size-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
            aria-label="Remove row"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...rows, kv()])}
        className="h-8 px-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5"
      >
        <Plus className="size-3" /> Add row
      </button>
    </div>
  );
}

function EnvRows({
  env,
  onChange,
}: {
  env: Record<string, string>;
  onChange: (env: Record<string, string>) => void;
}) {
  const entries = Object.entries(env);

  const update = (index: number, key: string, value: string) => {
    const next = [...entries];
    next[index] = [key, value];
    onChange(Object.fromEntries(next.filter(([entryKey]) => entryKey.trim())));
  };

  return (
    <div className="space-y-1.5">
      {entries.map(([key, value], index) => (
        <div key={`${key}-${index}`} className="grid grid-cols-[1fr_1fr_28px] gap-2">
          <input
            value={key}
            onChange={(event) => update(index, event.target.value, value)}
            placeholder="variable"
            className="min-w-0 rounded-md border border-border bg-input-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={value}
            onChange={(event) => update(index, key, event.target.value)}
            placeholder="value"
            className="min-w-0 rounded-md border border-border bg-input-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() =>
              onChange(Object.fromEntries(entries.filter((_, itemIndex) => itemIndex !== index)))
            }
            className="size-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
            aria-label="Remove variable"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange({ ...env, [`variable_${entries.length + 1}`]: "" })}
        className="h-8 px-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5"
      >
        <Plus className="size-3" /> Add variable
      </button>
    </div>
  );
}

function AssertionRows({
  assertions,
  onChange,
}: {
  assertions: Assertion[];
  onChange: (assertions: Assertion[]) => void;
}) {
  const update = (id: string, patch: Partial<Assertion>) => {
    onChange(assertions.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-2">
      {assertions.map((assertion) => {
        const needsField = assertion.type === "header" || assertion.type === "jsonField";
        const needsExpected = assertion.operator !== "exists";
        return (
          <div
            key={assertion.id}
            className="rounded-lg border border-border bg-muted/30 p-2 space-y-2"
          >
            <div className="grid grid-cols-[18px_1fr_86px_28px] gap-2 items-center">
              <input
                type="checkbox"
                checked={assertion.enabled}
                onChange={(event) => update(assertion.id, { enabled: event.target.checked })}
                className="accent-primary"
                aria-label="Enable assertion"
              />
              <select
                value={assertion.type}
                onChange={(event) =>
                  update(assertion.id, { type: event.target.value as AssertionType })
                }
                className="min-w-0 rounded-md border border-border bg-input-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ASSERTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <select
                value={assertion.operator}
                onChange={(event) =>
                  update(assertion.id, { operator: event.target.value as AssertionOp })
                }
                className="min-w-0 rounded-md border border-border bg-input-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ASSERTION_OPS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onChange(assertions.filter((item) => item.id !== assertion.id))}
                className="size-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
                aria-label="Remove assertion"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            {(needsField || needsExpected) && (
              <div className="grid grid-cols-2 gap-2">
                {needsField && (
                  <input
                    value={assertion.field ?? ""}
                    onChange={(event) => update(assertion.id, { field: event.target.value })}
                    placeholder="data.id"
                    className="min-w-0 rounded-md border border-border bg-input-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
                {needsExpected && (
                  <input
                    value={assertion.expected}
                    onChange={(event) => update(assertion.id, { expected: event.target.value })}
                    placeholder="expected"
                    className="min-w-0 rounded-md border border-border bg-input-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={() =>
          onChange([
            ...assertions,
            { id: `asrt-${Date.now()}`, enabled: true, type: "status", operator: "lt", expected: "400" },
          ])
        }
        className="h-8 px-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5"
      >
        <Plus className="size-3" /> Add assertion
      </button>
    </div>
  );
}

function ConfigNumber({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] text-muted-foreground block mb-1">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(asNumber(event.target.value, value))}
        className="w-full rounded-md border border-border bg-input-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function WorkflowStepList({
  steps,
  selectedStepId,
  stepStatuses,
  onSelect,
  onUpdateStep,
  onDuplicate,
  onDelete,
  onMove,
}: {
  steps: WorkflowStep[];
  selectedStepId: string | null;
  stepStatuses: Record<string, StepStatus>;
  onSelect: (id: string) => void;
  onUpdateStep: (id: string, patch: Partial<WorkflowStep>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  if (!steps.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <WorkflowIcon className="size-8 mx-auto mb-3 text-muted-foreground" />
        <div className="text-sm">No steps yet</div>
        <p className="text-xs text-muted-foreground mt-1">
          Add an endpoint from the selected project or create a blank step.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isSelected = step.id === selectedStepId;
        const status = stepStatuses[step.id] ?? "idle";
        return (
          <div
            key={step.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(step.id)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onSelect(step.id);
            }}
            className={`w-full rounded-xl border p-3 text-left transition-colors ${
              isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            } ${!step.enabled ? "opacity-60" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div className="size-7 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-sm" style={{ fontWeight: 600 }}>
                    {step.name}
                  </span>
                  {status === "running" && (
                    <Loader2 className="size-3.5 animate-spin text-blue-500 shrink-0" />
                  )}
                  {status === "passed" && (
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  )}
                  {status === "failed" && <XCircle className="size-3.5 text-red-500 shrink-0" />}
                </div>
                <div className="mt-1 flex items-center gap-2 min-w-0">
                  <span
                    className={`border rounded px-1.5 py-0.5 text-[10px] font-mono ${METHOD_COLORS[step.request.method]}`}
                  >
                    {step.request.method}
                  </span>
                  <span className="truncate text-[11px] font-mono text-muted-foreground">
                    {step.request.baseUrl}
                    {step.request.path}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {step.execution?.iterations ?? 1}x iterations / {step.execution?.rampUpDuration ?? 0}ms ramp-up
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="checkbox"
                  checked={step.enabled}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onUpdateStep(step.id, { enabled: event.target.checked })}
                  className="accent-primary"
                  aria-label="Enable step"
                />
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onMove(step.id, "up");
                  }}
                  disabled={index === 0}
                  className="size-7 rounded-md text-muted-foreground hover:bg-accent disabled:opacity-40"
                  aria-label="Move up"
                >
                  <ChevronUp className="size-3.5 mx-auto" />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onMove(step.id, "down");
                  }}
                  disabled={index === steps.length - 1}
                  className="size-7 rounded-md text-muted-foreground hover:bg-accent disabled:opacity-40"
                  aria-label="Move down"
                >
                  <ChevronDown className="size-3.5 mx-auto" />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicate(step.id);
                  }}
                  className="size-7 rounded-md text-muted-foreground hover:bg-accent"
                  aria-label="Duplicate step"
                >
                  <Copy className="size-3.5 mx-auto" />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(step.id);
                  }}
                  className="size-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete step"
                >
                  <Trash2 className="size-3.5 mx-auto" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepEditor({
  step,
  env,
  onUpdate,
}: {
  step: WorkflowStep | null;
  env: Record<string, string>;
  onUpdate: (patch: Partial<WorkflowStep>) => void;
}) {
  if (!step) {
    return (
      <aside className="w-[360px] shrink-0 border-l border-border bg-card p-6 flex items-center justify-center text-center">
        <div>
          <WorkflowIcon className="size-8 mx-auto mb-3 text-muted-foreground" />
          <div className="text-sm">Select a step</div>
          <p className="text-xs text-muted-foreground mt-1">Step request and validation settings appear here.</p>
        </div>
      </aside>
    );
  }

  const request = step.request;
  const execution = step.execution ?? {
    iterations: 1,
    rampUpDuration: 0,
    delay: 500,
    timeout: 30000,
    retryCount: 0,
  };
  const updateRequest = (patch: Partial<typeof request>) =>
    onUpdate({ request: { ...request, ...patch } });
  const updateExecution = (patch: Partial<typeof execution>) =>
    onUpdate({ execution: { ...execution, ...patch } });

  return (
    <aside className="w-[360px] shrink-0 border-l border-border bg-card flex flex-col min-h-0">
      <div className="p-4 border-b border-border shrink-0">
        <input
          value={step.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
          className="w-full rounded-md border border-transparent bg-transparent px-0 py-1 text-sm focus:border-border focus:px-2 focus:outline-none"
          placeholder="Step name"
          style={{ fontWeight: 600 }}
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Editable copy. Changes are saved inside this workflow only.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Request</div>
          <div className="flex gap-2">
            <select
              value={request.method}
              onChange={(event) => updateRequest({ method: event.target.value as HttpMethod })}
              className={`w-24 rounded-md border bg-input-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring ${METHOD_COLORS[request.method]}`}
            >
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <input
              value={request.baseUrl}
              onChange={(event) => updateRequest({ baseUrl: event.target.value })}
              placeholder="https://api.example.com"
              className="min-w-0 flex-1 rounded-md border border-border bg-input-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <input
            value={request.path}
            onChange={(event) => updateRequest({ path: event.target.value })}
            placeholder="/resource"
            className="w-full rounded-md border border-border bg-input-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {request.availableBaseUrls && request.availableBaseUrls.length > 1 && (
            <select
              value={request.baseUrl}
              onChange={(event) => updateRequest({ baseUrl: event.target.value })}
              className="w-full rounded-md border border-border bg-input-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {request.availableBaseUrls.map((url) => (
                <option key={url} value={url}>
                  {url}
                </option>
              ))}
            </select>
          )}
        </section>

        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Execution</div>
          <div className="grid grid-cols-2 gap-2">
            <ConfigNumber
              label="Iterations"
              min={1}
              value={execution.iterations}
              onChange={(iterations) => updateExecution({ iterations })}
            />
            <ConfigNumber
              label="Ramp-up ms"
              min={0}
              value={execution.rampUpDuration}
              onChange={(rampUpDuration) => updateExecution({ rampUpDuration })}
            />
            <ConfigNumber
              label="Delay ms"
              min={0}
              value={execution.delay}
              onChange={(delay) => updateExecution({ delay })}
            />
            <ConfigNumber
              label="Timeout ms"
              min={1000}
              value={execution.timeout}
              onChange={(timeout) => updateExecution({ timeout })}
            />
            <ConfigNumber
              label="Retries"
              min={0}
              value={execution.retryCount}
              onChange={(retryCount) => updateExecution({ retryCount })}
            />
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Headers</div>
          <KeyValueRows
            rows={request.headers}
            onChange={(headers) => updateRequest({ headers })}
            keySuggestions={headerNameSuggestions()}
            valueSuggestions={(row) => headerValueSuggestions(row.key)}
            env={env}
          />
        </section>

        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Query params</div>
          <KeyValueRows rows={request.params} onChange={(params) => updateRequest({ params })} />
        </section>

        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Body</div>
          <div className="flex gap-1 flex-wrap">
            {BODY_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => updateRequest({ bodyMode: mode })}
                className={`px-2 py-1 rounded-md text-[10px] ${
                  (request.bodyMode ?? "none") === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          {(request.bodyMode ?? "none") === "raw" && (
            <>
              <div className="flex gap-1">
                {RAW_TYPES.map((rawType) => (
                  <button
                    key={rawType}
                    onClick={() => updateRequest({ rawType })}
                    className={`px-2 py-1 rounded-md text-[10px] uppercase ${
                      (request.rawType ?? "json") === rawType
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {rawType}
                  </button>
                ))}
              </div>
              <textarea
                value={request.body}
                onChange={(event) => updateRequest({ body: event.target.value })}
                rows={8}
                spellCheck={false}
                className="w-full rounded-md border border-border bg-input-background px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </>
          )}
          {request.bodyMode === "form-data" && (
            <KeyValueRows
              rows={request.formData ?? []}
              onChange={(formData) => updateRequest({ formData })}
            />
          )}
          {request.bodyMode === "url-encoded" && (
            <KeyValueRows
              rows={request.urlEncoded ?? []}
              onChange={(urlEncoded) => updateRequest({ urlEncoded })}
            />
          )}
        </section>

        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Assertions</div>
          <AssertionRows
            assertions={step.assertions}
            onChange={(assertions) => onUpdate({ assertions })}
          />
        </section>

        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Post-response script</div>
          <textarea
            value={step.script}
            onChange={(event) => onUpdate({ script: event.target.value })}
            rows={8}
            spellCheck={false}
            placeholder={'const token = response.json.data.token;\nenv.set("access_token", token);'}
            className="w-full rounded-md border border-border bg-[#0d1117] px-2 py-2 text-xs font-mono text-[#e6edf3] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </section>
      </div>
    </aside>
  );
}

function runtimeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type WorkflowRuntimeEnv = Record<string, string>;

type BuiltStepRequest = {
  url: string;
  headers: Record<string, string>;
  body?: BodyInit;
  requestPayload: string;
};

function stringifyRuntimeValue(value: unknown) {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function resolveEnvReferences(value: string, env: WorkflowRuntimeEnv) {
  if (!value.includes("{{")) return value;
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(env, name) ? env[name] : match
  );
}

function joinBaseAndPath(baseUrl: string, requestPath: string) {
  const base = new URL(baseUrl);
  const basePath = base.pathname.endsWith("/") ? base.pathname.slice(0, -1) : base.pathname;
  const childPath = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  base.pathname = `${basePath}${childPath}`.replace(/\/{2,}/g, "/");
  base.search = "";
  base.hash = "";
  return base;
}

function stepUrl(step: WorkflowStep, env: WorkflowRuntimeEnv = {}) {
  try {
    let pathWithSearch = resolveEnvReferences(step.request.path.trim(), env);
    const consumedParamIds = new Set<string>();

    step.request.params
      .filter((param) => param.enabled && param.key.trim())
      .forEach((param) => {
        const key = resolveEnvReferences(param.key.trim(), env);
        const value = resolveEnvReferences(param.value, env);
        if (!key) return;
        const placeholder = `{${key}}`;
        if (pathWithSearch.includes(placeholder)) {
          pathWithSearch = pathWithSearch.replaceAll(placeholder, encodeURIComponent(value));
          consumedParamIds.add(param.id);
        }
      });

    const [pathOnly, search = ""] = pathWithSearch.split("?");
    const url = joinBaseAndPath(resolveEnvReferences(step.request.baseUrl.trim(), env), pathOnly);
    if (search) {
      new URLSearchParams(search).forEach((value, key) => url.searchParams.append(key, value));
    }

    step.request.params
      .filter((param) => param.enabled && param.key.trim() && !consumedParamIds.has(param.id))
      .forEach((param) => {
        url.searchParams.append(
          resolveEnvReferences(param.key.trim(), env),
          resolveEnvReferences(param.value, env)
        );
      });

    return url.toString();
  } catch {
    const baseUrl = resolveEnvReferences(step.request.baseUrl.trim(), env).replace(/\/+$/, "");
    const path = resolveEnvReferences(step.request.path.trim(), env);
    const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
    const query = new URLSearchParams();

    step.request.params
      .filter((param) => param.enabled && param.key.trim())
      .forEach((param) =>
        query.append(
          resolveEnvReferences(param.key.trim(), env),
          resolveEnvReferences(param.value, env)
        )
      );

    const queryString = query.toString();
    return `${baseUrl}${normalizedPath}${queryString ? `?${queryString}` : ""}` || "/";
  }
}

function requestPayload(step: WorkflowStep, env: WorkflowRuntimeEnv = {}) {
  if (step.request.bodyMode === "form-data") {
    return JSON.stringify(
      Object.fromEntries(
        (step.request.formData ?? [])
          .filter((row) => row.enabled && row.key.trim())
          .map((row) => [
            resolveEnvReferences(row.key, env),
            resolveEnvReferences(row.value, env),
          ])
      ),
      null,
      2
    );
  }

  if (step.request.bodyMode === "url-encoded") {
    return JSON.stringify(
      Object.fromEntries(
        (step.request.urlEncoded ?? [])
          .filter((row) => row.enabled && row.key.trim())
          .map((row) => [
            resolveEnvReferences(row.key, env),
            resolveEnvReferences(row.value, env),
          ])
      ),
      null,
      2
    );
  }

  return step.request.bodyMode === "raw"
    ? resolveEnvReferences(step.request.body, env)
    : "";
}

function setHeader(headers: Record<string, string>, name: string, value: string) {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  const existing = Object.keys(headers).find(
    (headerName) => headerName.toLowerCase() === trimmedName.toLowerCase()
  );
  headers[existing ?? trimmedName] = value;
}

function hasHeader(headers: Record<string, string>, name: string) {
  return Object.keys(headers).some((headerName) => headerName.toLowerCase() === name.toLowerCase());
}

function rawContentType(rawType: RawBodyType | undefined) {
  if (rawType === "xml") return "application/xml";
  if (rawType === "text") return "text/plain";
  return "application/json";
}

function applyAuthHeaders(
  headers: Record<string, string>,
  step: WorkflowStep,
  env: WorkflowRuntimeEnv
) {
  const auth = step.request.auth;
  if (!auth || auth.type === "none") return;

  if (auth.type === "bearer" && auth.token) {
    setHeader(headers, "Authorization", `Bearer ${resolveEnvReferences(auth.token, env)}`);
    return;
  }

  if (auth.type === "basic") {
    const username = resolveEnvReferences(auth.username ?? "", env);
    const password = resolveEnvReferences(auth.password ?? "", env);
    if (username || password) {
      setHeader(headers, "Authorization", `Basic ${btoa(`${username}:${password}`)}`);
    }
    return;
  }

  if (auth.type === "api-key" && auth.apiKey) {
    setHeader(
      headers,
      resolveEnvReferences(auth.apiKeyHeader || "X-API-Key", env),
      resolveEnvReferences(auth.apiKey, env)
    );
    return;
  }

  if (auth.type === "oauth2" && auth.oauthAccessToken) {
    const prefix = resolveEnvReferences(auth.oauthHeaderPrefix || "Bearer", env).trim();
    setHeader(
      headers,
      "Authorization",
      `${prefix || "Bearer"} ${resolveEnvReferences(auth.oauthAccessToken, env)}`
    );
  }
}

function buildStepRequest(step: WorkflowStep, env: WorkflowRuntimeEnv): BuiltStepRequest {
  const headers: Record<string, string> = {};
  step.request.headers
    .filter((row) => row.enabled && row.key.trim())
    .forEach((row) =>
      setHeader(headers, resolveEnvReferences(row.key, env), resolveEnvReferences(row.value, env))
    );

  applyAuthHeaders(headers, step, env);

  const canSendBody = step.request.method !== "GET";
  const bodyMode = step.request.bodyMode ?? "none";
  let body: BodyInit | undefined;

  if (canSendBody && bodyMode === "raw") {
    body = resolveEnvReferences(step.request.body, env);
    if (!hasHeader(headers, "content-type")) {
      setHeader(headers, "Content-Type", rawContentType(step.request.rawType));
    }
  } else if (canSendBody && bodyMode === "url-encoded") {
    const data = new URLSearchParams();
    (step.request.urlEncoded ?? [])
      .filter((row) => row.enabled && row.key.trim())
      .forEach((row) =>
        data.set(resolveEnvReferences(row.key, env), resolveEnvReferences(row.value, env))
      );
    body = data;
    if (!hasHeader(headers, "content-type")) {
      setHeader(headers, "Content-Type", "application/x-www-form-urlencoded");
    }
  } else if (canSendBody && bodyMode === "form-data") {
    const data = new FormData();
    (step.request.formData ?? [])
      .filter((row) => row.enabled && row.key.trim())
      .forEach((row) =>
        data.set(resolveEnvReferences(row.key, env), resolveEnvReferences(row.value, env))
      );
    body = data;
  }

  return {
    url: stepUrl(step, env),
    headers,
    body,
    requestPayload: requestPayload(step, env),
  };
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
  const normalizedPath = path.trim().startsWith("$") ? path.trim() : `$.${path.trim()}`;
  if (normalizedPath === "$") return value;
  return parsePath(normalizedPath).reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined;
    if (typeof segment === "number" && Array.isArray(current)) return current[segment];
    if (typeof segment === "string" && typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);
}

function compareAssertionValue(
  actual: unknown,
  expected: string,
  operator: AssertionOp
) {
  if (operator === "exists") return actual !== undefined && actual !== null;
  const actualText = stringifyRuntimeValue(actual);
  const expectedText = expected;

  if (operator === "eq") return actualText === expectedText;
  if (operator === "ne") return actualText !== expectedText;
  if (operator === "contains") return actualText.includes(expectedText);

  const actualNumber = Number(actualText);
  const expectedNumber = Number(expectedText);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;

  if (operator === "lt") return actualNumber < expectedNumber;
  if (operator === "lte") return actualNumber <= expectedNumber;
  if (operator === "gt") return actualNumber > expectedNumber;
  if (operator === "gte") return actualNumber >= expectedNumber;
  return false;
}

function assertionExpectedLabel(assertion: Assertion) {
  return assertion.operator === "exists"
    ? "exists"
    : `${assertion.operator} ${assertion.expected}`;
}

function evaluateAssertions(
  step: WorkflowStep,
  response: RunnerProxyResponse,
  responseTime: number
): AssertionResult[] {
  const enabledAssertions = step.assertions.filter((assertion) => assertion.enabled);
  if (!enabledAssertions.length) {
    return [
      {
        type: "status",
        expected: "< 400",
        actual: String(response.status),
        passed: response.status > 0 && response.status < 400,
      },
    ];
  }

  const json = parseJsonBody(response.body);
  return enabledAssertions.map((assertion) => {
    let actual: unknown;

    if (assertion.type === "status") {
      actual = response.status;
    } else if (assertion.type === "responseTime") {
      actual = responseTime;
    } else if (assertion.type === "header") {
      actual = assertion.field ? headerValue(response.headers, assertion.field) : undefined;
    } else if (assertion.type === "jsonField") {
      actual = json === undefined ? undefined : extractJsonPath(json, assertion.field || "$");
    } else {
      actual = response.body;
    }

    return {
      type: assertion.type,
      field: assertion.field,
      expected: assertionExpectedLabel(assertion),
      actual: stringifyRuntimeValue(actual),
      passed:
        assertion.type === "bodyContains" && assertion.operator === "exists"
          ? Boolean(response.body)
          : compareAssertionValue(actual, assertion.expected, assertion.operator),
    };
  });
}

function envScriptApi(env: WorkflowRuntimeEnv) {
  return {
    get: (name: string) => env[name],
    set: (name: string, value: unknown) => {
      if (!name.trim()) return;
      env[name.trim()] = stringifyRuntimeValue(value);
    },
    unset: (name: string) => {
      delete env[name.trim()];
    },
    all: () => ({ ...env }),
  };
}

function runPostResponseScript(
  step: WorkflowStep,
  proxyResponse: RunnerProxyResponse,
  request: BuiltStepRequest,
  responseTime: number,
  env: WorkflowRuntimeEnv
) {
  const code = step.script.trim();
  if (!code || /^(\/\/.*\n?)+$/.test(code)) return undefined;

  const json = parseJsonBody(proxyResponse.body);
  const responseApi = {
    status: proxyResponse.status,
    statusText: proxyResponse.statusText,
    ok: proxyResponse.status >= 200 && proxyResponse.status < 300,
    headers: Object.fromEntries(proxyResponse.headers),
    body: proxyResponse.body,
    text: proxyResponse.body,
    json,
    durationMs: responseTime,
  };
  const requestApi = {
    method: step.request.method,
    url: request.url,
    headers: { ...request.headers },
    body: request.requestPayload,
  };
  const api = envScriptApi(env);
  const pm = {
    environment: api,
    response: {
      ...responseApi,
      json: () => json ?? null,
      text: () => proxyResponse.body,
    },
    request: requestApi,
  };
  const sandboxConsole = {
    log: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

  try {
    const fn = new Function("response", "env", "request", "pm", "console", code);
    fn(responseApi, api, requestApi, pm, sandboxConsole);
    return undefined;
  } catch (error: unknown) {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
}

function callPassed(call: CallRecord) {
  return (
    !call.error &&
    call.statusCode > 0 &&
    call.statusCode < 400 &&
    call.assertions.every((assertion) => assertion.passed)
  );
}

async function makeProxyCall(
  workflow: Workflow,
  step: WorkflowStep,
  env: WorkflowRuntimeEnv
): Promise<CallRecord> {
  const timestamp = new Date().toISOString();
  const started = performance.now();
  let request: BuiltStepRequest | null = null;

  try {
    request = buildStepRequest(step, env);
    const execution = step.execution ?? {
      iterations: 1,
      rampUpDuration: 0,
      delay: 500,
      timeout: 30000,
      retryCount: 0,
    };
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1000, Math.floor(execution.timeout || 30000))
    );
    let proxyResponse: RunnerProxyResponse;

    try {
      proxyResponse = await runnerProxyFetch({
        url: request.url,
        method: step.request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseTime = Math.round(performance.now() - started);
    const scriptError = runPostResponseScript(step, proxyResponse, request, responseTime, env);
    const assertions = evaluateAssertions(step, proxyResponse, responseTime);

    return {
      id: runtimeId("call"),
      workflowId: workflow.id,
      workflowName: workflow.name,
      stepId: step.id,
      stepName: step.name,
      method: step.request.method,
      url: request.url,
      statusCode: proxyResponse.status,
      responseTime,
      requestPayload: request.requestPayload,
      responseBody: proxyResponse.body,
      error: scriptError,
      timestamp,
      assertions,
    };
  } catch (error: unknown) {
    const responseTime = Math.round(performance.now() - started);
    const message = error instanceof Error ? error.message : "Workflow request failed.";
    return {
      id: runtimeId("call"),
      workflowId: workflow.id,
      workflowName: workflow.name,
      stepId: step.id,
      stepName: step.name,
      method: step.request.method,
      url: request?.url ?? stepUrl(step, env),
      statusCode: 0,
      responseTime,
      requestPayload: request?.requestPayload ?? requestPayload(step, env),
      responseBody: "",
      error: message,
      timestamp,
      assertions: [
        {
          type: "request",
          expected: "proxy call succeeded",
          actual: message,
          passed: false,
        },
      ],
    };
  }
}

function buildRunResult(
  workflow: Workflow,
  startedAt: string,
  finishedAt: string,
  stepResults: StepRunResult[],
  statusOverride?: WorkflowRunStatus
): WorkflowRunResult {
  const calls = stepResults.flatMap((step) => step.calls);
  const failed = calls.filter(
    (call) =>
      call.error ||
      call.statusCode <= 0 ||
      call.statusCode >= 400 ||
      call.assertions.some((assertion) => !assertion.passed)
  ).length;
  const passed = calls.length - failed;
  const responseTimes = calls.map((call) => call.responseTime).sort((a, b) => a - b);
  const p95Index = responseTimes.length ? Math.ceil(responseTimes.length * 0.95) - 1 : 0;
  const durationSeconds = Math.max(
    1,
    (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000
  );

  return {
    id: runtimeId("run"),
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: statusOverride ?? (failed > 0 ? "failed" : "passed"),
    startedAt,
    finishedAt,
    stepResults,
    summary: {
      total: calls.length,
      passed,
      failed,
      errorRate: calls.length ? Math.round((failed / calls.length) * 1000) / 10 : 0,
      avgResponseTime: responseTimes.length
        ? Math.round(responseTimes.reduce((total, value) => total + value, 0) / responseTimes.length)
        : 0,
      p95ResponseTime: responseTimes[p95Index] ?? 0,
      throughput: Math.round((calls.length / durationSeconds) * 10) / 10,
    },
  };
}

export default function WorkflowsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const cancelRunRef = useRef(false);
  const historyStorageReadyRef = useRef(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [endpointSearch, setEndpointSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [workflowStatuses, setWorkflowStatuses] = useState<Record<string, WorkflowRunStatus>>({});
  const [mainView, setMainView] = useState<MainView>("builder");
  const [runResults, setRunResults] = useState<WorkflowRunResult[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const currentUser = await getAuthUser();
        if (!currentUser) {
          router.replace("/login");
          return;
        }
        const [loadedProjects, loadedWorkflows] = await Promise.all([
          loadProjects(currentUser.id),
          loadWorkflows(),
        ]);
        if (!active) return;
        setUser(currentUser);
        setProjects(loadedProjects);
        setWorkflows(loadedWorkflows);
        setActiveWorkflowId(loadedWorkflows[0]?.id ?? null);
        setSelectedStepId(loadedWorkflows[0]?.steps[0]?.id ?? null);
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : "Could not load workflows.");
      }
    }

    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!user) {
      historyStorageReadyRef.current = false;
      return;
    }

    historyStorageReadyRef.current = false;
    queueMicrotask(() => {
      const stored = loadStoredWorkflowHistory(user.id);
      setRunResults(stored.runResults);
      setCallHistory(stored.callHistory);
      historyStorageReadyRef.current = true;
    });
  }, [user]);

  useEffect(() => {
    if (!user || !historyStorageReadyRef.current) return;
    saveStoredWorkflowHistory(user.id, runResults, callHistory);
  }, [callHistory, runResults, user]);

  const activeWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === activeWorkflowId) ?? null,
    [activeWorkflowId, workflows]
  );
  const canEditWorkflow = (activeWorkflow?.ownerId ?? user?.id) === user?.id;
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeWorkflow?.projectId) ?? null,
    [activeWorkflow?.projectId, projects]
  );
  const endpoints = useMemo(() => allEndpoints(activeProject), [activeProject]);
  const filteredEndpoints = useMemo(() => {
    const query = endpointSearch.trim().toLowerCase();
    if (!query) return endpoints;
    return endpoints.filter((endpoint) =>
      [
        endpoint.method,
        endpoint.path,
        endpoint.summary,
        endpoint.tagName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [endpointSearch, endpoints]);
  const selectedStep = useMemo(
    () => activeWorkflow?.steps.find((step) => step.id === selectedStepId) ?? null,
    [activeWorkflow, selectedStepId]
  );
  const filteredWorkflows = workflows.filter((workflow) =>
    workflow.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (!user) {
    return error ? (
      <div className="min-h-screen bg-background p-6 text-destructive">{error}</div>
    ) : null;
  }

  const markWorkflow = (next: Workflow) => {
    if ((next.ownerId ?? user.id) !== user.id) return;
    setDirty(true);
    setWorkflows((list) =>
      list.map((workflow) => (workflow.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : workflow))
    );
  };

  const updateActiveWorkflow = (patch: Partial<Workflow>) => {
    if (!activeWorkflow || !canEditWorkflow) return;
    markWorkflow({ ...activeWorkflow, ...patch });
  };

  const updateConfig = (patch: Partial<WorkflowGlobalConfig>) => {
    if (!activeWorkflow) return;
    updateActiveWorkflow({ config: { ...activeWorkflow.config, ...patch } });
  };

  const updateStep = (stepId: string, patch: Partial<WorkflowStep>) => {
    if (!activeWorkflow || !canEditWorkflow) return;
    updateActiveWorkflow({
      steps: activeWorkflow.steps.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step
      ),
    });
  };

  const createWorkflow = async () => {
    const workflow = makeBlankWorkflow(user.id, projects[0]?.id ?? null);
    setWorkflows((list) => [workflow, ...list]);
    setActiveWorkflowId(workflow.id);
    setSelectedStepId(null);
    setDirty(true);
    setSaving(true);
    setError(null);

    try {
      const saved = await upsertWorkflow(workflow, user.id);
      setWorkflows((list) =>
        list.map((item) => (item.id === workflow.id ? saved : item))
      );
      setActiveWorkflowId(saved.id);
      setDirty(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not create workflow.");
    } finally {
      setSaving(false);
    }
  };

  const saveWorkflow = async () => {
    if (!activeWorkflow) return;
    if (!canEditWorkflow) {
      setError("Only the workflow owner can save changes.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertWorkflow(activeWorkflow, user.id);
      setWorkflows((list) => list.map((workflow) => (workflow.id === saved.id ? saved : workflow)));
      setDirty(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save workflow.");
    } finally {
      setSaving(false);
    }
  };

  const saveWorkflowMembers = async (memberIds: string[]) => {
    if (!activeWorkflow) return;
    if (!canEditWorkflow) throw new Error("Only the workflow owner can update members.");
    setError(null);
    await updateWorkflowMembers(activeWorkflow.id, memberIds);
    setWorkflows((list) =>
      list.map((workflow) =>
        workflow.id === activeWorkflow.id ? { ...workflow, memberIds } : workflow
      )
    );
  };

  const removeWorkflow = async (workflow: Workflow) => {
    if ((workflow.ownerId ?? user.id) !== user.id) return;
    if (!confirm(`Delete workflow "${workflow.name}"?`)) return;
    setError(null);
    try {
      if (workflow.ownerId) await deleteWorkflow(workflow.id, user.id);
      const next = workflows.filter((item) => item.id !== workflow.id);
      setWorkflows(next);
      if (activeWorkflowId === workflow.id) {
        setActiveWorkflowId(next[0]?.id ?? null);
        setSelectedStepId(next[0]?.steps[0]?.id ?? null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not delete workflow.");
    }
  };

  const addBlankStep = () => {
    if (!activeWorkflow || !canEditWorkflow) return;
    const step = makeBlankStep();
    updateActiveWorkflow({ steps: [...activeWorkflow.steps, step] });
    setSelectedStepId(step.id);
  };

  const addEndpointStep = (endpoint: Endpoint) => {
    if (!activeWorkflow || !activeProject || !canEditWorkflow) return;
    const step = makeStepFromEndpoint(activeProject, endpoint);
    updateActiveWorkflow({ steps: [...activeWorkflow.steps, step] });
    setSelectedStepId(step.id);
  };

  const duplicateStep = (stepId: string) => {
    if (!activeWorkflow || !canEditWorkflow) return;
    const original = activeWorkflow.steps.find((step) => step.id === stepId);
    if (!original) return;
    const copy = {
      ...original,
      id: `step-${Date.now()}`,
      request: { ...original.request, id: `sreq-${Date.now()}` },
      name: `${original.name} copy`,
    };
    const index = activeWorkflow.steps.findIndex((step) => step.id === stepId);
    const steps = [...activeWorkflow.steps];
    steps.splice(index + 1, 0, copy);
    updateActiveWorkflow({ steps });
    setSelectedStepId(copy.id);
  };

  const deleteStep = (stepId: string) => {
    if (!activeWorkflow || !canEditWorkflow) return;
    const steps = activeWorkflow.steps.filter((step) => step.id !== stepId);
    updateActiveWorkflow({ steps });
    if (selectedStepId === stepId) setSelectedStepId(steps[0]?.id ?? null);
  };

  const moveStep = (stepId: string, direction: "up" | "down") => {
    if (!activeWorkflow || !canEditWorkflow) return;
    const steps = [...activeWorkflow.steps];
    const index = steps.findIndex((step) => step.id === stepId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    updateActiveWorkflow({ steps });
  };

  const recordRunResult = (result: WorkflowRunResult) => {
    const calls = result.stepResults.flatMap((step) => step.calls);
    setRunResults((current) => [result, ...current].slice(0, 100));
    setCallHistory((current) => [...current, ...calls].slice(-1000));
  };

  const runWorkflowExecution = async (
    workflow: Workflow,
    options: { trackSteps?: boolean } = {}
  ) => {
    const enabledSteps = workflow.steps.filter((step) => step.enabled);
    if (!enabledSteps.length) return null;

    const startedAt = new Date().toISOString();
    const stepResults: StepRunResult[] = [];
    const runtimeEnv: WorkflowRuntimeEnv = { ...workflow.env };
    const workflowIterations = Math.max(1, Math.floor(workflow.config.iterations || 1));
    let shouldStopWorkflow = false;

    if (workflow.config.globalRampUp > 0) {
      await sleep(workflow.config.globalRampUp * 1000);
    }

    for (let workflowIteration = 0; workflowIteration < workflowIterations; workflowIteration += 1) {
      if (cancelRunRef.current || shouldStopWorkflow) break;

      for (const step of enabledSteps) {
        if (cancelRunRef.current) break;
        const execution = step.execution ?? {
          iterations: 1,
          rampUpDuration: 0,
          delay: 500,
          timeout: 30000,
          retryCount: 0,
        };
        const iterations = Math.max(1, Math.floor(execution.iterations));
        const retryCount = Math.max(0, Math.floor(execution.retryCount));
        const calls: CallRecord[] = [];

        if (options.trackSteps) {
          setStepStatuses((current) => ({ ...current, [step.id]: "running" }));
          setSelectedStepId(step.id);
        }

        if (execution.rampUpDuration > 0) {
          await sleep(execution.rampUpDuration);
        }

        let stepPassed = true;
        for (let iteration = 0; iteration < iterations; iteration += 1) {
          if (cancelRunRef.current) break;
          let iterationPassed = false;
          for (let attempt = 0; attempt <= retryCount; attempt += 1) {
            if (cancelRunRef.current) break;
            const call = await makeProxyCall(workflow, step, runtimeEnv);
            calls.push(call);
            iterationPassed = callPassed(call);
            if (iterationPassed) break;
          }
          stepPassed = stepPassed && iterationPassed;
          if (!iterationPassed && workflow.config.stopOnError) break;
          if (iteration < iterations - 1 && execution.delay > 0) {
            await sleep(execution.delay);
          }
        }

        const status: StepStatus = stepPassed ? "passed" : "failed";
        stepResults.push({
          stepId:
            workflowIterations > 1
              ? `${step.id}-workflow-iteration-${workflowIteration + 1}`
              : step.id,
          stepName:
            workflowIterations > 1
              ? `${step.name} (run ${workflowIteration + 1})`
              : step.name,
          status,
          calls,
        });

        if (options.trackSteps) {
          setStepStatuses((current) => ({ ...current, [step.id]: status }));
        }

        if (!stepPassed && workflow.config.stopOnError) {
          shouldStopWorkflow = true;
          break;
        }
      }
    }

    const finishedAt = new Date().toISOString();
    return buildRunResult(
      workflow,
      startedAt,
      finishedAt,
      stepResults,
      cancelRunRef.current ? "cancelled" : undefined
    );
  };

  const runActiveWorkflow = async () => {
    if (!activeWorkflow || running) return;
    if (!activeWorkflow.steps.some((step) => step.enabled)) return;

    cancelRunRef.current = false;
    setRunning(true);
    setError(null);
    setWorkflowStatuses((current) => ({ ...current, [activeWorkflow.id]: "running" }));
    setStepStatuses({});

    try {
      const result = await runWorkflowExecution(activeWorkflow, { trackSteps: true });
      if (result) {
        recordRunResult(result);
        setWorkflowStatuses((current) => ({
          ...current,
          [activeWorkflow.id]: result.status,
        }));
      }
    } finally {
      setRunning(false);
    }
  };

  const runMultipleWorkflows = async (ids: string[]) => {
    if (running) return;
    const targets = ids
      .map((id) => workflows.find((workflow) => workflow.id === id))
      .filter((workflow): workflow is Workflow => Boolean(workflow))
      .filter((workflow) => workflow.steps.some((step) => step.enabled));
    if (!targets.length) return;

    cancelRunRef.current = false;
    setRunning(true);
    setError(null);
    setStepStatuses({});
    setWorkflowStatuses((current) => ({
      ...current,
      ...Object.fromEntries(targets.map((workflow) => [workflow.id, "queued" as WorkflowRunStatus])),
    }));

    try {
      await Promise.all(
        targets.map(async (workflow, index) => {
          await sleep(index * 250);
          if (cancelRunRef.current) return;
          setWorkflowStatuses((current) => ({ ...current, [workflow.id]: "running" }));
          const result = await runWorkflowExecution(workflow);
          if (!result) return;
          recordRunResult(result);
          setWorkflowStatuses((current) => ({ ...current, [workflow.id]: result.status }));
        })
      );
      setMainView("history");
    } finally {
      setRunning(false);
    }
  };

  const stopRuns = () => {
    cancelRunRef.current = true;
    setRunning(false);
    setWorkflowStatuses((current) => {
      const next = { ...current };
      workflows.forEach((workflow) => {
        if (next[workflow.id] === "queued" || next[workflow.id] === "running") {
          next[workflow.id] = "cancelled";
        }
      });
      return next;
    });
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      <header className="border-b border-border shrink-0">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/")}
              className="size-9 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white hover:opacity-90"
              aria-label="Back to projects"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="hidden sm:block">
              <div style={{ fontWeight: 600 }}>API Docs</div>
              <div className="text-xs text-muted-foreground">Workflow builder</div>
            </div>
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="size-3" /> API Docs
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-background text-foreground shadow-sm">
                <WorkflowIcon className="size-3" /> Workflows
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground mr-1">
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
                void logout();
                router.push("/login");
              }}
              className="h-9 px-3 rounded-md border border-border hover:bg-accent flex items-center gap-1.5 text-sm"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-card px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            {VIEW_TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setMainView(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                  mainView === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3" /> {label}
              </button>
            ))}
          </div>
          <div className="ml-auto hidden text-xs text-muted-foreground sm:block">
            {runResults.length} report{runResults.length === 1 ? "" : "s"} / {callHistory.length} call records
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {mainView === "builder" ? (
          <>
        <aside className="w-80 shrink-0 border-r border-border bg-card flex flex-col min-h-0">
          <div className="p-3 border-b border-border space-y-3">
            <button
              onClick={createWorkflow}
              className="w-full h-9 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-sm flex items-center justify-center gap-2"
            >
              <Plus className="size-4" /> New workflow
            </button>
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workflows..."
                className="w-full pl-8 pr-3 py-2 rounded-md bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
          </div>
          <div className="min-h-24 flex-1 overflow-y-auto p-2">
            {filteredWorkflows.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                No workflows found.
              </div>
            ) : (
              filteredWorkflows.map((workflow) => {
                const status = workflowStatuses[workflow.id] ?? "idle";
                const project = projects.find((item) => item.id === workflow.projectId);
                const isOwner = (workflow.ownerId ?? user.id) === user.id;
                return (
                  <div
                    key={workflow.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveWorkflowId(workflow.id);
                      setSelectedStepId(workflow.steps[0]?.id ?? null);
                      setDirty(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      setActiveWorkflowId(workflow.id);
                      setSelectedStepId(workflow.steps[0]?.id ?? null);
                      setDirty(false);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left mb-1 transition-colors ${
                      activeWorkflowId === workflow.id ? "bg-accent" : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <WorkflowIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{workflow.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {project?.name ?? "No project"} · {workflow.steps.length} step
                          {workflow.steps.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <span className={`text-[10px] rounded-full px-2 py-0.5 ${RUN_STATUS_UI[status]}`}>
                        {status}
                      </span>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeWorkflow(workflow);
                          }}
                          className="size-6 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
                          aria-label="Delete workflow"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {activeWorkflow && (
            <>
              <details className="border-t border-border px-3 py-2">
                <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                  Run config
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <ConfigNumber
                      label="Iterations"
                      min={1}
                      value={activeWorkflow.config.iterations}
                      onChange={(iterations) => updateConfig({ iterations })}
                    />
                    <ConfigNumber
                      label="Parallel"
                      min={1}
                      value={activeWorkflow.config.parallel}
                      onChange={(parallel) => updateConfig({ parallel })}
                    />
                    <ConfigNumber
                      label="Ramp-up seconds"
                      min={0}
                      value={activeWorkflow.config.globalRampUp}
                      onChange={(globalRampUp) => updateConfig({ globalRampUp })}
                    />
                    <ConfigNumber
                      label="Timeout ms"
                      min={1000}
                      value={activeWorkflow.config.timeout}
                      onChange={(timeout) => updateConfig({ timeout })}
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={activeWorkflow.config.stopOnError}
                        onChange={(event) =>
                          updateConfig({ stopOnError: event.target.checked })
                        }
                        className="accent-primary"
                      />
                      Stop on first error
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={activeWorkflow.config.continueOnError}
                        onChange={(event) =>
                          updateConfig({ continueOnError: event.target.checked })
                        }
                        className="accent-primary"
                      />
                      Continue on error
                    </label>
                  </div>

                  <details className="rounded-md border border-border p-2">
                    <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                      Environment
                    </summary>
                    <div className="mt-2">
                      <EnvRows
                        env={activeWorkflow.env}
                        onChange={(env) => updateActiveWorkflow({ env })}
                      />
                    </div>
                  </details>
                </div>
              </details>

              <div className="border-t border-border p-3 space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs text-muted-foreground">
                    Source project
                  </label>
                  <select
                    value={activeWorkflow.projectId ?? ""}
                    onChange={(event) => {
                      updateActiveWorkflow({ projectId: event.target.value || null });
                      setEndpointSearch("");
                    }}
                    className="h-9 w-full rounded-md border border-border bg-input-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm" style={{ fontWeight: 600 }}>
                      Add steps
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {activeProject ? activeProject.name : "No source project"}
                    </div>
                  </div>
                  <button
                    onClick={addBlankStep}
                    className="h-8 shrink-0 rounded-md border border-border px-2 text-xs hover:bg-accent inline-flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" /> Blank
                  </button>
                </div>

                {activeProject ? (
                  <>
                    <div className="relative">
                      <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={endpointSearch}
                        onChange={(event) => setEndpointSearch(event.target.value)}
                        placeholder="Search endpoints..."
                        className="w-full rounded-md border border-border bg-input-background py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                      {filteredEndpoints.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          No endpoints found.
                        </div>
                      ) : (
                        filteredEndpoints.map((endpoint) => (
                          <button
                            key={endpoint.id}
                            onClick={() => addEndpointStep(endpoint)}
                            className="w-full rounded-md px-2 py-2 text-left hover:bg-muted"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`shrink-0 border rounded px-1.5 py-0.5 text-[10px] font-mono ${METHOD_COLORS[endpoint.method]}`}
                              >
                                {endpoint.method}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs">
                                {endpoint.summary}
                              </span>
                            </div>
                            <div className="mt-1 truncate pl-[58px] text-[10px] font-mono text-muted-foreground">
                              {endpoint.path}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Select a source project to add endpoints.
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        <main className="flex-1 min-w-0 flex min-h-0">
          {activeWorkflow ? (
            <>
              <section className="flex-1 min-w-0 overflow-y-auto">
                <div className="max-w-5xl mx-auto p-6 space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <input
                        value={activeWorkflow.name}
                        onChange={(event) => updateActiveWorkflow({ name: event.target.value })}
                        className="w-full max-w-lg bg-transparent border-b border-transparent focus:border-border text-2xl outline-none"
                        style={{ fontWeight: 600 }}
                      />
                      <textarea
                        value={activeWorkflow.description}
                        onChange={(event) =>
                          updateActiveWorkflow({ description: event.target.value })
                        }
                        placeholder="Workflow description"
                        rows={2}
                        className="mt-2 w-full max-w-2xl resize-none rounded-md border border-border bg-input-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setShowMembers(true)}
                        className="h-9 px-3 rounded-md border border-border hover:bg-accent text-sm flex items-center gap-2"
                        title={canEditWorkflow ? "Manage workflow members" : "View workflow members"}
                      >
                        <UserPlus className="size-4" />
                        <MemberAvatars
                          ownerId={activeWorkflow.ownerId ?? user.id}
                          memberIds={activeWorkflow.memberIds ?? []}
                          max={3}
                        />
                      </button>
                      {!canEditWorkflow && (
                        <span
                          className="hidden sm:inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] text-amber-500"
                          title="Only the owner can save workflow changes"
                        >
                          <Lock className="size-3" /> Member
                        </span>
                      )}
                      <button
                        onClick={runActiveWorkflow}
                        disabled={running || !activeWorkflow.steps.some((step) => step.enabled)}
                        className="h-9 px-3 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 text-sm flex items-center gap-2"
                      >
                        {running ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Play className="size-4" />
                        )}
                        Run
                      </button>
                      <button
                        onClick={saveWorkflow}
                        disabled={saving || !canEditWorkflow}
                        className="h-9 px-3 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm flex items-center gap-2"
                      >
                        {saving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        {dirty ? "Save changes" : "Save"}
                      </button>
                    </div>
                  </div>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg" style={{ fontWeight: 600 }}>
                          Steps
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {activeWorkflow.steps.length} configured step
                          {activeWorkflow.steps.length === 1 ? "" : "s"}.
                        </p>
                      </div>
                    </div>
                    <WorkflowStepList
                      steps={activeWorkflow.steps}
                      selectedStepId={selectedStepId}
                      stepStatuses={stepStatuses}
                      onSelect={setSelectedStepId}
                      onUpdateStep={updateStep}
                      onDuplicate={duplicateStep}
                      onDelete={deleteStep}
                      onMove={moveStep}
                    />
                  </section>
                </div>
              </section>

              <StepEditor
                step={selectedStep}
                env={activeWorkflow.env}
                onUpdate={(patch) => selectedStep && updateStep(selectedStep.id, patch)}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <WorkflowIcon className="size-10 mx-auto mb-3 text-muted-foreground" />
                <h1 className="text-xl" style={{ fontWeight: 600 }}>
                  No workflow selected
                </h1>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Create a workflow to store API test flow configuration in Supabase.
                </p>
                <button
                  onClick={createWorkflow}
                  className="h-10 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-sm inline-flex items-center gap-2"
                >
                  <Plus className="size-4" /> New workflow
                </button>
              </div>
            </div>
          )}
        </main>
          </>
        ) : mainView === "multi-run" ? (
          <main className="min-w-0 flex-1">
            <MultiWorkflowRunner
              workflows={workflows}
              statuses={workflowStatuses}
              onRunSelected={runMultipleWorkflows}
              onStop={stopRuns}
              isRunning={running}
            />
          </main>
        ) : (
          <main className="min-w-0 flex-1">
            <HistoryView
              results={runResults}
              calls={callHistory}
              workflows={workflows}
              onClearResults={() => setRunResults([])}
              onClearCalls={() => setCallHistory([])}
            />
          </main>
        )}
      </div>
      {showMembers && activeWorkflow && (
        <MemberPickerModal
          title={`Workflow members - ${activeWorkflow.name}`}
          ownerId={activeWorkflow.ownerId ?? user.id}
          currentMemberIds={activeWorkflow.memberIds ?? []}
          onClose={() => setShowMembers(false)}
          onSave={saveWorkflowMembers}
        />
      )}
    </div>
  );
}
