import {build} from 'esbuild';
import {readFile, writeFile} from 'node:fs/promises';
const out = await build({entryPoints: ['artifact/src/main.js'], bundle: true, format: 'iife', write: false, target: 'es2022', minify: false, legalComments: 'none'});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await readFile('artifact/src/app.css', 'utf8');
const html = `<title>Cam’s Life</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@500;600;700&family=Figtree:wght@400;500;600;700&display=swap">
<style>${css}</style>
<div id="app" class="app" role="application" aria-label="Cam’s Life"></div>
<script>${js}</script>
`;
await writeFile('artifact/cams-life.html', html);
console.log('artifact/cams-life.html', (html.length / 1024).toFixed(0) + ' KB');
