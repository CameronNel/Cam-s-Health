import {build} from 'esbuild';
import {mkdir,readFile,writeFile,readdir,copyFile,cp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
await import('./build-pwa.mjs');
const out=resolve('.sites-runtime/build');
await rm(out,{recursive:true,force:true});
await mkdir(out+'/dist/server',{recursive:true});
await mkdir(out+'/dist/client',{recursive:true});
await mkdir(out+'/.openai',{recursive:true});
for(const item of await readdir('dist',{withFileTypes:true}))if(!['server','client','.openai'].includes(item.name))await cp('dist/'+item.name,out+'/dist/client/'+item.name,{recursive:true});
await build({entryPoints:['server/worker.mjs'],outfile:out+'/dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:false});
const manifest=JSON.parse(await readFile('.openai/hosting.json','utf8'));
await writeFile(out+'/.openai/hosting.json',JSON.stringify(manifest,null,2)+'\n');
await mkdir(out+'/dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json',out+'/dist/.openai/hosting.json');
await cp('drizzle',out+'/drizzle',{recursive:true});
await writeFile(out+'/dist/server/wrangler.json',JSON.stringify({name:'cams-life',main:'index.js',compatibility_date:'2026-10-01',assets:{directory:'../client',binding:'ASSETS',run_worker_first:['/api/*','/','/index.html','/sw.js']},d1_databases:[{binding:'LIFE_DB',database_name:'cams-life',migrations_dir:'../../drizzle'}]},null,2)+'\n');
// Mirror standard build paths for the Sites source packager; never recurse into them.
for(const name of ['server','client']){
  await rm(resolve('dist',name),{recursive:true,force:true});
  await cp(out+'/dist/'+name,resolve('dist',name),{recursive:true});
}
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built Cam’s Life: Worker, static client, and schema migrations.');
