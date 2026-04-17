// CQP Toulouse SW — network first, pas de cache agressif
const V = 'cqp-v5';
self.addEventListener('install', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('googleapis.com')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
