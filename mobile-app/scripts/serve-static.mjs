import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] || "web-preview");
const port = Number(process.argv[3] || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);
    if (url.pathname === "/api/deepseek" && request.method === "POST") {
      const body = await readJsonBody(request);
      const apiKey = String(body.apiKey || "").trim();
      if (!apiKey) {
        response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "missing_api_key" }));
        return;
      }

      const upstream = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          model: body.model || "deepseek-v4-flash",
          messages: body.messages || [],
          temperature: Number.isFinite(body.temperature) ? body.temperature : 0.2,
          max_tokens: body.max_tokens || 1800,
          response_format: body.response_format || { type: "json_object" },
          thinking: body.thinking || { type: "disabled" }
        })
      });
      const text = await upstream.text();
      response.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8" });
      response.end(text);
      return;
    }

    const pathname = decodeURIComponent(url.pathname);
    const resolved = normalize(resolve(join(root, pathname)));
    if (!resolved.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const info = await stat(resolved).catch(() => null);
    const file = info?.isDirectory() ? join(resolved, "index.html") : resolved;
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`Web preview: http://localhost:${port}`);
});

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
