const PYO = 'pyodide-cache-v1';  // pinned version, never changes
const SHELL = 'Pyzer-shell-v3';  // your files + fonts

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
  if (r.ok || r.type === 'opaque') c.put(req, r.clone()); // pyodide.js via importScripts is opaque
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

// your own files: try the network first (so deploys show up immediately),
// fall back to the cache when offline or the connection is slow
async function networkFirst(req, name, ms = 3000) {
  const c = await caches.open(name);
  try {
    const r = await Promise.race([
      fetch(req),
      new Promise((_, no) => setTimeout(no, ms))
    ]);
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch {
    return (await c.match(req)) || fetch(req);
  }
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/pyodide/'))
    return e.respondWith(cacheFirst(e.request, PYO));
  if (u.origin === location.origin)
    return e.respondWith(networkFirst(e.request, SHELL));
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com')
    return e.respondWith(staleWhileRevalidate(e.request, SHELL));
});
