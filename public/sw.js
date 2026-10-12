/*
 * Service worker: makes the app installable and keeps it usable on a flaky
 * yard connection — without ever storing business data.
 *
 * What is cached:
 *   - the offline page and the app icons (precached on install)
 *   - hashed build assets under /_next/static/ (immutable, so cache-first is safe)
 * What is never cached:
 *   - pages, Server Action responses, API responses. They are per-user and
 *     private; a cached copy would outlive sign-out on a shared phone.
 *
 * Bump VERSION to drop old caches on the next visit.
 */
const VERSION = 'v2';
const STATIC_CACHE = `flyash-static-${VERSION}`;
const PRECACHE = ['/offline', '/icon.svg', '/icon-192.png', '/icon-512.png'];
/** Every deploy adds new hashed assets; past this many entries the oldest go. */
const MAX_STATIC_ENTRIES = 300;

/**
 * The page that installs the worker loaded its styles before the worker
 * existed, so they are not cached yet. Fetch whatever the offline page needs
 * now, or it would appear unstyled the first time the connection drops.
 */
async function precacheOfflineAssets(cache) {
  const response = await cache.match('/offline');
  if (!response) return;
  const html = await response.text();
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? []);
  await Promise.all([...assets].map((asset) => cache.add(asset).catch(() => undefined)));
}

async function trim(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_STATIC_ENTRIES;
  if (excess <= 0) return;
  const precached = new Set(PRECACHE.map((path) => new URL(path, self.location.origin).href));
  const removable = keys.filter((key) => !precached.has(key.url)).slice(0, excess);
  await Promise.all(removable.map((key) => cache.delete(key)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(async (cache) => {
        await cache.addAll(PRECACHE);
        await precacheOfflineAssets(cache);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          void trim(cache);
        }
        return response;
      }),
    );
    return;
  }

  // Page loads go to the network; only when it is unreachable is the offline
  // page shown in their place.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match('/offline')) ?? Response.error();
      }),
    );
  }
});
