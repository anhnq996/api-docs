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

type UnknownRecord = Record<string, unknown>;

type OpenApiServer = {
  url?: unknown;
  description?: unknown;
};

type ResolvedServer = {
  url: string;
  description?: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function hasServerUrl(server: OpenApiServer): server is OpenApiServer & { url: string } {
  return typeof server.url === "string";
}

function resolveRef(root: unknown, ref: string): unknown {
  if (!ref.startsWith("#/")) return {};
  const parts = ref.slice(2).split("/");
  let node: unknown = root;
  for (const part of parts) {
    if (!isRecord(node)) return {};
    node = node[part];
  }
  return node ?? {};
}

function deref(root: unknown, node: unknown, seen = new Set<string>()): unknown {
  if (!isRecord(node)) return node;
  const ref = node.$ref;
  if (typeof ref === "string") {
    if (seen.has(ref)) return {};
    seen.add(ref);
    return deref(root, resolveRef(root, ref), seen);
  }
  return node;
}

function exampleFromSchema(root: unknown, inputSchema: unknown, depth = 0): unknown {
  if (!inputSchema || depth > 6) return null;
  const schema = asRecord(deref(root, inputSchema));
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  const enumValues = asArray(schema.enum);
  if (enumValues.length) return enumValues[0];

  const type = asString(schema.type);
  const properties = asRecord(schema.properties);
  if (type === "object" || Object.keys(properties).length) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(properties)) {
      out[key] = exampleFromSchema(root, properties[key], depth + 1);
    }
    return out;
  }

  if (type === "array") {
    return [exampleFromSchema(root, schema.items, depth + 1)].filter(
      (value) => value !== null
    );
  }
  if (type === "integer" || type === "number") return 0;
  if (type === "boolean") return false;
  if (type === "string") {
    const format = asString(schema.format);
    if (format === "date-time") return new Date().toISOString();
    if (format === "date") return "2026-01-01";
    if (format === "email") return "user@example.com";
    if (format === "uuid") return "00000000-0000-0000-0000-000000000000";
    return "string";
  }
  return null;
}

function schemaTypeString(root: unknown, inputSchema: unknown): string {
  if (!inputSchema) return "any";
  const schema = asRecord(deref(root, inputSchema));
  const type = asString(schema.type);
  if (type === "array") return `${schemaTypeString(root, schema.items)}[]`;
  if (type) return type;
  if (Object.keys(asRecord(schema.properties)).length) return "object";
  return "any";
}

function flattenBodyFields(root: unknown, inputSchema: unknown): BodyField[] {
  if (!inputSchema) return [];
  const schema = asRecord(deref(root, inputSchema));
  const properties = asRecord(schema.properties);
  const required = asArray(schema.required).filter((value): value is string => typeof value === "string");

  return Object.keys(properties).map((name) => {
    const property = asRecord(deref(root, properties[name]));
    return {
      name,
      type: schemaTypeString(root, property),
      required: required.includes(name),
      description: asString(property.description),
      example: property.example ?? exampleFromSchema(root, property),
    };
  });
}

function paramLocation(value: unknown): Param["in"] | null {
  return value === "path" || value === "query" || value === "header" ? value : null;
}

