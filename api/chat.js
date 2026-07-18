// A2I Cloud — Vercel Edge function that proxies chat to a hosted,
// OpenAI-compatible inference endpoint. The API key lives ONLY in a Vercel
// environment variable, never in the browser, so the model runs on the
// provider's GPUs (fast, high quality) with no download on the user's device.
//
// Configure these Environment Variables in the Vercel project settings:
//   A2I_API_BASE  — OpenAI-compatible base URL, e.g. https://api.provider.com/v1
//   A2I_API_KEY   — the secret API key for that provider
//   A2I_MODEL     — the model id to use, e.g. an open model like a Llama/Qwen id
//
// Works with any OpenAI-compatible endpoint: a hosted open-model provider,
// or your own A2I Core / Ollama / LM Studio reachable over the internet.

export const config = { runtime: 'edge' };

export default async function handler(request) {
  const base = process.env.A2I_API_BASE;
  const key = process.env.A2I_API_KEY;
  const model = process.env.A2I_MODEL || 'default';

  // Health/config probe used by the web app to decide whether to offer Cloud.
  if (request.method === 'GET') {
    return json({ configured: Boolean(base && key), model: base && key ? model : null });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }
  if (!base || !key) {
    return json({
      error: 'not_configured',
      message:
        'A2I Cloud is not set up yet. In Vercel → Project → Settings → ' +
        'Environment Variables, add A2I_API_BASE, A2I_API_KEY and A2I_MODEL, ' +
        'then redeploy.',
    }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(base.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
      },
      body: JSON.stringify({
        model,
        messages: body.messages || [],
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 1024,
        stream: true,
      }),
    });
  } catch (err) {
    return json({ error: 'upstream_unreachable', message: String(err).slice(0, 200) }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return json({ error: 'upstream_error', status: upstream.status, message: text.slice(0, 300) },
      upstream.status || 502);
  }

  // Stream the provider's SSE response straight back to the browser.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
