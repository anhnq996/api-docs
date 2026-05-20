import { createServer } from "node:http";
import next from "next";
import { handleRunnerProxy } from "./runner-proxy.mjs";

function argValue(...names) {
  for (const name of names) {
    const index = process.argv.indexOf(name);
    if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  }
  return undefined;
}

const port = Number(argValue("--port", "-p") || process.env.PORT || 3000);
const hostname = argValue("--hostname", "-H") || process.env.HOSTNAME || "0.0.0.0";
const app = next({ dev: true, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

createServer(async (req, res) => {
  const pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
    .pathname;

  if (pathname === "/api/runner-proxy") {
    await handleRunnerProxy(req, res);
    return;
  }

  handle(req, res);
}).listen(port, hostname, () => {
  console.log(`API Docs dev server listening on http://${hostname}:${port}`);
});
