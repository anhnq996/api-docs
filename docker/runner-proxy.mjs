const DEFAULT_MAX_REQUEST_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function writeJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;

    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const raw = await readBody(
    req,
    envNumber("RUNNER_PROXY_MAX_REQUEST_BYTES", DEFAULT_MAX_REQUEST_BYTES)
  );
  return raw ? JSON.parse(raw) : {};
}

async function readResponseText(response) {
  const maxBytes = envNumber("RUNNER_PROXY_MAX_RESPONSE_BYTES", DEFAULT_MAX_RESPONSE_BYTES);
  const reader = response.body?.getReader();

  if (!reader) return "";

  const chunks = [];
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      throw new Error("Response body too large");
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function parseTargetUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Target URL is required");
  }

  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }

  return url;
}

function isAllowedTarget(url) {
  const raw = process.env.RUNNER_PROXY_ALLOWED_ORIGINS || "";
  const allowedOrigins = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!allowedOrigins.length) return true;
  return allowedOrigins.includes(url.origin);
}

function normalizeMethod(value) {
  const method = typeof value === "string" ? value.toUpperCase() : "GET";
  if (!/^[A-Z]+$/.test(method)) throw new Error("Invalid HTTP method");
  return method;
}

function normalizeHeaders(value) {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value)
      : [];
  const headers = new Headers();

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const name = String(entry[0]).trim();
    const headerValue = String(entry[1]);
    const lowerName = name.toLowerCase();

    if (!name || hopByHopHeaders.has(lowerName)) continue;
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) continue;

    headers.set(name, headerValue);
  }

  return headers;
}

function removeHeader(headers, name) {
  for (const key of Array.from(headers.keys())) {
    if (key.toLowerCase() === name.toLowerCase()) headers.delete(key);
  }
}

function buildProxyBody(payload, headers, method) {
  if (method === "GET" || method === "HEAD" || payload.bodyType === "none") {
    return undefined;
  }

  if (payload.bodyType === "form-data") {
    const form = new FormData();
    const rows = Array.isArray(payload.body) ? payload.body : [];

    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 2) continue;
      form.append(String(row[0]), String(row[1]));
    }

    removeHeader(headers, "content-type");
    return form;
  }

  return typeof payload.body === "string" ? payload.body : "";
}

function responseHeaders(response) {
  return Array.from(response.headers.entries()).filter(
    ([name]) => !hopByHopHeaders.has(name.toLowerCase())
  );
}

export async function handleRunnerProxy(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Cache-Control": "no-store" });
    res.end();
    return;
  }

  if (req.method !== "POST") {
    writeJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const targetUrl = parseTargetUrl(payload.url);

    if (!isAllowedTarget(targetUrl)) {
      writeJson(res, 403, { error: "target_origin_not_allowed" });
      return;
    }

    const method = normalizeMethod(payload.method);
    const headers = normalizeHeaders(payload.headers);
    const body = buildProxyBody(payload, headers, method);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      envNumber("RUNNER_PROXY_TIMEOUT_MS", DEFAULT_TIMEOUT_MS)
    );

    try {
      const upstream = await fetch(targetUrl, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: controller.signal,
      });

      const text = await readResponseText(upstream);
      writeJson(res, 200, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders(upstream),
        body: text,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy request failed";
    const status = error instanceof SyntaxError ? 400 : 502;
    writeJson(res, status, { error: message });
  }
}
