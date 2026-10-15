/* Only digest-verified public app files belong in this cache. */
const SHELL = [{"url":"/index.html","query":"","type":"text/html","sha256":"28f92b26225cd0721ca2e00b628e851849126c20736a7b47f805e9c3192482f5"},{"url":"/studio.js","query":"?v=9","type":"text/javascript","sha256":"7d8e9116865373ba46adc50da2bb344477dcef6fa19cae9e4ff5ebea76a237a6"},{"url":"/pwa.js","query":"","type":"text/javascript","sha256":"54a2117da479eeb279a87041bc45dc147fce82260747aa5d5b0ccbc72c2bad6c"},{"url":"/studio.css","query":"?v=9","type":"text/css","sha256":"feafa8ea6433cd3348bf153e539339fb3b15ab2dbc891fab03a3cb0ec08bd61c"},{"url":"/glass.css","query":"?v=9","type":"text/css","sha256":"b6edfd91be55f7e83199dde18bceeb0886849f78bbc2064073e0591c4675547a"},{"url":"/gestures.js","query":"","type":"text/javascript","sha256":"dbd52922e3b3ab27e15056ceb651d4b12210baa48bf700ab20211f3755e729fa"},{"url":"/widget-motion.js","query":"","type":"text/javascript","sha256":"2dcbc82ee7ad9f740e6cfb658138abada1337f400d788a77298264d0674d2881"},{"url":"/liquid-scene.js","query":"","type":"text/javascript","sha256":"330ba457b2561635cb544e696b80328074601625df94f9356199916ea54d6d10"},{"url":"/exercise-catalogue.js","query":"","type":"text/javascript","sha256":"8b67bff058afb1c09a2c6e05b0ec5bdc944c02f9478824e494444bd7974fc461"},{"url":"/exercise-extra.js","query":"","type":"text/javascript","sha256":"2176795b46d180c838d405de35d35f339716d8cb447a80e8fc61f032ee01d67e"},{"url":"/exercise-demo.js","query":"","type":"text/javascript","sha256":"800a1fd3329789508bfbf46753e0ccd14257abec0fa8472f24181fe6411ceb56"},{"url":"/exercise-demo.css","query":"?v=9","type":"text/css","sha256":"27c5af6d37f8612639f699f3424812b58efc6858ab7b62bf311a5865d0d2deeb"},{"url":"/vendor/three.js","query":"","type":"text/javascript","sha256":"9621acd5cbc5e4fe49f716a11ad45853434dd5814a8f6b7f04dcbe20755277dd"},{"url":"/health-intelligence.js","query":"","type":"text/javascript","sha256":"53593edda3a4f42e4ec8d834937260aee14d96f1a0070c1a2e0f2116f0c0add0"},{"url":"/model.js","query":"","type":"text/javascript","sha256":"be53b5c8896707f5bab0b7185f6db76418a5de117695ebf7c36c1456b8acfa22"},{"url":"/body.js","query":"","type":"text/javascript","sha256":"58bdfc91af3b7e08a951d0043441298c3572532b5028e3517484266b3141b292"},{"url":"/sync.js","query":"","type":"text/javascript","sha256":"2f99d3473f17dd3e11aa05d9de082c77374e66844e77c3595f4f13416b0dcbf9"},{"url":"/manifest.webmanifest","query":"","type":"application/manifest+json","sha256":"3be64517453be519ea815676b177be0c24d35fd81a184f5de14db46a11cc6d89"},{"url":"/favicon.svg","query":"","type":"image/svg+xml","sha256":"ca7409d46627771be12fb46fbd1b94df1524079f6365354baee1bd1411896fb5"},{"url":"/icons/icon-192.png","query":"","type":"image/png","sha256":"27590fc8bbce691e4d776769f6f4646d33ef2f0156e9f46ed085ca9649bf062f"},{"url":"/icons/icon-512.png","query":"","type":"image/png","sha256":"70a91779aa61000f149120ebd43633be93c5737fc1f21660b0058f2aaa0bef7a"},{"url":"/icons/icon-maskable-512.png","query":"","type":"image/png","sha256":"ebaad11fcd6250adeda4ca49c37170ca60b12460472c72250b68f9398951f18e"},{"url":"/icons/apple-touch-icon.png","query":"","type":"image/png","sha256":"2d85a43de2b6d56734394b4395d10cfaeb0ae7867475d66f2c8ea36c151400d1"},{"url":"/assets/noto-sans-latin.woff2","query":"","type":"font/woff2","sha256":"51ca196f49a33e79e7870ff88ebd2829a3f627a51e7d690986618f0e7ad2b52d"}];
const CACHE_PREFIX = 'cams-life-shell-';
const CACHE_NAME = CACHE_PREFIX + '0c7084d890bc3d1b';
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
