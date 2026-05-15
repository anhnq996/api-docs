import type { ApiSpec, Endpoint, HttpMethod } from "./apiSpec";
import type { Project } from "./projects";

export type AuthType = "none" | "bearer" | "basic" | "api-key" | "oauth2";
export type BodyMode = "none" | "raw" | "form-data" | "url-encoded";
export type RawBodyType = "json" | "xml" | "text";
export type AssertionType = "status" | "responseTime" | "header" | "jsonField" | "bodyContains";
export type AssertionOp = "eq" | "ne" | "lt" | "gt" | "lte" | "gte" | "contains" | "exists";
export type StepStatus = "idle" | "running" | "passed" | "failed" | "skipped";
export type WorkflowRunStatus = "idle" | "queued" | "running" | "passed" | "failed" | "cancelled";

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestAuth {
  type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  oauthAccessToken?: string;
  oauthHeaderPrefix?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthTokenUrl?: string;
  oauthScope?: string;
  oauthGrantType?: "client_credentials" | "password" | "authorization_code";
}

export interface StepRequest {
  id: string;
  name: string;
  method: HttpMethod;
  baseUrl: string;
  availableBaseUrls?: string[];
  path: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyMode?: BodyMode;
  rawType?: RawBodyType;
  formData?: KeyValue[];
  urlEncoded?: KeyValue[];
  auth: RequestAuth;
}

export interface Assertion {
  id: string;
  enabled: boolean;
  type: AssertionType;
  field?: string;
  operator: AssertionOp;
  expected: string;
}

export interface ExecutionConfig {
  iterations: number;
  rampUpDuration: number;
  delay: number;
  timeout: number;
  retryCount: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  enabled: boolean;
  originalRequestId?: string;
  request: StepRequest;
  execution: ExecutionConfig;
  assertions: Assertion[];
  script: string;
}

export interface WorkflowGlobalConfig {
  iterations: number;
  parallel: number;
  globalRampUp: number;
  stopOnError: boolean;
  continueOnError: boolean;
  timeout: number;
}

export interface Workflow {
  id: string;
  projectId?: string | null;
  ownerId?: string;
  memberIds?: string[];
  name: string;
  description: string;
  steps: WorkflowStep[];
  config: WorkflowGlobalConfig;
  env: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AssertionResult {
  type: string;
  field?: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface CallRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  stepId: string;
  stepName: string;
  method: HttpMethod;
  url: string;
  statusCode: number;
  responseTime: number;
  requestPayload: string;
  responseBody: string;
  error?: string;
  timestamp: string;
  assertions: AssertionResult[];
}

export interface StepRunResult {
  stepId: string;
  stepName: string;
  status: StepStatus;
  calls: CallRecord[];
}

export interface WorkflowRunResult {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowRunStatus;
  startedAt: string;
  finishedAt: string;
  stepResults: StepRunResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errorRate: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    throughput: number;
  };
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowGlobalConfig = {
  iterations: 1,
  parallel: 1,
  globalRampUp: 0,
  stopOnError: true,
  continueOnError: false,
  timeout: 120000,
};

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function kv(key = "", value = ""): KeyValue {
  return { id: uid("kv"), key, value, enabled: true };
}

export function makeBlankWorkflow(ownerId: string, projectId?: string | null): Workflow {
  const now = new Date().toISOString();
  return {
    id: uid("wf"),
    ownerId,
    memberIds: [],
    projectId: projectId ?? null,
    name: "New Workflow",
    description: "",
    steps: [],
    config: { ...DEFAULT_WORKFLOW_CONFIG },
    env: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function makeBlankStep(): WorkflowStep {
  return {
    id: uid("step"),
    name: "New Step",
    enabled: true,
    request: {
      id: uid("sreq"),
      name: "New Step",
      method: "GET",
      baseUrl: "https://api.example.com",
      path: "/endpoint",
      headers: [],
      params: [],
      body: "",
      bodyMode: "none",
      rawType: "json",
      auth: { type: "none" },
    },
    execution: { iterations: 1, rampUpDuration: 0, delay: 500, timeout: 30000, retryCount: 0 },
    assertions: [],
    script: "",
  };
}

function stringifyExample(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function baseUrlsFromSpec(spec: ApiSpec) {
  const serverUrls = spec.info.servers?.map((server) => server.url).filter(Boolean) ?? [];
  return serverUrls.length ? serverUrls : [spec.info.baseUrl].filter(Boolean);
}

export function makeStepFromEndpoint(project: Project, endpoint: Endpoint): WorkflowStep {
  const baseUrls = baseUrlsFromSpec(project.spec);
  const body = endpoint.body ?? endpoint.bodies?.[0];
  const headers = [
    ...(endpoint.headers ?? []),
    ...(body ? [{ name: "Content-Type", example: body.contentType }] : []),
  ].map((header) => kv(header.name, String(header.example ?? "")));
  const params = (endpoint.params ?? [])
    .filter((param) => param.in === "query")
    .map((param) => kv(param.name, String(param.example ?? "")));

  return {
    id: uid("step"),
    name: endpoint.summary || endpoint.path,
    enabled: true,
    originalRequestId: endpoint.id,
    request: {
      id: uid("sreq"),
      name: endpoint.summary || endpoint.path,
      method: endpoint.method,
      baseUrl: baseUrls[0] ?? project.spec.info.baseUrl,
      availableBaseUrls: baseUrls,
      path: endpoint.path,
      headers,
      params,
      body: stringifyExample(body?.example),
      bodyMode: body ? "raw" : "none",
      rawType: body?.contentType.toLowerCase().includes("xml") ? "xml" : "json",
      auth: { type: "none" },
    },
    execution: { iterations: 1, rampUpDuration: 0, delay: 500, timeout: 30000, retryCount: 0 },
    assertions: [{ id: uid("asrt"), enabled: true, type: "status", operator: "lt", expected: "400" }],
    script: "",
  };
}
