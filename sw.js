const CACHE = 'cqp-v5'
const SHELL = [
  '/', '/index.html', '/profil.html', '/admin.html',
  '/actus.html', '/evenements.html', '/annonces.html', '/groupes.html',
  '/css/main.css',
  '/js/app.js', '/js/auth.js', '/js/api.js', '/js/utils.js',
  '/js/feed.js', '/js/stories.js',
  '/manifest.json', '/favicon.ico',
]
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})))
  self.skipWaiting()
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))))
  self.clients.claim()
})
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (new URL(e.request.url).hostname.includes('supabase')) return
  const url = e.request.url
  // Network-first pour les JS — toujours la dernière version
  if (url.includes('/js/')) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()))
        return r
      }).catch(() => caches.match(e.request))
    )
    return
  }
  // Cache-first pour le reste
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()))
        return r
      }).catch(() => cached)
      return cached || fresh
    })
  )
})
