/* Offline support for the course.
   The page itself: network first (fresh when online), cache when offline.
   Icons and Google Fonts: cache first.
   Bump VERSION when you change the list of core files. */
const VERSION = 'v1';
const CACHE = 'fe-course-' + VERSION;
const CORE = [
  './',
  './course.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('fe-course-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  let timer;
  try {
    // a slow connection should not keep the user waiting: fall back to cache after 4s
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), 4000); });
    const res = await Promise.race([fetch(req), timeout]);
    clearTimeout(timer);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    clearTimeout(timer);
    return (await cache.match(req, { ignoreSearch: true }))
        || (req.mode === 'navigate' ? await cache.match('./course.html') : undefined)
        || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(cacheFirst(req));
  }
});
