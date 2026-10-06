import http from 'node:http';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {resolve,extname,sep} from 'node:path';
import worker from '../server/worker.mjs';

// Local development only. This server binds loopback and never deploys a mock identity.
const root=resolve('dist'),port=Number(process.argv[process.argv.indexOf('--port')+1])||5173;
await mkdir('.sites-runtime',{recursive:true});
const sqlite=new DatabaseSync('.sites-runtime/life-dev.sqlite');
sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()){
 if(!sqlite.prepare('SELECT name FROM local_migrations WHERE name = ?').get(name)){sqlite.exec(await readFile('drizzle/'+name,'utf8'));sqlite.prepare('INSERT INTO local_migrations(name) VALUES (?)').run(name);}
}
function statement(sql){let values=[];const s={bind(...args){values=args;return s;},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){const result=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes)}};}};return s;}
const db={prepare:statement,async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png'};
http.createServer(async(req,res)=>{try{
 const url='http://127.0.0.1:'+port+req.url;
 if(new URL(url).pathname.startsWith('/api/')){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-preview');
  const request=new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
  const response=await worker.fetch(request,{LIFE_DB:db},{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 const path=resolve(root,'.'+decodeURIComponent(new URL(url).pathname));
 if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 const file=path===root?root+'/index.html':path;res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');if(file===root+'/index.html')res.setHeader('X-Cams-Life-Shell','1');if(extname(file)==='.js')res.setHeader('Service-Worker-Allowed','/');res.end(await readFile(file));
}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log('Local Cam’s Life preview: http://127.0.0.1:'+port));
