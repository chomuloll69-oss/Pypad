// Caches Pyodide files from jsdelivr (cache-first) so later loads skip the download
const C = 'pyodide-cache-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.hostname !== 'cdn.jsdelivr.net' || !u.pathname.startsWith('/pyodide/')) return;
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(e.request);
    if (hit) return hit;
    const r = await fetch(e.request);
    if (r.ok) c.put(e.request, r.clone());
    return r;
  }));
});
