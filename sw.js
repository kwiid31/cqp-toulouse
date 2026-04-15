const CACHE = 'cqp-toulouse-v3';
const OFFLINE_URLS = [
  '/cqp-toulouse/',
  '/cqp-toulouse/index.html',
  '/cqp-toulouse/actus.html',
  '/cqp-toulouse/evenements.html',
  '/cqp-toulouse/annonces.html',
  '/cqp-toulouse/presse.html',
  '/cqp-toulouse/newsletter.html',
  '/cqp-toulouse/manifest.json',
];

// Installation : vider TOUS les caches existants d'abord
self.addEventListener('install', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => caches.open(CACHE).then(cache => cache.addAll(OFFLINE_URLS)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first : toujours essayer le réseau en priorité
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('googleapis.com')) return;
  if (e.request.url.includes('fonts.g')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
