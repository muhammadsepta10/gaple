/* Built by build-sw.mjs. Paths stay relative to registration scope. */
const CACHE_NAME = 'gaple-__VERSION__';
const PRECACHE = __PRECACHE__;
const OPTIONAL = __OPTIONAL__;
const SCOPE = self.registration.scope;
const scopedUrl = (path) => new URL(path, SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(PRECACHE.map(scopedUrl));
    await self.skipWaiting();
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('gaple-') && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;

  const path = url.href.slice(SCOPE.length);
  if (request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE_NAME).then((cache) => cache.match(scopedUrl('./'))));
    return;
  }
  if (PRECACHE.includes(path)) {
    event.respondWith(caches.open(CACHE_NAME).then((cache) => cache.match(scopedUrl(path), { ignoreVary: true }).then((response) => response || fetch(request))));
    return;
  }
  if (OPTIONAL.includes(path)) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(scopedUrl(path), { ignoreVary: true });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_TABLE') return;
  const path = `meja/${event.data.id}.svg`;
  if (!OPTIONAL.includes(path)) return;
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    const url = scopedUrl(path);
    if (!await cache.match(url, { ignoreVary: true })) await cache.add(url);
  }).catch(() => {}));
});
