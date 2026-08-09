/* Guess the Language — service worker (PWA installability + offline shell).

   Strategy is split by what the request is, because a blanket cache-first policy
   ships stale UI after every deploy:

   - Navigations and the unhashed config files go NETWORK-FIRST, falling back to
     cache only when offline. These are the files whose URL never changes, so a
     cache hit would pin the app to an old release indefinitely.
   - Everything else under this scope is content-hashed by Vite (assets/x-<hash>.js),
     so its URL changes whenever its content does. Those are safe to serve
     cache-first, which is what keeps repeat loads fast.

   Cross-origin requests (Supabase / Discord) are never touched. */
'use strict';

// Distinct from the v1 app's 'gtl-cache-*': this build is also served from /v2/ of
// the v1 deployment, so both workers share one origin's cache storage. Colliding on
// the name would make each one's activate handler delete the other's cache.
const CACHE = 'gtl-v2-cache-v2';
// All relative — absolute paths would pull the v1 app's manifest and icons in.
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

/** URLs whose content changes without the URL changing. */
const ALWAYS_REVALIDATE = /\/(index\.html|supabase-config\.js|discord-config\.js)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        // Only ever delete OUR caches — the v1 app's live alongside these.
        keys.filter((k) => k.startsWith('gtl-v2-cache-') && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle our own origin; let Supabase/Discord/CDN requests pass straight through.
  if (url.origin !== self.location.origin) return;

  const mustRevalidate =
    req.mode === 'navigate' || url.pathname.endsWith('/') || ALWAYS_REVALIDATE.test(url.pathname);

  if (mustRevalidate) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        // Offline: fall back to whatever we last stored.
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        });
      })
    )
  );
});
