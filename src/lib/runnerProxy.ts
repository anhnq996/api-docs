export type RunnerProxyBody =
  | { bodyType: "none"; body?: undefined }
  | { bodyType: "text"; body: string }
  | { bodyType: "form-data"; body: [string, string][] };

export type RunnerProxyResponse = {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
  error?: string;
};

const RUNNER_PROXY_PATH = "/api/runner-proxy";

export function parseJsonBody(body: string) {
  if (!body.trim()) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

export function headerValue(headers: [string, string][], name: string) {
  return headers.find(([headerName]) => headerName.toLowerCase() === name.toLowerCase())?.[1];
}

export function serializeRunnerProxyBody(body: BodyInit | undefined): RunnerProxyBody {
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

export function normalizeProxyHeaders(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is [unknown, unknown] => Array.isArray(item) && item.length >= 2)
    .map(([name, itemValue]) => [String(name), String(itemValue)]);
}

export async function runnerProxyFetch({
  url,
  method,
  headers,
  body,
  signal,
}: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: BodyInit;
  signal?: AbortSignal;
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
    signal,
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
