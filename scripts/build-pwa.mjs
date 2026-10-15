import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Explicit public code/assets only. Never add health JSON, mailbox data or photos.
const files = [
  'index.html', 'studio.js', 'pwa.js', 'studio.css', 'glass.css', 'gestures.js', 'widget-motion.js', 'liquid-scene.js',
  'tracker-shell.js', 'tracker-shell.css', 'tracker-model.js',
  'food-studio.js', 'food-studio-model.js', 'food-studio.css', 'food-lookup.js', 'food-catalog.js',
  'body-studio.js', 'body-studio-model.js', 'body-studio.css',
  'workout-studio.js', 'workout-studio-model.js', 'workout-studio.css',
  'exercise-catalogue.js', 'exercise-extra.js', 'exercise-demo.js', 'exercise-anatomy.js', 'exercise-anatomy-mesh.js', 'exercise-demo.css', 'vendor/three.js',
  'health-intelligence.js', 'model.js', 'body.js', 'sync.js', 'manifest.webmanifest', 'favicon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'assets/noto-sans-latin.woff2'
];
// These large, local public libraries are verified and cached only when first
// requested. Installing an update must not download every OCR engine variant.
const lazyFiles = [
  'vendor/nutrition-ocr.js', 'vendor/food-barcode.js', 'vendor/ocr/worker.min.js',
  'vendor/ocr/tesseract-core-lstm.wasm.js', 'vendor/ocr/tesseract-core-simd-lstm.wasm.js',
  'vendor/ocr/tesseract-core.wasm.js', 'vendor/ocr/tesseract-core-simd.wasm.js', 'vendor/ocr/eng.traineddata.gz'
];
const lazy = new Set(lazyFiles);
const types = {html:'text/html',js:'text/javascript',css:'text/css',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png',woff2:'font/woff2',gz:'application/gzip'};
const index = await readFile('dist/index.html','utf8');
const assets = await Promise.all([...files,...lazyFiles].map(async file => {
  const query = index.match(new RegExp(file.replaceAll('.', '\\.')+'(\\?[^"\\s]+)'))?.[1] || '';
  return {url:'/'+file,query,type:types[file.split('.').at(-1)],sha256:createHash('sha256').update(await readFile('dist/'+file)).digest('hex'),...(lazy.has(file)?{lazy:true}:{})};
}));
const template = await readFile('scripts/pwa-worker.template.js','utf8');
const version = createHash('sha256').update(JSON.stringify(assets)).update(template).digest('hex').slice(0,16);
await writeFile('dist/sw.js',template.replace('__PWA_ASSETS__',JSON.stringify(assets)).replace('__PWA_VERSION__',version));
