// A2I Cloud — Next.js route handler that proxies chat to a hosted,
// OpenAI-compatible inference endpoint. The API key lives ONLY in a Vercel
// environment variable, never in the browser (ported 1:1 from api/chat.js).
//
// Configure these Environment Variables in the Vercel project settings:
//   A2I_API_BASE  - OpenAI-compatible base URL, e.g. https://api.provider.com/v1
//   A2I_API_KEY   - the secret API key for that provider
//   A2I_MODEL     - the model id to use, e.g. an open model like a Llama/Qwen id

export const runtime = 'nodejs';
export const maxDuration = 60;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET() {
  const base = process.env.A2I_API_BASE;
  const key = process.env.A2I_API_KEY;
  const model = process.env.A2I_MODEL || 'default';
  return json({
    configured: Boolean(base && key),
    model: base && key ? model : null,
    base: base && key ? base : null,
  });
}

export async function POST(request: Request) {
  const base = process.env.A2I_API_BASE;
  const key = process.env.A2I_API_KEY;

  if (!base || !key) {
    return json(
      {
        error: 'not_configured',
        message:
          'A2I Cloud is not set up yet. In Vercel › Project › Settings › ' +
          'Environment Variables, add A2I_API_BASE, A2I_API_KEY and A2I_MODEL, ' +
          'then redeploy.',
      },
      503,
    );
  }

  let body: { messages?: unknown[]; temperature?: number; max_tokens?: number; model?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  // The browser may pick a specific model (e.g. one of the Zen model list);
  // fall back to the A2I_MODEL env var when none is sent.
  const clientModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : '';
  const model = clientModel || process.env.A2I_MODEL || 'default';

  let upstream: Response;
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
        // Matches MAX_TOKENS_HOSTED in the client; the old 1024 default cut
        // ordinary answers off mid-sentence for any caller that omitted it.
        max_tokens: body.max_tokens ?? 4096,
        stream: true,
      }),
    });
  } catch (err) {
    return json({ error: 'upstream_unreachable', message: String(err).slice(0, 200) }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return json(
      { error: 'upstream_error', status: upstream.status, message: text.slice(0, 300) },
      upstream.status || 502,
    );
  }

  // Stream the provider's SSE straight back to the browser.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
