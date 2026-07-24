// A2I service worker — makes the app installable and available offline.
// Strategy: precache the app shell; serve same-origin GETs stale-while-
// revalidate (so the app opens instantly and offline, and updates in the
// background). Cross-origin requests (Gemini, model CDNs, HuggingFace, Spline)
// always go straight to the network — never cached or intercepted here.
const CACHE = 'a2i-shell-v1';
const SHELL = [
  './', './index.html', './live.html', './check.html',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-512.png', './icons/apple-touch-180.png',
  './knowledge/index.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin pass through

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          // Cache successful same-origin responses (keeps COEP/CORP headers).
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
