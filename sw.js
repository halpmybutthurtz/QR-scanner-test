const CACHE_NAME = 'qr-scanner-v1';
const RUNTIME_CACHE = 'qr-scanner-runtime';

// Files to cache on install
const urlsToCache = [
  '/',
  '/index.html',
  '/qr-scanner.js',
  '/qr-scanner.css',
  // Html5-qrcode library from CDN
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js',
  // Images/icons from your app
  '/src/header.png',
  '/src/fm-main-fullscreen-hi.png',
  '/src/fm-next.png',
  '/src/fm-clear.png',
  '/src/fm-save.png',
  '/src/fm-add.png',
  '/src/fm-right.png',
  '/src/fm-trash.png',
  // PWA icons (add these when you create them)
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-180.png',  // iOS
  // Add manifest
  '/manifest.json'
];

// Install event - cache all static assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[Service Worker] Cache failed:', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle camera/media requests differently (don't cache)
  if (request.url.includes('getUserMedia') || 
      request.url.includes('mediaDevices') ||
      request.destination === 'video') {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('[Service Worker] Found in cache:', request.url);
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then(response => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache dynamic resources in runtime cache
            if (request.method === 'GET') {
              caches.open(RUNTIME_CACHE).then(cache => {
                cache.put(request, responseToCache);
              });
            }

            return response;
          })
          .catch(err => {
            console.error('[Service Worker] Fetch failed:', err);
            
            // Return offline page or error response if available
            return caches.match('/offline.html').then(offlineResponse => {
              return offlineResponse || new Response('Offline - please check your connection', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
          });
      })
  );
});

// Handle messages from the client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

// Background sync (optional - for saving scans offline)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-scans') {
    event.waitUntil(syncScans());
  }
});

async function syncScans() {
  // Implement logic to sync offline scans when connection is restored
  console.log('[Service Worker] Syncing scans...');
  // This would read from IndexedDB and upload to server if you have one
}
