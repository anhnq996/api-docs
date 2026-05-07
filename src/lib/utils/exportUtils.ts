import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type {
  ApiSpec,
  BodyField,
  Endpoint,
  Param,
  RequestBodySpec,
  ResponseSpec,
} from "../data/apiSpec";

type ExportTheme = "light" | "dark";

type ExportOptions = {
  baseUrl?: string;
  theme?: ExportTheme;
};

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "api-docs"
  );
}

function safeJson(value: unknown) {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function prepareExportSpec(spec: ApiSpec, options: ExportOptions = {}) {
  const baseUrl = options.baseUrl?.trim();
  if (!baseUrl) return spec;

  const servers = spec.info.servers?.length
    ? [
        { url: baseUrl, description: "Selected" },
        ...spec.info.servers.filter((server) => server.url !== baseUrl),
      ]
    : [{ url: baseUrl }];

  return {
    ...spec,
    info: {
      ...spec.info,
      baseUrl,
      servers,
    },
  };
}

function endpointBodies(endpoint: Endpoint): RequestBodySpec[] {
  return endpoint.bodies?.length
    ? endpoint.bodies
    : endpoint.body
      ? [endpoint.body]
      : [];
}

const METHOD_HEX: Record<string, string> = {
  GET: "#22c55e",
  POST: "#3b82f6",
  PUT: "#f59e0b",
  PATCH: "#8b5cf6",
  DELETE: "#ef4444",
};

function statusHex(status: number) {
  if (status < 300) return "#22c55e";
  if (status < 400) return "#3b82f6";
  if (status < 500) return "#f59e0b";
  return "#ef4444";
}

function paramTable(params: Param[], cols: string[]) {
  if (!params.length) return "";
  return `<table>
    <thead><tr>${cols.map((col) => `<th>${esc(col)}</th>`).join("")}</tr></thead>
    <tbody>${params
      .map(
        (param) => `<tr>
      <td class="mono">${esc(param.name)}</td>
      <td class="mono dim">${esc(param.type)}</td>
      <td>${param.required ? '<span class="req">required</span>' : '<span class="opt">optional</span>'}</td>
      <td>${esc(param.description)}</td>
      ${cols.length === 5 ? `<td class="mono dim">${esc(param.example ?? "-")}</td>` : ""}
    </tr>`
      )
      .join("")}</tbody>
  </table>`;
}

function endpointHtml(spec: ApiSpec, endpoint: Endpoint) {
  const pathParams = (endpoint.params ?? []).filter((param) => param.in === "path");
  const queryParams = (endpoint.params ?? []).filter((param) => param.in === "query");
  const headers = endpoint.headers ?? [];
  const bodies = endpointBodies(endpoint);
  const cols5 = ["Tên", "Kiểu", "Bắt buộc", "Mô tả", "Ví dụ"];
  const cols4 = ["Field", "Kiểu", "Bắt buộc", "Mô tả"];

  return `
<div class="ep" id="${esc(endpoint.id)}">
  <div class="ep-title">${esc(endpoint.summary)}</div>
  <div class="ep-desc">${esc(endpoint.description)}</div>
  <div class="ep-path">
    <span class="badge" style="background:${METHOD_HEX[endpoint.method]}22;color:${METHOD_HEX[endpoint.method]}">${endpoint.method}</span>
    <span class="dim">${esc(spec.info.baseUrl)}</span><span>${esc(endpoint.path)}</span>
  </div>

  ${headers.length ? `<div class="sec-title">Headers</div>${paramTable(headers, cols5)}` : ""}
  ${pathParams.length ? `<div class="sec-title">Path Parameters</div>${paramTable(pathParams, cols5)}` : ""}
  ${queryParams.length ? `<div class="sec-title">Query Parameters</div>${paramTable(queryParams, cols5)}` : ""}

  ${bodies
    .map(
      (body) => `<div class="sec-title">Request Body <span class="dim" style="font-size:11px;margin-left:6px">${esc(body.contentType)}</span></div>
    ${
      body.fields.length
        ? `<table>
      <thead><tr>${cols4.map((col) => `<th>${esc(col)}</th>`).join("")}</tr></thead>
      <tbody>${body.fields
          .map(
            (field) => `<tr>
        <td class="mono">${esc(field.name)}</td>
        <td class="mono dim">${esc(field.type)}</td>
        <td>${field.required ? '<span class="req">required</span>' : '<span class="opt">optional</span>'}</td>
        <td>${esc(field.description)}</td>
      </tr>`
          )
          .join("")}</tbody>
    </table>`
        : `<p class="dim">Raw body type: <span class="mono">${esc(body.schemaType ?? "any")}</span></p>`
    }
    <pre><code class="${body.contentType.includes("json") ? "language-json" : ""}">${esc(
      typeof body.example === "string" ? body.example : safeJson(body.example)
    )}</code></pre>`
    )
    .join("")}

  <div class="sec-title">Responses</div>
  ${endpoint.responses
    .map(
      (response) => `
    <div class="resp-block">
      <div class="resp-header">
        <span class="badge" style="background:${statusHex(response.status)}22;color:${statusHex(response.status)}">${response.status}</span>
        <span class="dim">${esc(response.description)}</span>
      </div>
      ${response.example !== null ? `<pre><code class="language-json">${esc(safeJson(response.example))}</code></pre>` : '<p class="no-content">No content</p>'}
    </div>`
    )
    .join("")}
</div>`;
}

function safeScriptJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildInteractiveHtmlString(
  rawSpec: ApiSpec,
  displayTitle = rawSpec.info.title,
  options: ExportOptions = {}
) {
  const spec = prepareExportSpec(rawSpec, options);
  const theme = options.theme ?? "dark";
  const firstEndpoint = spec.tags.flatMap((tag) => tag.endpoints)[0];
  const initialId = firstEndpoint?.id ?? "";
  const isLight = theme === "light";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(displayTitle)} - API Reference</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${isLight ? "github" : "github-dark"}.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<style>
*{box-sizing:border-box}
:root{--bg:#0f1117;--fg:#e2e8f0;--panel:#0a0d14;--panel-2:#111827;--panel-3:#172033;--border:#1e2533;--muted:#94a3b8;--soft:#64748b;--code:#0b1020;--code-fg:#e2e8f0;--accent:#67e8f9;--brand-a:#2563eb;--brand-b:#14b8a6;--shadow:none}
${isLight ? ":root{--bg:#f8fafc;--fg:#0f172a;--panel:#ffffff;--panel-2:#f3f6fa;--panel-3:#eef6ff;--border:#d8e0eb;--muted:#475569;--soft:#64748b;--code:#fbfcfe;--code-fg:#1e293b;--accent:#0f766e;--brand-a:#2563eb;--brand-b:#0891b2;--shadow:0 10px 28px rgba(15,23,42,.06)}" : ""}
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--fg);font-size:14px}
button,select{font:inherit}
.layout{display:flex;min-height:100vh}
.sidebar{width:310px;background:var(--panel);border-right:1px solid var(--border);position:sticky;top:0;height:100vh;overflow:auto;flex-shrink:0}
.sb-hdr{padding:20px 16px 16px;border-bottom:1px solid var(--border)}
.sb-logo{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.sb-icon{width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,var(--brand-a),var(--brand-b));display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800}
.sb-title{font-size:15px;font-weight:750;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-subtitle{font-size:11px;color:var(--soft);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-url{font-size:11px;color:var(--accent);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:var(--panel-2);padding:6px 8px;border:1px solid var(--border);border-radius:6px;display:block;word-break:break-all}
.group{padding:8px}
.group-head{width:100%;display:flex;align-items:center;gap:8px;border:0;background:transparent;color:var(--muted);border-radius:6px;padding:7px 8px;cursor:pointer;text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-weight:750}
.group-head:hover{background:var(--panel-2);color:var(--fg)}
.chev{display:inline-block;width:12px;transition:transform .16s ease}
.group.closed .chev{transform:rotate(-90deg)}
.group-body{display:grid;gap:3px;margin-top:4px}
.group.closed .group-body{display:none}
.ep-link{width:100%;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7px;border:0;background:transparent;color:var(--muted);border-radius:6px;padding:7px 8px;cursor:pointer;text-align:left;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px}
.ep-link:hover{background:var(--panel-2);color:var(--fg)}
.ep-link.active{background:var(--panel-3);color:var(--fg)}
.badge{display:inline-flex;align-items:center;justify-content:center;min-width:48px;border-radius:5px;padding:2px 7px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;font-weight:800}
.badge.sm{min-width:44px;font-size:10px}
.content{flex:1;min-width:0;padding:40px 52px}
.doc-head{padding-bottom:24px;margin-bottom:28px;border-bottom:1px solid var(--border)}
.kicker{font-size:12px;color:var(--soft);margin-bottom:8px}
h1{margin:0;color:var(--fg);font-size:30px;line-height:1.2}
.desc{color:var(--muted);line-height:1.65;margin:10px 0 0}
.endpoint-head{display:grid;gap:14px;margin-bottom:30px}
.pathline{display:flex;align-items:center;gap:8px;max-width:100%;overflow:auto;background:var(--panel-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;box-shadow:var(--shadow)}
.dim{color:var(--soft)}
.section{margin:30px 0}
.section h2{font-size:18px;margin:0 0 12px;color:var(--fg)}
.table-wrap{overflow:auto;border:1px solid var(--border);border-radius:8px;background:var(--panel);box-shadow:var(--shadow)}
table{width:100%;border-collapse:collapse;font-size:13px}
thead{background:var(--panel-2)}
th{text-align:left;color:var(--soft);font-weight:650;padding:10px 12px;border-bottom:1px solid var(--border)}
td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top}
tr:last-child td{border-bottom:0}
.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.req{color:#fb7185}.opt{color:var(--soft)}
.code-card{border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--code);box-shadow:var(--shadow)}
pre{margin:0;padding:14px;overflow:auto}
pre code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.65;white-space:pre;color:var(--code-fg)}
.select-row{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.response-select{min-width:320px;background:var(--panel);color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:9px 10px;box-shadow:var(--shadow)}
.response-box{border:1px solid var(--border);border-radius:8px;padding:14px;background:var(--panel);box-shadow:var(--shadow)}
.resp-head{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.tabs{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--border);margin-bottom:0;background:var(--panel)}
.tab{border:0;background:transparent;color:var(--muted);border-bottom:2px solid transparent;padding:9px 12px;cursor:pointer}
.tab:hover{color:var(--fg)}
.tab.active{color:var(--fg);border-bottom-color:var(--accent)}
${isLight ? ".code-card .hljs{background:transparent;color:var(--code-fg)}.code-card pre{background:var(--code)}.response-box .code-card{background:#ffffff}.tab.active{background:#f0fdfa;color:#0f766e}.tab:hover{background:#f8fafc}.response-select:focus{outline:2px solid rgba(15,118,110,.18);outline-offset:2px}" : ""}
.empty{padding:70px 0;text-align:center;color:var(--muted)}
@media(max-width:860px){.layout{display:block}.sidebar{position:relative;width:100%;height:auto;max-height:48vh}.content{padding:28px 18px}.response-select{min-width:0;width:100%}}
</style>
</head>
<body>
<div class="layout">
  <aside class="sidebar">
    <div class="sb-hdr">
      <div class="sb-logo">
        <div class="sb-icon">API</div>
        <div style="min-width:0">
          <div class="sb-title">${esc(displayTitle)}</div>
          <div class="sb-subtitle">v${esc(spec.info.version)}</div>
        </div>
      </div>
      <code class="sb-url">${esc(spec.info.baseUrl)}</code>
    </div>
    <nav id="sidebar"></nav>
  </aside>
  <main class="content">
    <div class="doc-head">
      <div class="kicker">v${esc(spec.info.version)}</div>
      <h1>${esc(displayTitle)}</h1>
      <p class="desc">${esc(spec.info.description)}</p>
    </div>
    <div id="detail"></div>
  </main>
</div>
<script>
const spec = ${safeScriptJson(spec)};
const displayTitle = ${safeScriptJson(displayTitle)};
const state = {
  activeId: ${safeScriptJson(initialId)},
  activeResponse: null,
  activeBody: null,
  activeLang: "cURL",
  openGroups: Object.fromEntries((spec.tags || []).map((tag, index) => [tag.name, index === 0]))
};
const methodColors = ${safeScriptJson(METHOD_HEX)};
const langs = ["cURL", "Node.js", "PHP", "Go", "Java", "Python"];
const langClass = {"cURL":"bash","Node.js":"javascript","PHP":"php","Go":"go","Java":"java","Python":"python"};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function json(value) {
  if (value === null || value === undefined) return "";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
function endpointList() {
  return (spec.tags || []).flatMap((tag) => (tag.endpoints || []).map((endpoint) => ({...endpoint, tagName: tag.name})));
}
function activeEndpoint() {
  return endpointList().find((endpoint) => endpoint.id === state.activeId) || endpointList()[0];
}
function bodyChoices(endpoint) {
  if (!endpoint) return [];
  return endpoint.bodies && endpoint.bodies.length ? endpoint.bodies : (endpoint.body ? [endpoint.body] : []);
}
function activeBody(endpoint) {
  const bodies = bodyChoices(endpoint);
  return bodies.find((body) => body.contentType === state.activeBody) || bodies[0];
}
function statusColor(status) {
  if (status < 300) return "#22c55e";
  if (status < 400) return "#3b82f6";
  if (status < 500) return "#f59e0b";
  return "#ef4444";
}
function methodBadge(method, small = false) {
  const color = methodColors[method] || "#94a3b8";
  return '<span class="badge ' + (small ? "sm" : "") + '" style="background:' + color + '22;color:' + color + '">' + escapeHtml(method) + '</span>';
}
function statusBadge(status) {
  const color = statusColor(Number(status));
  return '<span class="badge" style="background:' + color + '22;color:' + color + '">' + escapeHtml(status) + '</span>';
}
function renderSidebar() {
  const active = activeEndpoint();
  document.getElementById("sidebar").innerHTML = (spec.tags || []).map((tag) => {
    const open = state.openGroups[tag.name];
    const endpoints = tag.endpoints || [];
    return '<div class="group ' + (open ? "" : "closed") + '">' +
      '<button class="group-head" data-group="' + escapeHtml(tag.name) + '"><span class="chev">⌄</span><span style="flex:1;text-align:left">' + escapeHtml(tag.name) + '</span><span>' + endpoints.length + '</span></button>' +
      '<div class="group-body">' +
        endpoints.map((endpoint) =>
          '<button class="ep-link ' + (active && active.id === endpoint.id ? "active" : "") + '" data-endpoint="' + escapeHtml(endpoint.id) + '">' +
            methodBadge(endpoint.method, true) + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(endpoint.path) + '</span>' +
          '</button>'
        ).join("") +
      '</div></div>';
  }).join("");

  document.querySelectorAll("[data-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.getAttribute("data-group");
      state.openGroups[name] = !state.openGroups[name];
      renderSidebar();
    });
  });
  document.querySelectorAll("[data-endpoint]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeId = button.getAttribute("data-endpoint");
      state.activeResponse = null;
      state.activeBody = null;
      state.activeLang = "cURL";
      render();
    });
  });
}
function table(headers, rows) {
  if (!rows.length) return "";
  return '<div class="table-wrap"><table><thead><tr>' + headers.map((header) => '<th>' + escapeHtml(header) + '</th>').join("") + '</tr></thead><tbody>' +
    rows.map((row) => '<tr>' + row.map((cell) => '<td>' + cell + '</td>').join("") + '</tr>').join("") +
    '</tbody></table></div>';
}
function paramTable(title, items) {
  if (!items || !items.length) return "";
  const rows = items.map((param) => [
    '<span class="mono">' + escapeHtml(param.name) + '</span>',
    '<span class="mono dim">' + escapeHtml(param.type) + '</span>',
    param.required ? '<span class="req">required</span>' : '<span class="opt">optional</span>',
    escapeHtml(param.description),
    '<span class="mono dim">' + escapeHtml(param.example ?? "-") + '</span>'
  ]);
  return '<section class="section"><h2>' + escapeHtml(title) + '</h2>' + table(["Tên","Kiểu","Bắt buộc","Mô tả","Ví dụ"], rows) + '</section>';
}
function bodyTable(body) {
  if (!body) return "";
  const rows = (body.fields || []).map((field) => [
    '<span class="mono">' + escapeHtml(field.name) + '</span>',
    '<span class="mono dim">' + escapeHtml(field.type) + '</span>',
    field.required ? '<span class="req">required</span>' : '<span class="opt">optional</span>',
    escapeHtml(field.description),
    '<span class="mono dim">' + escapeHtml(field.example ?? "-") + '</span>'
  ]);
  return '<section class="section"><h2>Request Body</h2><p class="dim">Content-Type: <span class="mono">' + escapeHtml(body.contentType) + '</span></p>' +
    table(["Field","Kiểu","Bắt buộc","Mô tả","Ví dụ"], rows) +
    '<div class="code-card" style="margin-top:12px"><pre><code class="language-json">' + escapeHtml(json(body.example)) + '</code></pre></div></section>';
}
function bodyTableForEndpoint(endpoint) {
  const bodies = bodyChoices(endpoint);
  const body = activeBody(endpoint);
  if (!body) return "";
  const tabs = bodies.length > 1
    ? '<div class="tabs" style="margin-bottom:12px">' + bodies.map((item) => '<button class="tab ' + (item.contentType === body.contentType ? "active" : "") + '" data-body="' + escapeHtml(item.contentType) + '">' + escapeHtml(item.contentType) + '</button>').join("") + '</div>'
    : "";
  const rows = (body.fields || []).map((field) => [
    '<span class="mono">' + escapeHtml(field.name) + '</span>',
    '<span class="mono dim">' + escapeHtml(field.type) + '</span>',
    field.required ? '<span class="req">required</span>' : '<span class="opt">optional</span>',
    escapeHtml(field.description),
    '<span class="mono dim">' + escapeHtml(field.example ?? "-") + '</span>'
  ]);
  return '<section class="section"><h2>Request Body</h2>' + tabs +
    (bodies.length === 1 ? '<p class="dim">Content-Type: <span class="mono">' + escapeHtml(body.contentType) + '</span></p>' : "") +
    (body.description ? '<p class="dim">' + escapeHtml(body.description) + '</p>' : "") +
    (rows.length ? table(["Field","Type","Required","Description","Example"], rows) : '<div class="response-box"><span class="dim">Raw body type: </span><span class="mono">' + escapeHtml(body.schemaType || "any") + '</span></div>') +
    '<div class="code-card" style="margin-top:12px"><pre><code class="' + (body.contentType.includes("json") ? "language-json" : "") + '">' + escapeHtml(typeof body.example === "string" ? body.example : json(body.example)) + '</code></pre></div></section>';
}
function phpArray(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "[" + value.map(phpArray).join(", ") + "]";
  if (typeof value === "object") return "[" + Object.entries(value).map(([key, val]) => '"' + key + '" => ' + phpArray(val)).join(", ") + "]";
  if (typeof value === "string") return '"' + value.replace(/"/g, '\\"') + '"';
  return String(value);
}
function buildCode(endpoint, lang) {
  const baseUrl = spec.info.baseUrl || "";
  const headers = {};
  (endpoint.headers || []).forEach((header) => headers[header.name] = header.example || "");
  if (endpoint.body) headers["Content-Type"] = endpoint.body.contentType;
  if (lang === "cURL") {
    const lines = ['curl -X ' + endpoint.method + ' "' + baseUrl + endpoint.path + '"'];
    (endpoint.headers || []).forEach((header) => lines.push('  -H "' + header.name + ': ' + (header.example || "") + '"'));
    if (endpoint.body) {
      lines.push('  -H "Content-Type: ' + endpoint.body.contentType + '"');
      lines.push("  -d '" + JSON.stringify(endpoint.body.example) + "'");
    }
    return lines.join("\\n");
  }
  if (lang === "Node.js") {
    const payload = endpoint.body ? 'const payload = ' + json(endpoint.body.example) + ';\\n\\n' : "";
    return payload + 'const res = await fetch("' + baseUrl + endpoint.path + '", {\\n  method: "' + endpoint.method + '",\\n  headers: ' + json(headers) + (endpoint.body ? ',\\n  body: JSON.stringify(payload)' : '') + '\\n});\\nconst data = await res.json();\\nconsole.log(data);';
  }
  if (lang === "PHP") {
    const headerList = Object.entries(headers).map(([key, value]) => '"' + key + ': ' + value + '"').join(", ");
    const body = endpoint.body ? "\\n$payload = " + phpArray(endpoint.body.example) + ";\\n" : "";
    return "<?php\\n" + body + '$ch = curl_init("' + baseUrl + endpoint.path + '");\\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, "' + endpoint.method + '");\\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\\ncurl_setopt($ch, CURLOPT_HTTPHEADER, [' + headerList + ']);' + (endpoint.body ? "\\ncurl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));" : "") + "\\n$response = curl_exec($ch);\\ncurl_close($ch);\\necho $response;";
  }
  if (lang === "Go") {
    const headerLines = Object.entries(headers).map(([key, value]) => '\\treq.Header.Set("' + key + '", "' + value + '")').join("\\n");
    const bodyInit = endpoint.body ? 'payload := []byte(' + JSON.stringify(JSON.stringify(endpoint.body.example)) + ')\\n\\treq, _ := http.NewRequest("' + endpoint.method + '", url, bytes.NewBuffer(payload))' : 'req, _ := http.NewRequest("' + endpoint.method + '", url, nil)';
    return 'package main\\n\\nimport (\\n\\t"bytes"\\n\\t"fmt"\\n\\t"io"\\n\\t"net/http"\\n)\\n\\nfunc main() {\\n\\turl := "' + baseUrl + endpoint.path + '"\\n\\t' + bodyInit + "\\n" + headerLines + '\\n\\tresp, _ := http.DefaultClient.Do(req)\\n\\tdefer resp.Body.Close()\\n\\tbody, _ := io.ReadAll(resp.Body)\\n\\tfmt.Println(string(body))\\n}';
  }
  if (lang === "Java") {
    const headerLines = Object.entries(headers).map(([key, value]) => '    .header("' + key + '", "' + value + '")').join("\\n");
    const bodyLine = endpoint.body ? '.method("' + endpoint.method + '", HttpRequest.BodyPublishers.ofString(' + JSON.stringify(JSON.stringify(endpoint.body.example)) + '))' : '.method("' + endpoint.method + '", HttpRequest.BodyPublishers.noBody())';
    return 'import java.net.URI;\\nimport java.net.http.*;\\n\\nHttpClient client = HttpClient.newHttpClient();\\nHttpRequest request = HttpRequest.newBuilder()\\n    .uri(URI.create("' + baseUrl + endpoint.path + '"))\\n' + headerLines + "\\n    " + bodyLine + "\\n    .build();\\n\\nHttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\\nSystem.out.println(response.body());";
  }
  return 'import requests\\n\\nurl = "' + baseUrl + endpoint.path + '"\\nheaders = ' + JSON.stringify(headers, null, 4) + "\\n" + (endpoint.body ? "payload = " + JSON.stringify(endpoint.body.example, null, 4) + "\\n" : "") + 'response = requests.request("' + endpoint.method + '", url, headers=headers' + (endpoint.body ? ", json=payload" : "") + ')\\nprint(response.json())';
}
function buildCodeForEndpoint(endpoint, lang) {
  const body = activeBody(endpoint);
  return buildCode(body ? {...endpoint, body} : endpoint, lang);
}
function renderResponses(endpoint) {
  const responses = endpoint.responses || [];
  const activeStatus = state.activeResponse ?? (responses[0] && responses[0].status);
  const active = responses.find((response) => response.status === Number(activeStatus)) || responses[0];
  if (!active) return "";
  return '<section class="section"><h2>Responses</h2><div class="select-row"><select class="response-select" id="responseSelect">' +
    responses.map((response) => '<option value="' + response.status + '" ' + (response.status === active.status ? "selected" : "") + '>' + response.status + ' - ' + escapeHtml(response.description) + '</option>').join("") +
    '</select></div><div class="response-box"><div class="resp-head">' + statusBadge(active.status) + '<span>' + escapeHtml(active.description) + '</span></div><div class="code-card"><pre><code class="language-json">' + escapeHtml(active.example === null ? "// No content" : json(active.example)) + '</code></pre></div></div></section>';
}
function renderCode(endpoint) {
  return '<section class="section"><h2>Code examples</h2><div class="code-card"><div class="tabs">' +
    langs.map((lang) => '<button class="tab ' + (lang === state.activeLang ? "active" : "") + '" data-lang="' + lang + '">' + lang + '</button>').join("") +
    '</div><pre><code class="language-' + langClass[state.activeLang] + '" id="codeExample"></code></pre></div></section>';
}
function renderDetail() {
  const endpoint = activeEndpoint();
  const detail = document.getElementById("detail");
  if (!endpoint) {
    detail.innerHTML = '<div class="empty">Không tìm thấy endpoint hợp lệ.</div>';
    return;
  }
  const pathParams = (endpoint.params || []).filter((param) => param.in === "path");
  const queryParams = (endpoint.params || []).filter((param) => param.in === "query");
  const headers = endpoint.headers || [];
  detail.innerHTML =
    '<div class="endpoint-head"><div class="kicker">' + escapeHtml(endpoint.tagName || "API Reference") + '</div><h1>' + escapeHtml(endpoint.summary) + '</h1>' +
    '<p class="desc">' + escapeHtml(endpoint.description) + '</p><div class="pathline">' + methodBadge(endpoint.method) + '<span class="dim">' + escapeHtml(spec.info.baseUrl || "") + '</span><span>' + escapeHtml(endpoint.path) + '</span></div></div>' +
    paramTable("Headers", headers) +
    paramTable("Path Parameters", pathParams) +
    paramTable("Query Parameters", queryParams) +
    bodyTableForEndpoint(endpoint) +
    renderResponses(endpoint) +
    renderCode(endpoint);

  const responseSelect = document.getElementById("responseSelect");
  if (responseSelect) {
    responseSelect.addEventListener("change", (event) => {
      state.activeResponse = Number(event.target.value);
      renderDetail();
    });
  }
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeLang = button.getAttribute("data-lang");
      renderDetail();
    });
  });
  document.querySelectorAll("[data-body]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeBody = button.getAttribute("data-body");
      renderDetail();
    });
  });
  const code = document.getElementById("codeExample");
  if (code) code.textContent = buildCodeForEndpoint(endpoint, state.activeLang);
  document.querySelectorAll("pre code").forEach((block) => {
    block.removeAttribute("data-highlighted");
    if (window.hljs) hljs.highlightElement(block);
  });
}
function render() {
  const active = activeEndpoint();
  if (active) state.openGroups[active.tagName] = true;
  renderSidebar();
  renderDetail();
}
render();
</script>
</body>
</html>`;
}

function buildHtmlString(
  rawSpec: ApiSpec,
  displayTitle = rawSpec.info.title,
  forPrint = false,
  options: ExportOptions = {}
) {
  const spec = prepareExportSpec(rawSpec, options);
  const toc = spec.tags
    .map(
      (tag) => `
      <div class="toc-group">
        <div class="toc-tag">${esc(tag.name)}</div>
        ${tag.endpoints
          .map(
            (endpoint) => `
          <a href="#${esc(endpoint.id)}" class="toc-ep">
            <span class="badge sm" style="background:${METHOD_HEX[endpoint.method]}22;color:${METHOD_HEX[endpoint.method]}">${endpoint.method}</span>
            ${esc(endpoint.path)}
          </a>`
          )
          .join("")}
      </div>`
    )
    .join("");

  const content = spec.tags
    .map(
      (tag) => `
      <section class="tag-sec">
        <h2 class="tag-name">${esc(tag.name)}</h2>
        ${tag.description ? `<p class="tag-desc">${esc(tag.description)}</p>` : ""}
        ${tag.endpoints.map((endpoint) => endpointHtml(spec, endpoint)).join("")}
      </section>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(displayTitle)} - API Reference</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1117;color:#e2e8f0;font-size:14px}
