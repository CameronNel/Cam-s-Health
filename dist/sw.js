/* Only digest-verified public app files belong in this cache. */
const SHELL = [{"url":"/index.html","query":"","type":"text/html","sha256":"d490ff9b02d9215dcb8232b22e563bc6a996314de768aff0b1a16050f1a4f544"},{"url":"/studio.js","query":"?v=12","type":"text/javascript","sha256":"a95ea5206be99d578dd1613a76d46c607f2916ed8fb153d2adcdfb8afc1d2856"},{"url":"/pwa.js","query":"","type":"text/javascript","sha256":"54a2117da479eeb279a87041bc45dc147fce82260747aa5d5b0ccbc72c2bad6c"},{"url":"/studio.css","query":"?v=12","type":"text/css","sha256":"feafa8ea6433cd3348bf153e539339fb3b15ab2dbc891fab03a3cb0ec08bd61c"},{"url":"/glass.css","query":"?v=12","type":"text/css","sha256":"575dfd72ecbb0238c522d0925da037fe21f555d0f13e1843b5d6b3f77795450e"},{"url":"/gestures.js","query":"","type":"text/javascript","sha256":"dbd52922e3b3ab27e15056ceb651d4b12210baa48bf700ab20211f3755e729fa"},{"url":"/widget-motion.js","query":"","type":"text/javascript","sha256":"2dcbc82ee7ad9f740e6cfb658138abada1337f400d788a77298264d0674d2881"},{"url":"/liquid-scene.js","query":"","type":"text/javascript","sha256":"94178c20e3bbb963f98e3b304de5bcf4bed11dac8a2df5c7e5e69f3fa9810532"},{"url":"/tracker-shell.js","query":"","type":"text/javascript","sha256":"a487e0dd57961e638647ca6d38830f3006a3aab0966728af3b7cbba0132d9c36"},{"url":"/tracker-shell.css","query":"?v=12","type":"text/css","sha256":"cd49a4132a443ff07a45c0c41bd037198372f36e6c0544b4c62db6d7343bfeaf"},{"url":"/tracker-model.js","query":"","type":"text/javascript","sha256":"864e89603c0a21248e420a5ed0f887f5bde0a96b2577b4044c05e47be0767124"},{"url":"/food-studio.js","query":"","type":"text/javascript","sha256":"4769d25aef227e21bb9de55e527e7a4b9038bb9614d2f595e3ca8b773e865f2d"},{"url":"/food-studio-model.js","query":"","type":"text/javascript","sha256":"ebc9551a9e0476f2861c9f73b802be893aeb964af603baaef09b39859c1a4624"},{"url":"/food-studio.css","query":"?v=12","type":"text/css","sha256":"d81bedb00e55cae34972ca3c007f1de69b2cba3919d1ab5056cbbba9c6766c6f"},{"url":"/food-lookup.js","query":"","type":"text/javascript","sha256":"e27d37e3988c70a288c26423faac83447b32d09d0be663fca75c4af49300af3f"},{"url":"/food-catalog.js","query":"","type":"text/javascript","sha256":"f7b634b465cc74082439e4c68ebc2a398f30f2f83992fe73809dd0eb78909348"},{"url":"/body-studio.js","query":"","type":"text/javascript","sha256":"a0f0768505c8fb970a13ad3b504010f5958c2d392621cd3d69eeb3fba68173f7"},{"url":"/body-studio-model.js","query":"","type":"text/javascript","sha256":"bfa8a2005c21f3b07c6ee9ba95250d32dba92066add37a5ebbc32854c87e3839"},{"url":"/body-studio.css","query":"?v=12","type":"text/css","sha256":"abc6b3ff615634bbd517739e915fa12bd2d281548958c9be4e01d8f616c3183c"},{"url":"/workout-studio.js","query":"","type":"text/javascript","sha256":"a80464753df4880b3e193dd6ecef3809a2d97132f42319551c020dcafc5971ec"},{"url":"/workout-studio-model.js","query":"","type":"text/javascript","sha256":"dc947509477251a0a5a8835bfe9f4d837a7203ec6229e9b1f7a625c310a54601"},{"url":"/workout-studio.css","query":"?v=12","type":"text/css","sha256":"05f091c6c451a12823748ed7df9f2003379d459a97a1e0b86df1bef820d3064d"},{"url":"/exercise-catalogue.js","query":"","type":"text/javascript","sha256":"5edef2640fa6619c1fec79b8e86c77d88328640e70961a21070eeed5bf8e1ae1"},{"url":"/exercise-extra.js","query":"","type":"text/javascript","sha256":"2506da6d7b7f505940407410844252c7358cc1c3e5be10042ae335e717904fa0"},{"url":"/exercise-demo.js","query":"","type":"text/javascript","sha256":"28cca48165f30520e40e2f8031a1d2cc5a9d775ce8cf941a7a6fea75a3e40035"},{"url":"/exercise-anatomy.js","query":"","type":"text/javascript","sha256":"bb00a7a551c3eda74b1f607d8f4de014c5e5163d686aef620cd470bb1ffa2a25"},{"url":"/exercise-anatomy-mesh.js","query":"","type":"text/javascript","sha256":"074efd23437666cfc1a8f0c3b8f23e52dc0526acc1d1a97ea27b026503c50e1c"},{"url":"/exercise-demo.css","query":"?v=12","type":"text/css","sha256":"75f6761459724362e23cfcfeae75fd457e57c10a7073a43bd7328bd53af6d3a9"},{"url":"/vendor/three.js","query":"","type":"text/javascript","sha256":"9621acd5cbc5e4fe49f716a11ad45853434dd5814a8f6b7f04dcbe20755277dd"},{"url":"/health-intelligence.js","query":"","type":"text/javascript","sha256":"a1cd01926d29bb22d0c2133f6f68fbab4b143d3a1d9acb02bf21894c0de26a5a"},{"url":"/model.js","query":"","type":"text/javascript","sha256":"be53b5c8896707f5bab0b7185f6db76418a5de117695ebf7c36c1456b8acfa22"},{"url":"/body.js","query":"","type":"text/javascript","sha256":"58bdfc91af3b7e08a951d0043441298c3572532b5028e3517484266b3141b292"},{"url":"/sync.js","query":"","type":"text/javascript","sha256":"2f99d3473f17dd3e11aa05d9de082c77374e66844e77c3595f4f13416b0dcbf9"},{"url":"/manifest.webmanifest","query":"","type":"application/manifest+json","sha256":"3be64517453be519ea815676b177be0c24d35fd81a184f5de14db46a11cc6d89"},{"url":"/favicon.svg","query":"","type":"image/svg+xml","sha256":"ca7409d46627771be12fb46fbd1b94df1524079f6365354baee1bd1411896fb5"},{"url":"/icons/icon-192.png","query":"","type":"image/png","sha256":"27590fc8bbce691e4d776769f6f4646d33ef2f0156e9f46ed085ca9649bf062f"},{"url":"/icons/icon-512.png","query":"","type":"image/png","sha256":"70a91779aa61000f149120ebd43633be93c5737fc1f21660b0058f2aaa0bef7a"},{"url":"/icons/icon-maskable-512.png","query":"","type":"image/png","sha256":"ebaad11fcd6250adeda4ca49c37170ca60b12460472c72250b68f9398951f18e"},{"url":"/icons/apple-touch-icon.png","query":"","type":"image/png","sha256":"2d85a43de2b6d56734394b4395d10cfaeb0ae7867475d66f2c8ea36c151400d1"},{"url":"/assets/noto-sans-latin.woff2","query":"","type":"font/woff2","sha256":"51ca196f49a33e79e7870ff88ebd2829a3f627a51e7d690986618f0e7ad2b52d"},{"url":"/vendor/nutrition-ocr.js","query":"","type":"text/javascript","sha256":"0224a1e59da9388b2f23ec8ea3e3263ab5f9272af6769fb8b569aef45dfc79e2","lazy":true},{"url":"/vendor/food-barcode.js","query":"","type":"text/javascript","sha256":"1d1386be6ae325306567666f7c746bb50a0beaac082f70950945e982504201ea","lazy":true},{"url":"/vendor/ocr/worker.min.js","query":"","type":"text/javascript","sha256":"38645599043239c0eb6db08a6504a92dcdc292200535f3e9339cd77c4443b842","lazy":true},{"url":"/vendor/ocr/tesseract-core-lstm.wasm.js","query":"","type":"text/javascript","sha256":"775a35df6f2ae100e02609443e6bd5cafcd07983dd6175454ca4a432a7730687","lazy":true},{"url":"/vendor/ocr/tesseract-core-simd-lstm.wasm.js","query":"","type":"text/javascript","sha256":"9d7c43fb206dc9f48475228b46bf35f888fa9e6259da2e67d5a75c77049f2dc7","lazy":true},{"url":"/vendor/ocr/tesseract-core.wasm.js","query":"","type":"text/javascript","sha256":"e66872f6a76f5ad414d73d21512245df0de3060ad4871a97c47efceaab27b955","lazy":true},{"url":"/vendor/ocr/tesseract-core-simd.wasm.js","query":"","type":"text/javascript","sha256":"3b0678c47a8dea6abb931b214171c08b742a5b9a9fcbbb1a028a08d5de6e9d4c","lazy":true},{"url":"/vendor/ocr/eng.traineddata.gz","query":"","type":"application/gzip","sha256":"45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91","lazy":true}];
const CACHE_PREFIX = 'cams-life-shell-';
const CACHE_NAME = CACHE_PREFIX + '3f3c6adec69522a6';
const BY_PATH = new Map(SHELL.map(asset => [asset.url, asset]));
const PENDING_ASSETS = new Map();
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
      || asset.type === 'application/manifest+json' && response.headers.get('Content-Type')?.startsWith('application/json')
      || asset.type === 'application/gzip' && ['application/x-gzip','application/octet-stream'].includes(response.headers.get('Content-Type')?.split(';')[0].trim()));
}
async function verifiedResponse(response, asset) {
  if (!safeResponse(response, asset)) throw Error('App asset unavailable');
  const bytes = await response.arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
  if (digest !== asset.sha256) throw Error('App asset changed from this installed release');
  // Gateway cookies, identity headers and sensitive URLs must not enter CacheStorage.
  const headers = new Headers({'Content-Type': asset.type, 'X-Cams-Life-Cached-Shell': '1', 'X-Content-Type-Options': 'nosniff'});
  copySecurityHeaders(response.headers, headers);
  return new Response(bytes, {headers});
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      for (const asset of SHELL.filter(asset => !asset.lazy)) {
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
async function publicAsset(request, asset) {
  const cache = await caches.open(CACHE_NAME), cached = await cache.match(asset.url);
  if (cached) return cached;
  // A library first requested later still belongs to this exact release. Never
  // cache a newer engine, login response, redirect or unverified network body.
  let pending = PENDING_ASSETS.get(asset.url);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(asset.url + asset.query, {cache:'no-store',credentials:'same-origin',redirect:'error'});
      const verified = await verifiedResponse(response,asset);
      await cache.put(asset.url,verified.clone());
      return verified;
    })();
    PENDING_ASSETS.set(asset.url,pending);
    pending.then(() => PENDING_ASSETS.delete(asset.url), () => PENDING_ASSETS.delete(asset.url));
  }
  return (await pending).clone();
}
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization')) return;
  if (request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname)) {
    event.respondWith(navigate(request));
    return;
  }
  const asset = assetFor(request);
  if (asset) event.respondWith(publicAsset(request,asset));
});
