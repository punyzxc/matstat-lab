import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.json': 'application/json' };
createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (path === '/' ? '/harness.html' : path));
    if (relative(root, file).startsWith('..')) { response.writeHead(403).end(); return; }
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': `${types[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'" });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 400).end('Not found'); }
}).listen(Number(process.env.PORT || 4182), '127.0.0.1', () => console.log('Simulation Worker fixture: http://127.0.0.1:' + (process.env.PORT || 4182)));
