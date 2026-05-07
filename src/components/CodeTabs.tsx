"use client";

import { useState } from "react";
import type { Endpoint, RequestBodySpec } from "@/lib/data/apiSpec";
import { CodeBlock } from "./CodeBlock";

const LANGS = ["cURL", "Node.js", "PHP", "Go", "Java", "Python"] as const;
type Lang = (typeof LANGS)[number];

function buildCurl(ep: Endpoint, baseUrl: string) {
  const lines = [`curl -X ${ep.method} "${baseUrl}${ep.path}"`];
  (ep.headers ?? []).forEach((h) => {
    lines.push(`  -H "${h.name}: ${h.example ?? ""}"`);
  });
  if (ep.body) {
    lines.push(`  -H "Content-Type: ${ep.body.contentType}"`);
    lines.push(`  -d '${JSON.stringify(ep.body.example)}'`);
  }
  return lines.join(" \\\n");
}

function buildNode(ep: Endpoint, baseUrl: string) {
  const headers: Record<string, string> = {};
  (ep.headers ?? []).forEach((h) => (headers[h.name] = h.example ?? ""));
  if (ep.body) headers["Content-Type"] = ep.body.contentType;
  const payload = ep.body
    ? `const payload = ${JSON.stringify(ep.body.example, null, 2)};\n\n`
    : "";
  return `${payload}const res = await fetch("${baseUrl}${ep.path}", {
  method: "${ep.method}",
  headers: ${JSON.stringify(headers, null, 2)}${ep.body ? ",\n  body: JSON.stringify(payload)" : ""}
});
const data = await res.json();
console.log(data);`;
}

function buildPhp(ep: Endpoint, baseUrl: string) {
  const headers = (ep.headers ?? []).map((h) => `"${h.name}: ${h.example ?? ""}"`);
  if (ep.body) headers.push(`"Content-Type: ${ep.body.contentType}"`);
  const body = ep.body ? `\n$payload = ${phpArray(ep.body.example)};\n` : "";
  return `<?php
${body}$ch = curl_init("${baseUrl}${ep.path}");
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${ep.method}");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [${headers.join(", ")}]);${
    ep.body ? `\ncurl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));` : ""
  }
$response = curl_exec($ch);
curl_close($ch);
echo $response;`;
}

function phpArray(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "[" + v.map(phpArray).join(", ") + "]";
  if (typeof v === "object") {
    return (
      "[" +
      Object.entries(v)
        .map(([k, val]) => `"${k}" => ${phpArray(val)}`)
        .join(", ") +
      "]"
    );
  }
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

function buildGo(ep: Endpoint, baseUrl: string) {
  const headers = (ep.headers ?? [])
    .map((h) => `\treq.Header.Set("${h.name}", "${h.example ?? ""}")`)
    .join("\n");
  const bodyInit = ep.body
    ? `payload := []byte(\`${JSON.stringify(ep.body.example)}\`)\n\treq, _ := http.NewRequest("${ep.method}", url, bytes.NewBuffer(payload))`
    : `req, _ := http.NewRequest("${ep.method}", url, nil)`;
  return `package main

import (
\t"bytes"
\t"fmt"
\t"io"
\t"net/http"
)

func main() {
\turl := "${baseUrl}${ep.path}"
\t${bodyInit}
${headers}${ep.body ? `\n\treq.Header.Set("Content-Type", "${ep.body.contentType}")` : ""}
\tresp, _ := http.DefaultClient.Do(req)
\tdefer resp.Body.Close()
\tbody, _ := io.ReadAll(resp.Body)
\tfmt.Println(string(body))
}`;
}

function buildJava(ep: Endpoint, baseUrl: string) {
  const headers = (ep.headers ?? [])
    .map((h) => `    .header("${h.name}", "${h.example ?? ""}")`)
    .join("\n");
  const bodyLine = ep.body
    ? `.method("${ep.method}", HttpRequest.BodyPublishers.ofString(${JSON.stringify(
        JSON.stringify(ep.body.example)
      )}))`
    : `.method("${ep.method}", HttpRequest.BodyPublishers.noBody())`;
  return `import java.net.URI;
import java.net.http.*;

HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${baseUrl}${ep.path}"))
${headers}${ep.body ? `\n    .header("Content-Type", "${ep.body.contentType}")` : ""}
    ${bodyLine}
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`;
}

function buildPython(ep: Endpoint, baseUrl: string) {
  const headers: Record<string, string> = {};
  (ep.headers ?? []).forEach((h) => (headers[h.name] = h.example ?? ""));
  if (ep.body) headers["Content-Type"] = ep.body.contentType;
  return `import requests

url = "${baseUrl}${ep.path}"
headers = ${JSON.stringify(headers, null, 4)}
${ep.body ? `payload = ${JSON.stringify(ep.body.example, null, 4)}\n` : ""}response = requests.request("${ep.method}", url, headers=headers${ep.body ? ", json=payload" : ""})
print(response.json())`;
}

const builders: Record<Lang, (ep: Endpoint, baseUrl: string) => string> = {
  "cURL": buildCurl,
  "Node.js": buildNode,
  PHP: buildPhp,
  Go: buildGo,
  Java: buildJava,
  Python: buildPython,
};

const langKey: Record<Lang, string> = {
  "cURL": "bash",
  "Node.js": "javascript",
  PHP: "php",
  Go: "go",
  Java: "java",
  Python: "python",
};

export function CodeTabs({
  endpoint,
  baseUrl,
  body,
}: {
  endpoint: Endpoint;
  baseUrl: string;
  body?: RequestBodySpec;
}) {
  const [lang, setLang] = useState<Lang>("cURL");
  const endpointForCode = body ? { ...endpoint, body } : endpoint;
  const code = builders[lang](endpointForCode, baseUrl);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 transition-colors ${
              lang === l
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <CodeBlock code={code} language={langKey[lang]} />
    </div>
  );
}
