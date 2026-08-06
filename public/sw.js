/* Guess the Language — service worker (PWA installability + offline shell).
   Strategy: cache-first with background refresh (stale-while-revalidate) for
   same-origin GET requests; never touch cross-origin (Supabase / Discord). */
'use strict';

const CACHE = 'gtl-cache-v11';
const CORE = ['./', './index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle our own origin; let Supabase/Discord/CDN requests pass straight through.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => cached || caches.match('./index.html'));
        // Serve cache immediately when present, refresh in the background.
        return cached || network;
      })
    )
  );
});
