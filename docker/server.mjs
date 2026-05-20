import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRunnerProxy } from "./runner-proxy.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "out");
const port = Number(process.env.PORT || 3000);
const username = process.env.AUTH_USERNAME;
const password = process.env.AUTH_PASSWORD;
const sessionSecret = process.env.AUTH_SESSION_SECRET || password;
const sessionCookie = "api_docs_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

if (!username || !password) {
  throw new Error("AUTH_USERNAME and AUTH_PASSWORD are required");
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value) {
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function createSessionToken(user) {
  const payload = base64Url(
    JSON.stringify({
      username: user,
      exp: Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds,
      nonce: randomBytes(16).toString("hex"),
    })
  );
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !timingSafeEqualText(signature, sign(payload))) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.username === username && Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || "";
  header.split(";").forEach((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return;
    const key = part.slice(0, separator).trim();
    cookies[key] = decodeURIComponent(part.slice(separator + 1));
  });
  return cookies;
}

function hasSession(req) {
  return verifySessionToken(parseCookies(req)[sessionCookie]);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 32) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(data));
}

async function handleLogin(req, res) {
  if (req.method !== "POST") {
    writeJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const user = typeof body.username === "string" ? body.username : "";
    const pass = typeof body.password === "string" ? body.password : "";

    if (!timingSafeEqualText(user, username) || !timingSafeEqualText(pass, password)) {
      writeJson(res, 401, { error: "invalid_credentials" });
      return;
    }

    const token = createSessionToken(user);
    writeJson(
      res,
      200,
      {
        token,
        user: {
          username: user,
          name: user,
        },
      },
      {
        "Set-Cookie": `${sessionCookie}=${encodeURIComponent(
          token
        )}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionMaxAgeSeconds}`,
      }
    );
  } catch {
    writeJson(res, 400, { error: "invalid_request" });
  }
}

function handleLogout(_req, res) {
  writeJson(
    res,
    200,
    { ok: true },
    {
      "Set-Cookie": `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    }
  );
}

function resolvePath(url = "/") {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const cleanPath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const candidates = [];

  if (cleanPath === "/" || cleanPath === ".") {
    candidates.push(join(root, "index.html"));
  } else {
    const directPath = join(root, cleanPath.replace(/^[/\\]+/, ""));
    candidates.push(directPath);
    candidates.push(`${directPath}.html`);
    candidates.push(join(directPath, "index.html"));
  }

  candidates.push(join(root, "index.html"));
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function isPublicStaticAsset(pathname) {
  return pathname.startsWith("/_next/") || Boolean(extname(pathname));
}

createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;

  if (pathname === "/api/auth/login") {
    await handleLogin(req, res);
    return;
  }

  if (pathname === "/api/auth/logout") {
    handleLogout(req, res);
    return;
  }

  if (pathname === "/api/runner-proxy") {
    if (!hasSession(req)) {
      writeJson(res, 401, { error: "unauthorized" });
      return;
    }

    await handleRunnerProxy(req, res);
    return;
  }

  if (pathname !== "/login" && !isPublicStaticAsset(pathname) && !hasSession(req)) {
    res.writeHead(302, { Location: "/login" });
    res.end();
    return;
  }

  const filePath = resolvePath(req.url);
  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);
  const headers = {
    "Content-Type": contentTypes[ext] || "application/octet-stream",
  };

  if (
    [
      ".css",
      ".js",
      ".mjs",
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".webp",
      ".woff",
      ".woff2",
      ".ttf",
    ].includes(ext)
  ) {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  }

  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
}).listen(port, () => {
  console.log(`Static API Docs server listening on :${port}`);
});
