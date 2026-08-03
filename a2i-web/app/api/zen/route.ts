// A2I Zen proxy — Next.js route handler.
//
// The browser cannot call https://opencode.ai/zen/v1 directly: that endpoint
// answers CORS preflight (OPTIONS) with 404, so cross-origin fetch from this
// page fails with "Failed to fetch". This proxy runs on the same origin
// (https://ai.ponloe.app/api/zen), so no CORS applies.
//
// The user's own Zen key travels from the browser in the Authorization header
// and is forwarded to opencode.ai unchanged — it never touches Vercel env
// vars, so each visitor can use their own free key.

export const runtime = 'edge';

const UPSTREAM = 'https://opencode.ai/zen/v1';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(), ...extra },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/zen\/?/, '');
  const target = path ? UPSTREAM + '/' + path : UPSTREAM;
  let res: Response;
  try {
    res = await fetch(target, {
      headers: {
        Accept: 'application/json',
        ...(request.headers.get('authorization')
          ? { Authorization: request.headers.get('authorization')! }
          : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    return json({ error: 'upstream_unreachable', message: String(err).slice(0, 200) }, 502);
  }
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      ...cors(),
    },
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/zen\/?/, '');
  const target = path ? UPSTREAM + '/' + path : UPSTREAM;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const auth = request.headers.get('authorization') || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = auth;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    return json({ error: 'upstream_unreachable', message: String(err).slice(0, 200) }, 502);
  }

  const ct = upstream.headers.get('Content-Type') || '';
  const wantsStream = (body as { stream?: boolean } | null)?.stream;
  if (ct.includes('text/event-stream') || wantsStream) {
    // Stream Zen's SSE straight back to the browser.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        ...cors(),
      },
    });
  }

  // Non-streaming (e.g. the "Test key" button): pass status + body through so
  // the app can tell a bad key (401) from a rate limit (429).
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': ct || 'application/json',
      ...cors(),
    },
  });
}
