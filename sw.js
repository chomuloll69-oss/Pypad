const PYO = 'pyodide-cache-v1';  // pinned version, never changes
const SHELL = 'pypad-shell-v1';  // your files + fonts

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL).then(c =>
    c.addAll(['./', 'index.html', 'index.css', 'index.js', 'pyodide-worker.js'])
  ).catch(() => {}));
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== PYO && k !== SHELL).map(k => caches.delete(k))))
    .then(() => clients.claim())
));

async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok) c.put(req, r.clone());
  return r;
}

async function staleWhileRevalidate(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const net = fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') c.put(req, r.clone()); // fonts CSS can be opaque
    return r;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/pyodide/'))
    return e.respondWith(cacheFirst(e.request, PYO));
  if (u.origin === location.origin || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com')
    return e.respondWith(staleWhileRevalidate(e.request, SHELL));
});
