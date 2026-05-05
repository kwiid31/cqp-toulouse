/* CQP Toulouse — Service Worker v4 */
const CACHE = 'cqp-v4';
const SHELL = [
  '/','/index.html','/profil.html','/admin.html',
  '/actus.html','/evenements.html','/annonces.html','/groupes.html','/a-propos.html',
  '/css/main.css',
  '/js/config.js','/js/auth.js','/js/api.js','/js/utils.js',
  '/js/ui.js','/js/feed.js','/js/stories.js',
  '/js/cqp-core.js',
  '/manifest.json','/favicon.ico',
  '/icons/icon-192.png','/icons/icon-512.png',
];

self.addEventListener('install',  e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin.includes('supabase')) return; // Jamais cacher les appels API
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
