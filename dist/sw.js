/* Only digest-verified public app files belong in this cache. */
const SHELL = [{"url":"/index.html","query":"","type":"text/html","sha256":"05e7eaee9c4741fb864e4b0757d2f164d2c513e345782908c1aed9106b9d6a2d"},{"url":"/studio.js","query":"?v=12","type":"text/javascript","sha256":"10feaad68c55ea1be077258a75700d64aff54ee28c678f922addffff47bf02af"},{"url":"/pwa.js","query":"","type":"text/javascript","sha256":"54a2117da479eeb279a87041bc45dc147fce82260747aa5d5b0ccbc72c2bad6c"},{"url":"/studio.css","query":"?v=12","type":"text/css","sha256":"feafa8ea6433cd3348bf153e539339fb3b15ab2dbc891fab03a3cb0ec08bd61c"},{"url":"/glass.css","query":"?v=12","type":"text/css","sha256":"4e526a84e0d736861ba32577c0a7220610256dce8e6b6aa6c10b223e3173e656"},{"url":"/gestures.js","query":"","type":"text/javascript","sha256":"dbd52922e3b3ab27e15056ceb651d4b12210baa48bf700ab20211f3755e729fa"},{"url":"/widget-motion.js","query":"","type":"text/javascript","sha256":"2dcbc82ee7ad9f740e6cfb658138abada1337f400d788a77298264d0674d2881"},{"url":"/liquid-scene.js","query":"","type":"text/javascript","sha256":"54dcb99fd31e147024967aa47cf207b0c71ed3982e2bb347e979a048ef15bddb"},{"url":"/tracker-shell.js","query":"","type":"text/javascript","sha256":"c609bbd913432da7436c28221d438d23060dfc8b3ccd2dfaf2ac319cece5809a"},{"url":"/tracker-shell.css","query":"?v=12","type":"text/css","sha256":"676731acbbf6a01e64c00be8934e18d00c152c0eed231cf7246d60200224fb33"},{"url":"/tracker-model.js","query":"","type":"text/javascript","sha256":"23586b6b73c3f9e3b422016cce02df3d7b53e54ddf5cdfe8689cfbf09db8d1f4"},{"url":"/food-studio.js","query":"","type":"text/javascript","sha256":"47d2fdbd093ca3599eb620229eaf5127b99bf55e1fea569a98b55ac7047a9c32"},{"url":"/food-studio-model.js","query":"","type":"text/javascript","sha256":"ebc9551a9e0476f2861c9f73b802be893aeb964af603baaef09b39859c1a4624"},{"url":"/food-studio.css","query":"?v=12","type":"text/css","sha256":"ae99ad08aa7bc9a2a59ad8fcdb4cdb223fae60f353a5977d8243d94394fb7584"},{"url":"/food-lookup.js","query":"","type":"text/javascript","sha256":"e27d37e3988c70a288c26423faac83447b32d09d0be663fca75c4af49300af3f"},{"url":"/food-catalog.js","query":"","type":"text/javascript","sha256":"f7b634b465cc74082439e4c68ebc2a398f30f2f83992fe73809dd0eb78909348"},{"url":"/body-studio.js","query":"","type":"text/javascript","sha256":"b567237e782e6a4619f024764ae7738b25f3d3a2087cbc036207028be61f3bce"},{"url":"/body-studio-model.js","query":"","type":"text/javascript","sha256":"dc98d8a9d19cd66774330343d6ebfd1030d4ccca4de03ecc1be85e3db5330f22"},{"url":"/body-studio.css","query":"?v=12","type":"text/css","sha256":"f52b80905860059bd99113193c3c3e7defd457d31613d92a3ffe73d0e4b54a48"},{"url":"/workout-studio.js","query":"","type":"text/javascript","sha256":"7679ea15560d69a85c2ecc369429215c500dae5699a1a39e54f1bb21b1c3f7fc"},{"url":"/workout-studio-model.js","query":"","type":"text/javascript","sha256":"a33d9dd7e9d523537fdde710a504ac0e534ad9540dc03e8af01d701672baa322"},{"url":"/workout-studio.css","query":"?v=12","type":"text/css","sha256":"5d70c1d3ef4dc731534a7a1b0d41d56d1291af3c1ba43443b50f6e07842ca002"},{"url":"/exercise-catalogue.js","query":"","type":"text/javascript","sha256":"5edef2640fa6619c1fec79b8e86c77d88328640e70961a21070eeed5bf8e1ae1"},{"url":"/exercise-extra.js","query":"","type":"text/javascript","sha256":"8dbf9414b3483a3bc7cfc97330d18477fcc88ec2858e6226f1d70b6101dbaaf3"},{"url":"/exercise-demo.js","query":"","type":"text/javascript","sha256":"110a66c8f1a54085eb9ce7b3d81b9407a3cb88ebd1350e6dad9b20c559dbe9c7"},{"url":"/exercise-anatomy.js","query":"","type":"text/javascript","sha256":"bb00a7a551c3eda74b1f607d8f4de014c5e5163d686aef620cd470bb1ffa2a25"},{"url":"/exercise-anatomy-mesh.js","query":"","type":"text/javascript","sha256":"074efd23437666cfc1a8f0c3b8f23e52dc0526acc1d1a97ea27b026503c50e1c"},{"url":"/exercise-demo.css","query":"?v=12","type":"text/css","sha256":"9988e3564255a8d8b43c89709420e87a0fdf711e901d41e264bfb9529585be4f"},{"url":"/vendor/three.js","query":"","type":"text/javascript","sha256":"9621acd5cbc5e4fe49f716a11ad45853434dd5814a8f6b7f04dcbe20755277dd"},{"url":"/health-intelligence.js","query":"","type":"text/javascript","sha256":"a1cd01926d29bb22d0c2133f6f68fbab4b143d3a1d9acb02bf21894c0de26a5a"},{"url":"/model.js","query":"","type":"text/javascript","sha256":"be53b5c8896707f5bab0b7185f6db76418a5de117695ebf7c36c1456b8acfa22"},{"url":"/body.js","query":"","type":"text/javascript","sha256":"58bdfc91af3b7e08a951d0043441298c3572532b5028e3517484266b3141b292"},{"url":"/sync.js","query":"","type":"text/javascript","sha256":"2f99d3473f17dd3e11aa05d9de082c77374e66844e77c3595f4f13416b0dcbf9"},{"url":"/manifest.webmanifest","query":"","type":"application/manifest+json","sha256":"3be64517453be519ea815676b177be0c24d35fd81a184f5de14db46a11cc6d89"},{"url":"/favicon.svg","query":"","type":"image/svg+xml","sha256":"ca7409d46627771be12fb46fbd1b94df1524079f6365354baee1bd1411896fb5"},{"url":"/icons/icon-192.png","query":"","type":"image/png","sha256":"27590fc8bbce691e4d776769f6f4646d33ef2f0156e9f46ed085ca9649bf062f"},{"url":"/icons/icon-512.png","query":"","type":"image/png","sha256":"70a91779aa61000f149120ebd43633be93c5737fc1f21660b0058f2aaa0bef7a"},{"url":"/icons/icon-maskable-512.png","query":"","type":"image/png","sha256":"ebaad11fcd6250adeda4ca49c37170ca60b12460472c72250b68f9398951f18e"},{"url":"/icons/apple-touch-icon.png","query":"","type":"image/png","sha256":"2d85a43de2b6d56734394b4395d10cfaeb0ae7867475d66f2c8ea36c151400d1"},{"url":"/assets/noto-sans-latin.woff2","query":"","type":"font/woff2","sha256":"51ca196f49a33e79e7870ff88ebd2829a3f627a51e7d690986618f0e7ad2b52d"},{"url":"/vendor/nutrition-ocr.js","query":"","type":"text/javascript","sha256":"0224a1e59da9388b2f23ec8ea3e3263ab5f9272af6769fb8b569aef45dfc79e2","lazy":true},{"url":"/vendor/food-barcode.js","query":"","type":"text/javascript","sha256":"1d1386be6ae325306567666f7c746bb50a0beaac082f70950945e982504201ea","lazy":true},{"url":"/vendor/ocr/worker.min.js","query":"","type":"text/javascript","sha256":"38645599043239c0eb6db08a6504a92dcdc292200535f3e9339cd77c4443b842","lazy":true},{"url":"/vendor/ocr/tesseract-core-lstm.wasm.js","query":"","type":"text/javascript","sha256":"775a35df6f2ae100e02609443e6bd5cafcd07983dd6175454ca4a432a7730687","lazy":true},{"url":"/vendor/ocr/tesseract-core-simd-lstm.wasm.js","query":"","type":"text/javascript","sha256":"9d7c43fb206dc9f48475228b46bf35f888fa9e6259da2e67d5a75c77049f2dc7","lazy":true},{"url":"/vendor/ocr/tesseract-core.wasm.js","query":"","type":"text/javascript","sha256":"e66872f6a76f5ad414d73d21512245df0de3060ad4871a97c47efceaab27b955","lazy":true},{"url":"/vendor/ocr/tesseract-core-simd.wasm.js","query":"","type":"text/javascript","sha256":"3b0678c47a8dea6abb931b214171c08b742a5b9a9fcbbb1a028a08d5de6e9d4c","lazy":true},{"url":"/vendor/ocr/eng.traineddata.gz","query":"","type":"application/gzip","sha256":"45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91","lazy":true}];
const CACHE_PREFIX = 'cams-life-shell-';
const CACHE_NAME = CACHE_PREFIX + 'dffffc5c510dfef6';
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
