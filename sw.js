// Service Worker désactivé — se supprime lui-même
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => {
        console.log('Suppression cache:', k);
        return caches.delete(k);
      })))
      .then(() => self.clients.claim())
      .then(() => {
        // Recharger tous les onglets ouverts
        return self.clients.matchAll({type: 'window'});
      })
      .then(clients => {
        clients.forEach(client => client.navigate(client.url));
      })
  );
});
// Pas d'interception — tout passe par le réseau
