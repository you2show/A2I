// A2I service worker — installable + offline, without ever serving stale code.
//
// The app's code lives inline in the HTML, so the HTML must always be fresh:
// we use NETWORK-FIRST for page navigations/HTML (falling back to cache only
// when offline). Big immutable assets (vendored wasm, icons) use cache-first
// for speed. Cross-origin (Gemini, OpenRouter, model CDNs, HuggingFace, Spline)
// always goes straight to the network.
const CACHE = 'a2i-shell-v3';
const OFFLINE_ASSETS = [
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-512.png', './icons/apple-touch-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(OFFLINE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isHTML = (req) =>
  req.mode === 'navigate' ||
  (req.headers.get('accept') || '').includes('text/html') ||
  /\.html($|\?)/.test(req.url);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // cross-origin: network only
  if (url.pathname.endsWith('/sw.js')) return;        // never intercept the SW itself

  if (isHTML(req)) {
    // Network-first: always get the freshest HTML/code; cache for offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Other same-origin assets: cache-first (fast), refresh in the background.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
