/* Only digest-verified public app files belong in this cache. */
const SHELL = [{"url":"/index.html","query":"","type":"text/html","sha256":"120fb7d795bc30a6bf254d6beed717dd8a89ab11cf88d9e0e2b061b52824e511"},{"url":"/studio.js","query":"?v=6","type":"text/javascript","sha256":"4af07423e363622b4efbdcd35b0297e5bc3fdcb4b8f4df5cc73f0028ad367434"},{"url":"/pwa.js","query":"","type":"text/javascript","sha256":"6285418b745d73044f081a2efcdff21f0371ff87b7c5792bc2882914e23b6874"},{"url":"/studio.css","query":"?v=6","type":"text/css","sha256":"feafa8ea6433cd3348bf153e539339fb3b15ab2dbc891fab03a3cb0ec08bd61c"},{"url":"/life.css","query":"?v=6","type":"text/css","sha256":"c84ca00e918cc64a590f410295ee989dc377d8aaea1eb54c43b54592fa08702a"},{"url":"/life-ui.js","query":"","type":"text/javascript","sha256":"b7bece3549a595d8f857cf53d568ed243b7c880ddf1bf279d4e6c555179b04d5"},{"url":"/life-model.js","query":"","type":"text/javascript","sha256":"1363aa3537b6fa74c48d1b2d96f185e4ebbdc0c7f7593cc3fbf01cc3473e5442"},{"url":"/health-intelligence.js","query":"","type":"text/javascript","sha256":"38d539289c5ff470b0241fd01499ec199ee6977b56ffd718483ba6f66495ffef"},{"url":"/model.js","query":"","type":"text/javascript","sha256":"be53b5c8896707f5bab0b7185f6db76418a5de117695ebf7c36c1456b8acfa22"},{"url":"/body.js","query":"","type":"text/javascript","sha256":"58bdfc91af3b7e08a951d0043441298c3572532b5028e3517484266b3141b292"},{"url":"/sync.js","query":"","type":"text/javascript","sha256":"2f99d3473f17dd3e11aa05d9de082c77374e66844e77c3595f4f13416b0dcbf9"},{"url":"/manifest.webmanifest","query":"","type":"application/manifest+json","sha256":"3770a1541346d5baf516d2c1fc7434e04e0079ca4379b8c1354ccc33adde234c"},{"url":"/favicon.svg","query":"","type":"image/svg+xml","sha256":"ca7409d46627771be12fb46fbd1b94df1524079f6365354baee1bd1411896fb5"},{"url":"/icons/icon-192.png","query":"","type":"image/png","sha256":"27590fc8bbce691e4d776769f6f4646d33ef2f0156e9f46ed085ca9649bf062f"},{"url":"/icons/icon-512.png","query":"","type":"image/png","sha256":"70a91779aa61000f149120ebd43633be93c5737fc1f21660b0058f2aaa0bef7a"},{"url":"/icons/icon-maskable-512.png","query":"","type":"image/png","sha256":"ebaad11fcd6250adeda4ca49c37170ca60b12460472c72250b68f9398951f18e"}];
const CACHE_PREFIX = 'cams-life-shell-';
const CACHE_NAME = CACHE_PREFIX + '036b11c8e21ebb02';
const BY_PATH = new Map(SHELL.map(asset => [asset.url, asset]));
const SECURITY_HEADERS = ['Content-Security-Policy', 'X-Frame-Options', 'Referrer-Policy', 'X-Content-Type-Options', 'Permissions-Policy', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Embedder-Policy', 'Cross-Origin-Resource-Policy'];
function copySecurityHeaders(from, to) {
  for (const name of SECURITY_HEADERS) if (from.has(name)) to.set(name, from.get(name));
}

function assetFor(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization')) return null;
  const asset = BY_PATH.get(url.pathname);
  if (!asset || url.pathname === '/index.html') return null;
  // Only known entry versions may use the snapshot; never cache arbitrary queries.
  if (url.search && url.search !== asset.query) return null;
  return asset;
}
function safeResponse(response, asset) {
  return response.ok && !response.redirected && response.type !== 'opaque' && response.type !== 'opaqueredirect'
    && (!response.url || new URL(response.url).origin === self.location.origin)
    && (response.headers.get('Content-Type')?.split(';')[0].trim() === asset.type
      || asset.type === 'text/javascript' && response.headers.get('Content-Type')?.startsWith('application/javascript')
      || asset.type === 'application/manifest+json' && response.headers.get('Content-Type')?.startsWith('application/json'));
}
async function verifiedResponse(response, asset) {
  if (!safeResponse(response, asset)) throw Error('App asset unavailable');
  const bytes = await response.arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
  if (digest !== asset.sha256) throw Error('App asset changed during installation');
  // Gateway cookies, identity headers and sensitive URLs must not enter CacheStorage.
  const headers = new Headers({'Content-Type': asset.type, 'X-Cams-Life-Cached-Shell': '1', 'X-Content-Type-Options': 'nosniff'});
  copySecurityHeaders(response.headers, headers);
  return new Response(bytes, {headers});
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      for (const asset of SHELL) {
        const response = await fetch(asset.url === '/index.html' ? '/' : asset.url, {cache:'no-store', credentials:'same-origin', redirect:'error'});
        await cache.put(asset.url, await verifiedResponse(response, asset));
      }
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  // Explicitly requested from the update review UI; never reload an active form automatically.
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
async function navigate(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    // The Worker marker is set only on the actual app shell behind Sites access checks.
    // Online login/permission/error pages must pass through, not become offline fallbacks.
    if (!response.ok || response.redirected || response.headers.get('X-Cams-Life-Shell') !== '1'
      || !response.headers.get('Content-Type')?.startsWith('text/html')) return response;
    const cached = await cache.match('/index.html');
    if (!cached) return response;
    // Apply current gateway security policy while keeping the installed release coherent.
    const headers = new Headers(cached.headers);
    copySecurityHeaders(response.headers, headers);
    return new Response(cached.body, {headers});
  } catch {
    return await cache.match('/index.html') || new Response('Cam’s Life is offline. Connect once to prepare the app.', {status:503,headers:{'Content-Type':'text/plain'}});
  }
}
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization')) return;
  if (request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname)) {
    event.respondWith(navigate(request));
    return;
  }
  const asset = assetFor(request);
  if (asset) event.respondWith((async () => {
    const cached = await (await caches.open(CACHE_NAME)).match(asset.url);
    return cached || fetch(request);
  })());
});
