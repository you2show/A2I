# A2I Web

The all-in-one A2I chat app — a single static page that runs AI **in your
browser** (no server, no external API), and can also talk to your A2I Core,
Ollama, LM Studio, any OpenAI-compatible endpoint, or A2I Cloud.

It is a plain static site: `index.html`, the vendored engines in `vendor/`,
and a small knowledge base in `knowledge/`. No build step is required.

## Open it in a local browser

You **cannot** just double-click `index.html` — browsers block ES-module
imports from `file://` URLs, so the page must be served over HTTP.

### Recommended: the bundled server (matches production)

```bash
cd a2i-web
node serve.mjs           # then open http://localhost:8123
# PORT=3000 node serve.mjs to use a different port
```

`serve.mjs` has no dependencies and sets the same
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers that
production uses (see `../vercel.json`). Those make the page *cross-origin
isolated*, which enables `SharedArrayBuffer` and therefore **multi-threaded
(faster) CPU inference**.

### Alternative: any static server

Any static file server works too — the app degrades gracefully:

```bash
python3 -m http.server 8123     # then open http://localhost:8123
# or:  npx serve .
```

Without the COOP/COEP headers the page is not cross-origin isolated, so the
in-browser CPU engine falls back to a **single thread** (still works, just
slower). WebGPU mode is unaffected.

## Choosing an engine

The dropdown at the top selects which "brain" answers:

- **🧠 In-browser AI** — downloads a small model once and runs it entirely in
  your browser. Uses WebGPU when available and automatically falls back to a
  WebAssembly CPU engine otherwise. No server, no API key.
- **🖥️ A2I Core / Ollama / LM Studio / any URL** — any OpenAI-compatible
  endpoint you add. Defaults to `http://127.0.0.1:8990` (A2I Core).
- **☁️ A2I Cloud** — appears only when the `/api/chat` serverless proxy is
  configured on the deployment; not available on a plain static local server.
- **🧩 All brains together** — asks every available brain and combines the
  answers into one.

## Troubleshooting on a device

If the app won't load a model on some device, open
[`check.html`](check.html) (`http://localhost:8123/check.html`). It runs a
device self-check — secure context, WebGPU, model download reachability,
storage quota, and CPU-engine start — and reports exactly what is blocking.

## Deployment

The repo root `vercel.json` deploys this folder as the output directory and
applies the COOP/COEP headers. The optional `../api/chat.js` edge function
powers **A2I Cloud**; configure `A2I_API_BASE`, `A2I_API_KEY`, and
`A2I_MODEL` in the Vercel project to enable it.
