// CQP Toulouse — Service Worker v2
// Cache le shell de l'app pour fonctionnement hors-ligne
const CACHE = 'cqp-v1777484214';
const SHELL = [
  '/',
  '/index.html',
  '/profil.html',
  '/groupes.html',
  '/actus.html',
  '/js/cqp-core.js',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Supabase, Groq, fonts → réseau toujours
  if (url.hostname.includes('supabase') || url.hostname.includes('groq') ||
      url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) {
    return;
  }
  // Shell de l'app → cache first, réseau en fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Mettre en cache les nouvelles ressources statiques
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Hors-ligne et pas en cache → page offline générique
        if (e.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
