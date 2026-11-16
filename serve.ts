// serve.ts — tiny dev server for SKYBLADE ARENA (local play only, not part
// of the graded entry). Serves game/ over plain HTTP so you can open the
// game in a desktop browser. Plain JavaScript (no TypeScript annotations).
// Usage: node serve.ts [port]   (default port 8080)
const { createReadStream, statSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, normalize, resolve, sep } = require('node:path');
const { fileURLToPath } = require('node:url');

const root = resolve(join(fileURLToPath(new URL('.', import.meta.url)), 'game'));
const port = Number(process.argv[2] || 8080);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};
createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end('bad request'); return; }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); res.end('forbidden'); return; }
  let size;
  try { const s = statSync(file); if (!s.isFile()) throw new Error('not a file'); size = s.size; } catch { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'content-length': size, 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`SKYBLADE ARENA at http://localhost:${port}/  (desktop browser, keyboard + mouse)`);
});
