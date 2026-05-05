/* CQP Toulouse v2 — Service Worker */
const CACHE = 'cqp-v2-final';
const SHELL = [
  '/','index.html','profil.html','admin.html',
  'actus.html','evenements.html','annonces.html','groupes.html','a-propos.html',
  '/css/main.css',
  '/js/app.js','/js/auth.js','/js/api.js','/js/utils.js',
  '/js/feed.js','/js/stories.js','/js/ui.js','/js/cqp-core.js',
  '/manifest.json','/favicon.ico',
  '/icons/icon-192.png','/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname.includes('supabase')) return; // Jamais cacher l'API
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(r => {
        if (r.ok && r.status < 400) {
          caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        }
        return r;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
