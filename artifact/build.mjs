import {build} from 'esbuild';
import {readFile, writeFile} from 'node:fs/promises';
const out = await build({entryPoints: ['artifact/src/old/main.js'], bundle: true, format: 'iife', write: false, target: 'es2022', minify: true, legalComments: 'none'});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = (await readFile('artifact/src/old/studio.css', 'utf8')) + '\n' + (await readFile('artifact/src/old/life.css', 'utf8'));
const html = `<title>Cam’s Life</title>
<style>:root{color-scheme:dark}html,body{background:#111a15;color:#efe9d7}</style>
<style>${css}</style>
<a class="skip-link" href="#main">Skip to content</a>
<div id="app"></div>
<dialog id="sheet"></dialog>
<aside class="timer-dock" id="timer-dock" aria-label="Rest timer" hidden></aside>
<div id="toast" role="status" aria-live="polite"></div>
<script>${js}</script>
`;
await writeFile('artifact/cams-life.html', html);
console.log('artifact/cams-life.html', (html.length / 1024 / 1024).toFixed(2) + ' MB');
