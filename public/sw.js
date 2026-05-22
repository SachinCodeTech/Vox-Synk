const CACHE_NAME = 'voxsync-v1-cache';
const ASSETS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.json'
];

// Installation phase: pre-cache critical app shell components
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[VoxSync Worker] Pre-caching Core PWA App Shell assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activation phase: clean up outdated legacy caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[VoxSync Worker] Deleting obsolete cache store:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: router intercepts
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass intercepting any API REST routes or live websocket connection upgrades
  if (url.pathname.startsWith('/api') || url.pathname.includes('/ws')) {
    event.respondWith(
      fetch(req).catch(() => {
        // Return a clean fallback JSON when offline
        if (req.method === 'GET' && url.pathname === '/api/state') {
          return new Response(JSON.stringify({
            devices: [],
            syncJobs: [],
            logs: [{
              id: 'offline-fatal-sw',
              timestamp: new Date().toLocaleTimeString().split(' ')[0],
              level: 'WARNING',
              deviceId: 'LOCAL-SW-PROXY',
              message: '⚠️ Connection lost. Standalone PWA running in LOCAL STANDBY state.'
            }],
            alerts: [],
            isOffline: true
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ error: 'System offline. Awaiting re-establishment.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Application client assets caching strategy: Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background refresh
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {/* ignore network errors while fetching background update */});
        
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });
        
        return networkResponse;
      }).catch(() => {
        // If entirely disconnected and request is direct navigation, serve index.html shell
        if (req.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
