"use client";

import { useEffect, useState } from "react";
import type {
  ApiSpec,
  BodyField,
  Endpoint,
  Param,
  RequestBodySpec,
} from "@/lib/data/apiSpec";
import { spec as defaultSpec } from "@/lib/data/apiSpec";
import { ChevronDown, Link2 } from "lucide-react";
import { CodeBlock } from "./CodeBlock";
import { CodeTabs } from "./CodeTabs";
import { MethodBadge } from "./MethodBadge";
import { StatusBadge } from "./StatusBadge";

function ParamTable({ items }: { items: Param[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Tên</th>
            <th className="px-4 py-2 font-medium">Kiểu</th>
            <th className="px-4 py-2 font-medium">Bắt buộc</th>
            <th className="px-4 py-2 font-medium">Mô tả</th>
            <th className="px-4 py-2 font-medium">Ví dụ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={p.name + i} className="border-t border-border">
              <td className="px-4 py-2 font-mono text-xs">{p.name}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                {p.type}
              </td>
              <td className="px-4 py-2 text-xs">
                {p.required ? (
                  <span className="text-rose-500">required</span>
                ) : (
                  <span className="text-muted-foreground">optional</span>
                )}
              </td>
              <td className="px-4 py-2 text-xs">{p.description}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                {p.example ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BodyTable({ fields }: { fields: BodyField[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Field</th>
            <th className="px-4 py-2 font-medium">Kiểu</th>
            <th className="px-4 py-2 font-medium">Bắt buộc</th>
            <th className="px-4 py-2 font-medium">Mô tả</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={f.name + i} className="border-t border-border">
              <td className="px-4 py-2 font-mono text-xs">{f.name}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                {f.type}
              </td>
              <td className="px-4 py-2 text-xs">
                {f.required ? (
                  <span className="text-rose-500">required</span>
                ) : (
                  <span className="text-muted-foreground">optional</span>
                )}
              </td>
              <td className="px-4 py-2 text-xs">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function endpointBodies(endpoint: Endpoint): RequestBodySpec[] {
  return endpoint.bodies?.length
    ? endpoint.bodies
    : endpoint.body
      ? [endpoint.body]
      : [];
}

export function EndpointDetail({
  endpoint,
  spec = defaultSpec,
  baseUrl,
  projectName,
}: {
  endpoint: Endpoint;
  spec?: ApiSpec;
  baseUrl?: string;
  projectName?: string;
}) {
  const responses = endpoint.responses;
  const [activeStatus, setActiveStatus] = useState(responses[0].status);
  const bodies = endpointBodies(endpoint);
  const [activeContentType, setActiveContentType] = useState(
    bodies[0]?.contentType ?? ""
  );
  const active = responses.find((r) => r.status === activeStatus) ?? responses[0];
  const activeBody =
    bodies.find((body) => body.contentType === activeContentType) ?? bodies[0];
  const activeBaseUrl = baseUrl ?? spec.info.baseUrl;

  const path = endpoint.params?.filter((p) => p.in === "path") ?? [];
  const query = endpoint.params?.filter((p) => p.in === "query") ?? [];
  const headers = endpoint.headers ?? [];

  useEffect(() => {
    if (!bodies.length) {
      setActiveContentType("");
      return;
    }
    if (!bodies.some((body) => body.contentType === activeContentType)) {
      setActiveContentType(bodies[0].contentType);
    }
  }, [bodies, activeContentType]);

  return (
    <div className="max-w-4xl mx-auto px-8 py-10 space-y-10">
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link2 className="size-3.5" />
          <span>{projectName ?? "API Reference"}</span>
        </div>
        <h1 className="tracking-tight">{endpoint.summary}</h1>
        <p className="text-muted-foreground leading-relaxed">{endpoint.description}</p>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 font-mono text-sm">
          <MethodBadge method={endpoint.method} />
          <span className="text-muted-foreground">{activeBaseUrl}</span>
          <span>{endpoint.path}</span>
        </div>
      </header>

      {headers.length > 0 && (
        <Section title="Headers">
          <ParamTable items={headers} />
        </Section>
      )}
      {path.length > 0 && (
        <Section title="Path Parameters">
          <ParamTable items={path} />
        </Section>
      )}
      {query.length > 0 && (
        <Section title="Query Parameters">
          <ParamTable items={query} />
        </Section>
      )}
      {activeBody && (
        <Section title="Request Body">
          {bodies.length > 1 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="text-xs text-muted-foreground">Media type</div>
              <div className="flex flex-wrap gap-2">
                {bodies.map((body) => (
                  <button
                    key={body.contentType}
                    onClick={() => setActiveContentType(body.contentType)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-mono transition-colors ${
                      activeBody.contentType === body.contentType
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {body.contentType}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Content-Type: <span className="font-mono">{activeBody.contentType}</span>
            </div>
          )}
          {activeBody.description && (
            <p className="text-xs text-muted-foreground">{activeBody.description}</p>
          )}
          {activeBody.fields.length > 0 ? (
            <BodyTable fields={activeBody.fields} />
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              Raw body type: <span className="font-mono">{activeBody.schemaType ?? "any"}</span>
            </div>
          )}
          <CodeBlock
            code={
              typeof activeBody.example === "string"
                ? activeBody.example
                : JSON.stringify(activeBody.example, null, 2)
            }
            language={activeBody.contentType.includes("json") ? "json" : "text"}
          />
        </Section>
      )}

      <Section title="Responses">
        <ResponseDropdown
          responses={responses}
          activeStatus={activeStatus}
          onChange={setActiveStatus}
        />
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={active.status} />
            <span className="text-sm">{active.description}</span>
          </div>
          <CodeBlock
            code={
              active.example === null
                ? "// No content"
                : JSON.stringify(active.example, null, 2)
            }
          />
        </div>
      </Section>

      <Section title="Code examples">
        <CodeTabs endpoint={endpoint} baseUrl={activeBaseUrl} body={activeBody} />
      </Section>
    </div>
  );
}

function ResponseDropdown({
  responses,
  activeStatus,
  onChange,
}: {
  responses: Endpoint["responses"];
  activeStatus: number;
  onChange: (s: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = responses.find((r) => r.status === activeStatus) ?? responses[0];
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors text-sm min-w-[320px]"
      >
        <StatusBadge status={active.status} />
        <span className="flex-1 text-left text-muted-foreground truncate">
          {active.description}
        </span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          {responses.map((r) => (
            <button
              key={r.status}
              onMouseDown={() => {
                onChange(r.status);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left ${
                r.status === activeStatus ? "bg-accent/60" : ""
              }`}
            >
              <StatusBadge status={r.status} />
              <span className="text-muted-foreground truncate">{r.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
