// Cache public code and a generic offline screen only. Never cache user records,
// authenticated HTML, API responses, tokens, mailbox data or OAuth redirects.
const CACHE = 'cams-life-assets-v1';
const ASSETS = new Map([
  ['/offline.html','text/html'], ['/favicon.svg','image/svg+xml'],
  ['/studio.css','text/css'], ['/life.css','text/css'],
  ['/studio.js','javascript'], ['/life-ui.js','javascript'], ['/pwa.js','javascript'], ['/chatgpt-link.js','javascript'],
  ['/model.js','javascript'], ['/body.js','javascript'], ['/sync.js','javascript'],
  ['/gestures.js','javascript'], ['/life-model.js','javascript'], ['/health-intelligence.js','javascript'],
  ['/manifest.webmanifest','application/manifest+json'],
  ['/icons/icon-192.png','image/png'], ['/icons/icon-512.png','image/png'],
  ['/icons/icon-maskable-512.png','image/png'], ['/icons/apple-touch-icon.png','image/png']
]);
function safeResponse(response, mime) {
  return response.ok && !response.redirected && response.type !== 'opaque' &&
    (response.headers.get('content-type') || '').includes(mime);
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of ['/offline.html','/icons/icon-192.png']) {
      const response = await fetch(path, {cache:'no-store',redirect:'error'});
      if (!safeResponse(response, ASSETS.get(path))) throw Error('Offline assets unavailable');
      await cache.put(path, response);
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('cams-life-assets-') && key !== CACHE) await caches.delete(key);
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization')) return;
  // Always let network authorization run. Never substitute cached records or
  // app HTML for a login redirect, sign-out, 401, 403 or another HTTP response.
  if (request.mode === 'navigate') {
    if (url.pathname !== '/' && url.pathname !== '/index.html') return;
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match('/offline.html')));
    return;
  }
  const mime = ASSETS.get(url.pathname);
  if (!mime || [...url.searchParams.keys()].some(key => key !== 'v')) return;
  // Exact query key preserves release versions. Network first prevents an old
  // module being paired with the newest HTML. HTTP failures never use fallback.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (safeResponse(response, mime)) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