a{color:#60a5fa;text-decoration:none}
.layout{display:flex;min-height:100vh}
.sidebar{width:270px;background:#0a0d14;border-right:1px solid #1e2533;padding:0;position:sticky;top:0;height:100vh;overflow-y:auto;flex-shrink:0;display:flex;flex-direction:column}
.sb-hdr{padding:20px 16px 16px;border-bottom:1px solid #1e2533}
.sb-logo{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.sb-icon{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px}
.sb-title{font-size:15px;font-weight:700;color:#f1f5f9}
.sb-subtitle{font-size:11px;color:#64748b;margin-top:2px}
.sb-url{font-size:11px;color:#3b82f6;font-family:monospace;background:#1e2533;padding:4px 8px;border-radius:4px;margin-top:8px;display:block;word-break:break-all}
.sb-nav{flex:1;overflow-y:auto;padding:8px 0 16px}
.toc-group{padding:0 8px;margin-bottom:4px}
.toc-tag{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#475569;padding:8px 8px 4px;font-weight:600}
.toc-ep{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;font-size:12px;font-family:monospace;color:#94a3b8;transition:background .15s}
.toc-ep:hover{background:#1e2533;color:#e2e8f0}
.content{flex:1;padding:48px 64px;max-width:900px}
.api-hdr{margin-bottom:48px;padding-bottom:32px;border-bottom:1px solid #1e2533}
.api-title{font-size:30px;font-weight:800;color:#f1f5f9;margin-bottom:8px}
.api-meta{color:#64748b;font-size:13px;margin-bottom:14px}
.api-desc{color:#94a3b8;line-height:1.7;margin-bottom:16px}
.api-url{font-family:monospace;font-size:13px;background:#1e2533;color:#60a5fa;padding:8px 14px;border-radius:8px;display:inline-block}
.tag-sec{margin-bottom:56px}
.tag-name{font-size:20px;font-weight:700;color:#f1f5f9;padding-bottom:10px;border-bottom:2px solid #1e2533;margin-bottom:6px}
.tag-desc{color:#94a3b8;font-size:13px;margin-bottom:20px}
.ep{background:#0a0d14;border:1px solid #1e2533;border-radius:12px;padding:28px;margin-bottom:24px;${forPrint ? "break-inside:avoid;page-break-inside:avoid;" : ""}}
.ep-title{font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:6px}
.ep-desc{color:#94a3b8;font-size:13px;line-height:1.6;margin-bottom:14px}
.ep-path{display:inline-flex;align-items:center;gap:8px;background:#131820;border:1px solid #1e2533;padding:9px 14px;border-radius:8px;font-family:monospace;font-size:13px}
.sec-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:20px 0 8px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px}
thead{background:#131820}
th{text-align:left;padding:9px 12px;color:#64748b;font-weight:500;border-bottom:1px solid #1e2533}
td{padding:9px 12px;border-bottom:1px solid #131820;vertical-align:top}
.mono{font-family:monospace}.dim{color:#64748b}.req{color:#f87171;font-size:11px}.opt{color:#64748b;font-size:11px}
.badge{display:inline-flex;align-items:center;justify-content:center;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;font-family:monospace;min-width:48px;text-align:center}
.badge.sm{font-size:10px;padding:1px 6px;min-width:40px}
pre{margin:8px 0;border-radius:8px;overflow:hidden;background:#111827;padding:12px}
pre code.hljs,pre code{font-size:12px;line-height:1.6;font-family:'Fira Code',Consolas,monospace;white-space:pre-wrap}
.resp-block{margin-bottom:14px}.resp-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}.no-content{color:#64748b;font-size:12px;font-style:italic;padding:6px 0}
${forPrint ? "@media print{body{background:#fff;color:#0f172a}.sidebar{display:none}.content{max-width:100%;padding:24px}.api-title,.tag-name,.ep-title{color:#0f172a}.api-hdr,.tag-name{border-color:#e2e8f0}.ep{background:#f8fafc;border-color:#e2e8f0;page-break-inside:avoid}.ep-path,thead,pre{background:#f1f5f9;border-color:#e2e8f0}.tag-sec{page-break-before:always}.tag-sec:first-child{page-break-before:avoid}}" : ""}
</style>
</head>
<body>
<div class="layout">
  ${
    !forPrint
      ? `<nav class="sidebar">
    <div class="sb-hdr">
      <div class="sb-logo">
        <div class="sb-icon">API</div>
        <div>
          <div class="sb-title">${esc(displayTitle)}</div>
          <div class="sb-subtitle">v${esc(spec.info.version)}</div>
        </div>
      </div>
      <code class="sb-url">${esc(spec.info.baseUrl)}</code>
    </div>
    <div class="sb-nav">${toc}</div>
  </nav>`
      : ""
  }
  <main class="content">
    <div class="api-hdr">
      <h1 class="api-title">${esc(displayTitle)}</h1>
      <div class="api-meta">v${esc(spec.info.version)}</div>
      <p class="api-desc">${esc(spec.info.description)}</p>
      <code class="api-url">${esc(spec.info.baseUrl)}</code>
    </div>
    ${content}
  </main>
</div>
<script>hljs.highlightAll();</script>
</body>
</html>`;
}

export function exportHTML(
  spec: ApiSpec,
  displayTitle = spec.info.title,
  options: ExportOptions = {}
) {
  const html = buildInteractiveHtmlString(spec, displayTitle, options);
  download(`${slugify(displayTitle)}-api-docs.html`, new Blob([html], { type: "text/html" }));
}

export function exportPDF(
  spec: ApiSpec,
  displayTitle = spec.info.title,
  options: ExportOptions = {}
) {
  const html = buildHtmlString(spec, displayTitle, true, options);
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Vui lòng cho phép popup để xuất PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 800);
}

function toOpenApiType(type: string): { type: string; items?: { type: string } } {
  if (type.endsWith("[]")) return { type: "array", items: { type: type.slice(0, -2) } };
  if (type === "integer") return { type: "integer" };
  if (type === "number") return { type: "number" };
  if (type === "boolean") return { type: "boolean" };
  if (type === "object") return { type: "object" };
  return { type: "string" };
}

export function exportSwagger(
  rawSpec: ApiSpec,
  displayTitle = rawSpec.info.title,
  options: ExportOptions = {}
) {
  const spec = prepareExportSpec(rawSpec, options);
  const paths: Record<string, Record<string, unknown>> = {};

  spec.tags.forEach((tag) => {
    tag.endpoints.forEach((endpoint) => {
      if (!paths[endpoint.path]) paths[endpoint.path] = {};
      const method = endpoint.method.toLowerCase();
      const parameters = [
        ...(endpoint.headers ?? []).map((header) => ({
          name: header.name,
          in: "header",
          required: header.required ?? false,
          description: header.description,
          schema: toOpenApiType(header.type),
          example: header.example,
        })),
        ...(endpoint.params ?? []).map((param) => ({
          name: param.name,
          in: param.in,
          required: param.required ?? param.in === "path",
          description: param.description,
          schema: toOpenApiType(param.type),
          example: param.example,
        })),
      ];

      const requestBodies = endpointBodies(endpoint);
      const requestBody = requestBodies.length
        ? {
            required: true,
            content: Object.fromEntries(
              requestBodies.map((body) => [
                body.contentType,
                {
                schema: {
                  type: body.fields.length ? "object" : body.schemaType ?? "string",
                  ...(body.fields.length
                    ? {
                        required: body.fields.filter((field) => field.required).map((field) => field.name),
                        properties: Object.fromEntries(
                          body.fields.map((field) => [
                            field.name,
                            {
                              ...toOpenApiType(field.type),
                              description: field.description,
                              example: field.example,
                            },
                          ])
                        ),
                      }
                    : {}),
                },
                example: body.example,
              },
              ])
            ),
          }
        : undefined;

      const responses: Record<string, unknown> = {};
      endpoint.responses.forEach((response) => {
        responses[String(response.status)] = {
          description: response.description,
          ...(response.example !== null
            ? {
                content: {
                  "application/json": {
                    schema: { type: "object" },
                    example: response.example,
                  },
                },
              }
            : {}),
        };
      });

      paths[endpoint.path][method] = {
        tags: [tag.name],
        summary: endpoint.summary,
        description: endpoint.description,
        operationId: endpoint.id,
        parameters,
        ...(requestBody ? { requestBody } : {}),
        responses,
      };
    });
  });

  const openapi = {
    openapi: "3.0.3",
    info: {
      title: displayTitle,
      version: spec.info.version,
      description: spec.info.description,
    },
    servers: spec.info.servers?.length ? spec.info.servers : [{ url: spec.info.baseUrl }],
    tags: spec.tags.map((tag) => ({ name: tag.name, description: tag.description })),
    paths,
  };

  download(
    `${slugify(displayTitle)}-swagger.json`,
    new Blob([JSON.stringify(openapi, null, 2)], { type: "application/json" })
  );
}

function wordText(text: unknown, options: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text: String(text ?? ""),
    bold: options.bold,
    size: options.size,
    color: options.color,
  });
}

function docParagraph(text: unknown, options: { bold?: boolean; size?: number; color?: string } = {}) {
  return new Paragraph({ children: [wordText(text, options)], spacing: { after: 120 } });
}

function codeParagraph(text: unknown) {
  return new Paragraph({
    children: [wordText(String(text ?? ""), { color: "1f2937", size: 18 })],
    shading: { fill: "f3f4f6" },
    spacing: { before: 80, after: 160 },
  });
}

function tableCell(text: unknown, header = false) {
  return new TableCell({
    shading: header ? { fill: "e5e7eb" } : undefined,
    children: [
      new Paragraph({
        children: [wordText(text, { bold: header, size: 18 })],
      }),
    ],
  });
}

function makeTable(rows: unknown[][]) {
  if (!rows.length) return undefined;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (row, index) =>
        new TableRow({
          children: row.map((cell) => tableCell(cell, index === 0)),
        })
    ),
  });
}

function pushTable(children: WordChild[], rows: unknown[][]) {
  const table = makeTable(rows);
  if (table) {
    children.push(table);
    children.push(new Paragraph({ text: "" }));
  }
}

type WordChild = Paragraph | Table;

function paramRows(title: string, params: Param[]) {
  if (!params.length) return [];
  return [
    [title, "Kiểu", "Bắt buộc", "Mô tả", "Ví dụ"],
    ...params.map((param) => [
      param.name,
      param.type,
      param.required ? "required" : "optional",
      param.description,
      param.example ?? "",
    ]),
  ];
}

function bodyRows(fields: BodyField[]) {
  if (!fields.length) return [];
  return [
    ["Field", "Kiểu", "Bắt buộc", "Mô tả", "Ví dụ"],
    ...fields.map((field) => [
      field.name,
      field.type,
      field.required ? "required" : "optional",
      field.description,
      field.example ?? "",
    ]),
  ];
}

function responseRows(responses: ResponseSpec[]) {
  return [
    ["Status", "Mô tả"],
    ...responses.map((response) => [response.status, response.description]),
  ];
}

export async function exportWord(
  rawSpec: ApiSpec,
  displayTitle = rawSpec.info.title,
  options: ExportOptions = {}
) {
  const spec = prepareExportSpec(rawSpec, options);
  const children: WordChild[] = [
    new Paragraph({
      text: displayTitle,
      heading: HeadingLevel.TITLE,
      spacing: { after: 180 },
    }),
    docParagraph(`OpenAPI: ${spec.info.title}`),
    docParagraph(`Version: ${spec.info.version}`),
    docParagraph(`Base URL: ${spec.info.baseUrl}`),
    docParagraph(spec.info.description),
    new Paragraph({
      text: "Mục lục endpoints",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }),
  ];

  pushTable(children, [
    ["Method", "Path", "Tên", "Nhóm"],
    ...spec.tags.flatMap((tag) =>
      tag.endpoints.map((endpoint) => [endpoint.method, endpoint.path, endpoint.summary, tag.name])
    ),
  ]);

  spec.tags.forEach((tag) => {
    children.push(
      new Paragraph({
        text: tag.name,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 120 },
      })
    );
    if (tag.description) children.push(docParagraph(tag.description));

    tag.endpoints.forEach((endpoint) => {
      const pathParams = (endpoint.params ?? []).filter((param) => param.in === "path");
      const queryParams = (endpoint.params ?? []).filter((param) => param.in === "query");
      const headers = endpoint.headers ?? [];

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: endpoint.method, bold: true, color: METHOD_HEX[endpoint.method].slice(1) }),
            new TextRun({ text: ` ${endpoint.path} - ${endpoint.summary}`, bold: true }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 220, after: 100 },
        })
      );
      if (endpoint.description) children.push(docParagraph(endpoint.description));
      children.push(codeParagraph(`${spec.info.baseUrl}${endpoint.path}`));

      pushTable(children, paramRows("Header", headers));
      pushTable(children, paramRows("Path param", pathParams));
      pushTable(children, paramRows("Query param", queryParams));

      endpointBodies(endpoint).forEach((body) => {
        children.push(docParagraph(`Request body: ${body.contentType}`, { bold: true }));
        if (body.description) children.push(docParagraph(body.description));
        if (body.fields.length) {
          pushTable(children, bodyRows(body.fields));
        } else {
          children.push(docParagraph(`Raw body type: ${body.schemaType ?? "any"}`));
        }
        if (body.example !== undefined) {
          children.push(docParagraph("Request example", { bold: true }));
          children.push(
            codeParagraph(
              typeof body.example === "string" ? body.example : safeJson(body.example)
            )
          );
        }
      });

      children.push(docParagraph("Responses", { bold: true }));
      pushTable(children, responseRows(endpoint.responses));
      endpoint.responses.forEach((response) => {
        children.push(docParagraph(`Response ${response.status}: ${response.description}`, { bold: true }));
        children.push(codeParagraph(response.example === null ? "No content" : safeJson(response.example)));
      });
    });
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  download(`${slugify(displayTitle)}-api-docs.docx`, blob);
}
