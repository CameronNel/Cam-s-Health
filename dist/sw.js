/* Only digest-verified public app files belong in this cache. */
const SHELL = [{"url":"/index.html","query":"","type":"text/html","sha256":"60c94a1cb768776b41ef3180e1963eb7af811889e3f370ae26a29eaf6080a8c0"},{"url":"/studio.js","query":"?v=8","type":"text/javascript","sha256":"6dfa2d24a8372280aa11b46ee8ea9f12c4b7be1db64f3518f90216d674f9952a"},{"url":"/pwa.js","query":"","type":"text/javascript","sha256":"54a2117da479eeb279a87041bc45dc147fce82260747aa5d5b0ccbc72c2bad6c"},{"url":"/studio.css","query":"?v=8","type":"text/css","sha256":"feafa8ea6433cd3348bf153e539339fb3b15ab2dbc891fab03a3cb0ec08bd61c"},{"url":"/life.css","query":"?v=8","type":"text/css","sha256":"1b00199bb6de83e9740303f10e1ee68fdf7db24d48ad0e08e8bfbd79c31c0d84"},{"url":"/health-ui.css","query":"?v=9","type":"text/css","sha256":"22edad3dea3cdd135cd1a7ed4c6d8262370ff509d2d2e2e5f640dc2591f5ef4e"},{"url":"/training-body-ui.css","query":"?v=9","type":"text/css","sha256":"377b56df1a0548a614501644cbb64b98a50e349d2b4512c07886a6aaa4854818"},{"url":"/life-settings-ui.css","query":"?v=9","type":"text/css","sha256":"1c72a346cd779b9043f390b23ae35ab974c409702a12647e15020c3cc1ec84bc"},{"url":"/life-ui.js","query":"","type":"text/javascript","sha256":"c13d78d38873ce8e965c076cdb394c8dc745ea5282414fc1d0608308f87e1e2a"},{"url":"/life-model.js","query":"","type":"text/javascript","sha256":"1363aa3537b6fa74c48d1b2d96f185e4ebbdc0c7f7593cc3fbf01cc3473e5442"},{"url":"/health-intelligence.js","query":"","type":"text/javascript","sha256":"53593edda3a4f42e4ec8d834937260aee14d96f1a0070c1a2e0f2116f0c0add0"},{"url":"/integrations/watch-import.js","query":"","type":"text/javascript","sha256":"d88917f426c2a7564bec56c2653b6613adafd178afe18da58439e171aebb9399"},{"url":"/integrations/watch-ui.js","query":"","type":"text/javascript","sha256":"f3ce13445117d12d74073ab76c5ed1fd8793e1197104fb72b1e9d17d24b5ce3f"},{"url":"/model.js","query":"","type":"text/javascript","sha256":"be53b5c8896707f5bab0b7185f6db76418a5de117695ebf7c36c1456b8acfa22"},{"url":"/body.js","query":"","type":"text/javascript","sha256":"58bdfc91af3b7e08a951d0043441298c3572532b5028e3517484266b3141b292"},{"url":"/sync.js","query":"","type":"text/javascript","sha256":"2f99d3473f17dd3e11aa05d9de082c77374e66844e77c3595f4f13416b0dcbf9"},{"url":"/manifest.webmanifest","query":"","type":"application/manifest+json","sha256":"650e9205abec85926772386d4041803cf44fa149140176880c9fcb6cd1b4d068"},{"url":"/favicon.svg","query":"","type":"image/svg+xml","sha256":"ca7409d46627771be12fb46fbd1b94df1524079f6365354baee1bd1411896fb5"},{"url":"/icons/icon-192.png","query":"","type":"image/png","sha256":"27590fc8bbce691e4d776769f6f4646d33ef2f0156e9f46ed085ca9649bf062f"},{"url":"/icons/icon-512.png","query":"","type":"image/png","sha256":"70a91779aa61000f149120ebd43633be93c5737fc1f21660b0058f2aaa0bef7a"},{"url":"/icons/icon-maskable-512.png","query":"","type":"image/png","sha256":"ebaad11fcd6250adeda4ca49c37170ca60b12460472c72250b68f9398951f18e"},{"url":"/typography.css","query":"?v=1","type":"text/css","sha256":"f9d000a82551f9b60acf8a9423985931aea441c46e4a89c0a9fbe5473bae6ef7"},{"url":"/assets/noto-sans-latin.woff2","query":"","type":"font/woff2","sha256":"51ca196f49a33e79e7870ff88ebd2829a3f627a51e7d690986618f0e7ad2b52d"},{"url":"/assets/roboto-latin.woff2","query":"","type":"font/woff2","sha256":"1404ca348bd75ef836f4dd8b6f2cc719458642d1237c368296b2fc652dca47dc"},{"url":"/assets/health-tiles.png","query":"","type":"image/png","sha256":"fffeee8ba357c2c47756026187641226ebcc962c150d264dcda707fa843ff043"}];
const CACHE_PREFIX = 'cams-life-shell-';
const CACHE_NAME = CACHE_PREFIX + '6f1b6d0dba891f25';
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
