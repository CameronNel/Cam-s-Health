import {build} from 'esbuild';
import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
await build({stdin:{contents:"export * from 'three';",resolveDir:process.cwd(),sourcefile:'three-public-entry.js'},bundle:true,format:'esm',minify:true,outfile:'dist/vendor/three.js',legalComments:'inline',target:'es2022'});
await copyFile('node_modules/three/LICENSE','dist/vendor/three.LICENSE.txt');
