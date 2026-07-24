#!/usr/bin/env node
// Tiny zero-dependency static server for A2I Web — for previewing the app in a
// local browser exactly as it behaves in production.
//
// It sets the same Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy
// headers that `vercel.json` sets in production. Those headers make the page
// "cross-origin isolated", which enables SharedArrayBuffer and therefore
// multi-threaded (much faster) CPU inference in the in-browser engine. A plain
// static server without them still works, but CPU mode falls back to a single
// thread.
//
//   node serve.mjs            # http://localhost:8123
//   PORT=3000 node serve.mjs  # custom port
//
// Note: opening index.html directly as a file:// URL does NOT work — browsers
// block ES-module imports from file://. Always serve over http as above.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 8123;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  // Match production: enables SharedArrayBuffer → multi-threaded CPU engine.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/') pathname = '/index.html';

  // Resolve inside ROOT only — reject any path traversal attempts.
  const filePath = join(ROOT, normalize(pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) throw Object.assign(new Error('is dir'), { code: 'EISDIR' });
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`A2I Web running at http://localhost:${PORT}`);
  console.log('Cross-origin isolation is ON (multi-threaded CPU engine enabled).');
  console.log('Press Ctrl+C to stop.');
});
