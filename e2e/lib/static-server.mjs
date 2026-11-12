// Serve o `dist` do `expo export` com fallback de SPA, sem dependência.
// Uso: node static-server.mjs <dir> <porta> [arquivo-do-pid]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

const [dirArg, portArg, pidFile] = process.argv.slice(2);
const root = resolve(dirArg);
const port = Number(portArg);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

async function fileFor(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^[\\/]+/, "");
  const target = join(root, clean);
  // nada de sair da raiz com `..`
  if (target !== root && !target.startsWith(root + sep)) return null;
  for (const candidate of [target, `${target}.html`, join(target, "index.html")]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  let file = await fileFor(path);
  // Fallback de SPA: rota sem extensão que não é arquivo devolve o index.
  // Recurso com extensão que não existe é 404 de verdade, para o roteiro ver.
  if (!file && !extname(path)) file = join(root, "index.html");
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("não encontrado");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end();
  }
}).listen(port, "127.0.0.1", () => {
  if (pidFile) writeFileSync(pidFile, String(process.pid));
  console.log(`estático em http://127.0.0.1:${port} (pid ${process.pid})`);
});
