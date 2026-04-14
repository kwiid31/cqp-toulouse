const CACHE = 'cqp-toulouse-v1';
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

// Installation : mise en cache des pages principales
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Interception des requêtes : réseau en priorité, cache en fallback
self.addEventListener('fetch', e => {
  // Ignorer les requêtes non-GET et les API externes
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('googleapis.com')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Mettre en cache la réponse fraîche
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
