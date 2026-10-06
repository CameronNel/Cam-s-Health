import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Explicit public code/assets only. Never add health JSON, mailbox data or photos.
const files = ['index.html','studio.js','pwa.js','chatgpt-link.js','studio.css','life.css','life-ui.js','life-model.js',
  'health-intelligence.js','ai-checkin.js','model.js','body.js','sync.js','manifest.webmanifest','favicon.svg',
  'icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png'];
const types = {html:'text/html',js:'text/javascript',css:'text/css',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png'};
const index = await readFile('dist/index.html','utf8');
const assets = await Promise.all(files.map(async file => {
  const query = index.match(new RegExp(file.replaceAll('.', '\\.')+'(\\?[^"\\s]+)'))?.[1] || '';
  return {url:'/'+file,query,type:types[file.split('.').at(-1)],sha256:createHash('sha256').update(await readFile('dist/'+file)).digest('hex')};
}));
const template = await readFile('scripts/pwa-worker.template.js','utf8');
const version = createHash('sha256').update(JSON.stringify(assets)).update(template).digest('hex').slice(0,16);
await writeFile('dist/sw.js',template.replace('__PWA_ASSETS__',JSON.stringify(assets)).replace('__PWA_VERSION__',version));
