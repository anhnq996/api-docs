import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRunnerProxy } from "./runner-proxy.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "out");
const port = Number(process.env.PORT || 3000);

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

createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;

  if (pathname === "/api/runner-proxy") {
    await handleRunnerProxy(req, res);
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