export function convertOpenApi(input: unknown): ApiSpec {
  const doc = asRecord(input);
  const info = asRecord(doc.info);
  const rawServers = asArray(doc.servers);
  const host = asString(doc.host);
  const schemes = asArray(doc.schemes);
  const firstScheme = typeof schemes[0] === "string" ? schemes[0] : "https";
  const basePath = asString(doc.basePath);
  const servers =
    rawServers.length
      ? rawServers
          .map((server) => asRecord(server) as OpenApiServer)
          .filter(hasServerUrl)
          .map((server) => ({
            url: server.url,
            description:
              typeof server.description === "string" ? server.description : undefined,
          }) satisfies ResolvedServer)
      : host
        ? [
            {
              url: `${firstScheme}://${host}${basePath}`,
            },
          ]
        : [];
  const baseUrl = servers[0]?.url ?? "";

  const tagMap = new Map<string, Tag>();
  for (const rawTag of asArray(doc.tags)) {
    const tag = asRecord(rawTag);
    const name = asString(tag.name);
    if (!name) continue;
    tagMap.set(name, {
      name,
      description: asString(tag.description),
      endpoints: [],
    });
  }

  const getTag = (name: string): Tag => {
    if (!tagMap.has(name)) {
      tagMap.set(name, { name, description: "", endpoints: [] });
    }
    return tagMap.get(name)!;
  };

  const paths = asRecord(doc.paths);
  for (const path of Object.keys(paths)) {
    const pathItem = asRecord(paths[path]);
    const pathParams = asArray(pathItem.parameters);
    for (const method of METHODS) {
      const operation = pathItem[method.toLowerCase()];
      if (!isRecord(operation)) continue;

      const operationTags = asArray(operation.tags);
      const tagName = typeof operationTags[0] === "string" ? operationTags[0] : "Default";
      const tag = getTag(tagName);

      const allParams = [...pathParams, ...asArray(operation.parameters)].map((param) =>
        asRecord(deref(doc, param))
      );
      const headers: Param[] = [];
      const params: Param[] = [];

      for (const param of allParams) {
        const name = asString(param.name);
        const location = paramLocation(param.in);
        if (!name || !location) continue;
        const schema = isRecord(param.schema) ? param.schema : { type: param.type };
        const rawExample =
          param.example ?? (param.schema ? exampleFromSchema(doc, param.schema) : undefined);
        const entry: Param = {
          name,
          in: location,
          type: schemaTypeString(doc, schema),
          required: typeof param.required === "boolean" ? param.required : undefined,
          description: asString(param.description),
          example: rawExample === undefined ? undefined : String(rawExample),
        };
        if (location === "header") headers.push(entry);
        else params.push(entry);
      }

      let body: Endpoint["body"];
      let bodies: Endpoint["bodies"];
      const requestBody = asRecord(deref(doc, operation.requestBody));
      const requestContent = asRecord(requestBody.content);
      if (Object.keys(requestContent).length) {
        bodies = Object.keys(requestContent).map((contentType) => {
          const media = asRecord(requestContent[contentType]);
          const schema = deref(doc, media.schema);
          const schemaRecord = asRecord(schema);
          return {
            contentType,
            fields: flattenBodyFields(doc, schema),
            example: media.example ?? exampleFromSchema(doc, schema) ?? {},
            schemaType: schemaTypeString(doc, schema),
            description:
              asString(schemaRecord.description) || asString(requestBody.description),
          };
        });
        body = bodies[0];
      }

      const responses: ResponseSpec[] = [];
      const responseMap = asRecord(operation.responses);
      for (const code of Object.keys(responseMap)) {
        const response = asRecord(deref(doc, responseMap[code]));
        const content = asRecord(response.content);
        const contentType = Object.keys(content)[0];
        const media = contentType ? asRecord(content[contentType]) : {};
        const example = media.example ?? exampleFromSchema(doc, media.schema);
        const status = parseInt(code, 10);
        if (!Number.isFinite(status)) continue;
        responses.push({
          status,
          description: asString(response.description),
          example: example ?? {},
        });
      }

      const operationId = asString(operation.operationId);
      const id =
        operationId || `${method.toLowerCase()}-${path.replace(/[^a-z0-9]+/gi, "-")}`;

      tag.endpoints.push({
        id,
        method,
        path,
        summary: asString(operation.summary, path),
        description: asString(operation.description),
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
      title: asString(info.title, "Untitled API"),
      version: asString(info.version, "1.0.0"),
      description: asString(info.description),
      baseUrl,
      servers,
    },
    tags: Array.from(tagMap.values()).filter((tag) => tag.endpoints.length > 0),
  };
}
