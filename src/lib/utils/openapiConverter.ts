import type {
  ApiSpec,
  BodyField,
  Endpoint,
  HttpMethod,
  Param,
  ResponseSpec,
  Tag,
} from "../data/apiSpec";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

type OpenApiServer = {
  url?: unknown;
  description?: unknown;
};

type ResolvedServer = {
  url: string;
  description?: string;
};

function hasServerUrl(server: OpenApiServer): server is OpenApiServer & { url: string } {
  return typeof server.url === "string";
}

function resolveRef(root: any, ref: string): any {
  if (!ref.startsWith("#/")) return {};
  const parts = ref.slice(2).split("/");
  let node = root;
  for (const p of parts) {
    if (node == null) return {};
    node = node[p];
  }
  return node ?? {};
}

function deref(root: any, node: any, seen = new Set<string>()): any {
  if (!node || typeof node !== "object") return node;
  if (node.$ref && typeof node.$ref === "string") {
    if (seen.has(node.$ref)) return {};
    seen.add(node.$ref);
    return deref(root, resolveRef(root, node.$ref), seen);
  }
  return node;
}

function exampleFromSchema(root: any, schema: any, depth = 0): any {
  if (!schema || depth > 6) return null;
  schema = deref(root, schema);
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && schema.enum.length) return schema.enum[0];
  const t = schema.type;
  if (t === "object" || schema.properties) {
    const out: any = {};
    const props = schema.properties || {};
    for (const k of Object.keys(props)) {
      out[k] = exampleFromSchema(root, props[k], depth + 1);
    }
    return out;
  }
  if (t === "array")
    return [exampleFromSchema(root, schema.items, depth + 1)].filter(
      (v) => v !== null
    );
  if (t === "integer" || t === "number") return 0;
  if (t === "boolean") return false;
  if (t === "string") {
    if (schema.format === "date-time") return new Date().toISOString();
    if (schema.format === "date") return "2026-01-01";
    if (schema.format === "email") return "user@example.com";
    if (schema.format === "uuid") return "00000000-0000-0000-0000-000000000000";
    return "string";
  }
  return null;
}

function schemaTypeString(root: any, schema: any): string {
  if (!schema) return "any";
  schema = deref(root, schema);
  if (schema.type === "array") return `${schemaTypeString(root, schema.items)}[]`;
  if (schema.type) return schema.type;
  if (schema.properties) return "object";
  return "any";
}

function flattenBodyFields(root: any, schema: any): BodyField[] {
  if (!schema) return [];
  schema = deref(root, schema);
  const props = schema.properties || {};
  const required: string[] = schema.required || [];
  return Object.keys(props).map((name) => {
    const p = deref(root, props[name]);
    return {
      name,
      type: schemaTypeString(root, p),
      required: required.includes(name),
      description: p.description || "",
      example: p.example ?? exampleFromSchema(root, p),
    };
  });
}

export function convertOpenApi(doc: any): ApiSpec {
  const info = doc.info || {};
  const servers =
    Array.isArray(doc.servers) && doc.servers.length
      ? (doc.servers as OpenApiServer[])
          .filter(hasServerUrl)
          .map((server) => ({
            url: server.url,
            description:
              typeof server.description === "string" ? server.description : undefined,
          }) satisfies ResolvedServer)
      : doc.host
        ? [
            {
              url: `${doc.schemes?.[0] || "https"}://${doc.host}${doc.basePath || ""}`,
            },
          ]
        : [];
  const baseUrl = servers[0]?.url ?? "";

  const tagMap = new Map<string, Tag>();
  for (const t of doc.tags || []) {
    tagMap.set(t.name, {
      name: t.name,
      description: t.description || "",
      endpoints: [],
    });
  }
  const getTag = (name: string): Tag => {
    if (!tagMap.has(name)) {
      tagMap.set(name, { name, description: "", endpoints: [] });
    }
    return tagMap.get(name)!;
  };

  const paths = doc.paths || {};
  for (const path of Object.keys(paths)) {
    const pathItem = paths[path] || {};
    const pathParams = pathItem.parameters || [];
    for (const m of METHODS) {
      const op = pathItem[m.toLowerCase()];
      if (!op) continue;

      const tagName = (op.tags && op.tags[0]) || "Default";
      const tag = getTag(tagName);

      const allParams: any[] = [...pathParams, ...(op.parameters || [])].map((p) =>
        deref(doc, p)
      );
      const headers: Param[] = [];
      const params: Param[] = [];
      for (const p of allParams) {
        const entry: Param = {
          name: p.name,
          in: p.in,
          type: schemaTypeString(doc, p.schema || { type: p.type }),
          required: p.required,
          description: p.description || "",
          example: p.example ?? (p.schema ? exampleFromSchema(doc, p.schema) : undefined),
        };
        if (p.in === "header") headers.push(entry);
        else if (p.in === "path" || p.in === "query") params.push(entry);
      }

      let body: Endpoint["body"];
      let bodies: Endpoint["bodies"];
      const rb = deref(doc, op.requestBody);
      if (rb && rb.content) {
        bodies = Object.keys(rb.content).map((ct) => {
          const media = rb.content[ct] || {};
          const schema = deref(doc, media.schema);
          return {
            contentType: ct,
            fields: flattenBodyFields(doc, schema),
            example: media.example ?? exampleFromSchema(doc, schema) ?? {},
            schemaType: schemaTypeString(doc, schema),
            description: schema.description || rb.description || "",
          };
        });
        body = bodies[0];
      }

      const responses: ResponseSpec[] = [];
      const respMap = op.responses || {};
      for (const code of Object.keys(respMap)) {
        const r = deref(doc, respMap[code]);
        const ct = r.content ? Object.keys(r.content)[0] : null;
        const media = ct ? r.content[ct] : null;
        const ex = media ? media.example ?? exampleFromSchema(doc, media.schema) : null;
        const status = parseInt(code, 10);
        if (!Number.isFinite(status)) continue;
        responses.push({
          status,
          description: r.description || "",
          example: ex ?? {},
        });
      }

      const id =
        op.operationId || `${m.toLowerCase()}-${path.replace(/[^a-z0-9]+/gi, "-")}`;

      tag.endpoints.push({
        id,
        method: m,
        path,
        summary: op.summary || path,
        description: op.description || "",
        headers: headers.length ? headers : undefined,
        params: params.length ? params : undefined,
        body,
        bodies: bodies && bodies.length > 1 ? bodies : undefined,
        responses: responses.length
          ? responses
          : [{ status: 200, description: "OK", example: {} }],
      });
    }
  }

  return {
    info: {
      title: info.title || "Untitled API",
      version: info.version || "1.0.0",
      description: info.description || "",
      baseUrl,
      servers,
    },
    tags: Array.from(tagMap.values()).filter((t) => t.endpoints.length > 0),
  };
}
