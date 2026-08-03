import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      // Same-origin Zen proxy (see the note in api/zen.js): opencode.ai answers
      // CORS preflight with 404, so the browser cannot call it directly. This
      // rewrite runs the request on our own origin, so no CORS applies.
      { source: '/api/zen/:path*', destination: 'https://opencode.ai/zen/v1/:path*' },
    ];
  },
  async headers() {
    return [
      {
        // COOP/COEP credentialless: required for SharedArrayBuffer so the
        // in-browser wllama/WebLLM engines can use threads (same as the
        // static site previously did via vercel.json headers).
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ];
  },
};

export default nextConfig;
