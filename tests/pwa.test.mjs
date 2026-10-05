import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeChatGPTLink,readChatGPTLink,saveChatGPTLink} from '../dist/chatgpt-link.js';

const sw=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
function worker(fetcher=async()=>new Response('asset',{headers:{'content-type':'text/javascript'}})) {
  const events={},saved=new Map(),calls=[];
  const key=req=>typeof req==='string'?req:req.url;
  const cache={async put(req,response){saved.set(key(req),response);},async match(req){return saved.get(key(req));}};
  const self={location:{origin:'https://example.test'},addEventListener:(name,fn)=>events[name]=fn,skipWaiting(){calls.push('skipWaiting');}};
  const caches={async open(name){calls.push(name);return cache;},async keys(){return [];},async delete(){}};
  vm.runInNewContext(sw,{self,caches,fetch:fetcher,URL,Error});
  return {saved,calls,events,async fetch(path,options={}) {
    let promise=null;
    const headers=new Headers(options.headers||{});
    const request={url:new URL(path,'https://example.test').href,method:options.method||'GET',mode:options.mode||'cors',headers};
    events.fetch({request,respondWith(value){promise=value;}});
    return promise?{handled:true,response:await promise}:{handled:false};
  }};
}

test('manifest uses standalone mode and real, correctly sized phone icons',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../dist/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');assert.equal(manifest.name,'Cam’s Life');
  assert.equal(new URL(manifest.start_url,'https://example.test/').pathname,'/');
  for(const icon of manifest.icons){const bytes=await readFile(new URL('../dist/'+icon.src,import.meta.url));assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16)+'x'+bytes.readUInt32BE(20),icon.sizes);}
  assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
});
test('private records, credentials, writes, OAuth and cross-origin requests bypass the service worker',async()=>{
  const w=worker();
  for(const [path,options] of [['/api/life',{}],['/api/inbox/sync',{method:'POST'}],['/data/health.json',{}],['https://api.github.com/user',{}],['https://raw.githubusercontent.com/CameronNel/Cam-s-Health/main/dist/data/health.json',{}],['/signin-with-chatgpt',{mode:'navigate'}],['/callback',{mode:'navigate'}],['/studio.js',{headers:{Authorization:'Bearer test-only'}}],['/studio.js?token=test-only',{}]])assert.equal((await w.fetch(path,options)).handled,false,path);
  assert.equal(w.calls.length,0);assert.equal(w.saved.size,0);
});
test('assets are network-first and HTTP errors/redirects/wrong content are never cached',async()=>{
  for(const status of [401,403,404,500]){const w=worker(async()=>new Response('error',{status}));const r=await w.fetch('/studio.js?v=5');assert.equal(r.response.status,status);assert.equal(w.saved.size,0);}
  const redirected=worker(async()=>({ok:true,redirected:true,type:'basic',headers:new Headers({'content-type':'text/javascript'})}));await redirected.fetch('/studio.js');assert.equal(redirected.saved.size,0);
  const login=worker(async()=>new Response('<html>Sign in</html>',{headers:{'content-type':'text/html'}}));await login.fetch('/studio.js');assert.equal(login.saved.size,0);
  const valid=worker();await valid.fetch('/studio.js?v=5');assert.ok(valid.saved.has('https://example.test/studio.js?v=5'));assert.ok(!valid.saved.has('https://example.test/studio.js'));
});
test('navigation is never cached and only network failure uses the generic reconnect screen',async()=>{
  const online=worker(async()=>new Response('Sign in',{status:403}));const result=await online.fetch('/?date=2026-10-05',{mode:'navigate'});assert.equal(result.response.status,403);assert.equal(online.saved.size,0);assert.equal(online.calls.length,0);
  const offline=worker(async()=>{throw Error('offline');});offline.saved.set('/offline.html',new Response('Reconnect'));const fallback=await offline.fetch('/?installed=1',{mode:'navigate'});assert.equal(await fallback.response.text(),'Reconnect');assert.ok(!sw.includes("['/index.html'"));
});
test('offline asset fallback respects the exact release key and never queues writes',async()=>{
  const w=worker(async()=>{throw Error('offline');});w.saved.set('https://example.test/studio.js?v=5',new Response('cached code'));assert.equal(await (await w.fetch('/studio.js?v=5')).response.text(),'cached code');await assert.rejects(w.fetch('/studio.js?v=6'),/offline/);
  assert.equal((await w.fetch('/api/life',{method:'PUT'})).handled,false);assert.equal(w.calls.includes('skipWaiting'),false);w.events.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(w.calls.includes('skipWaiting'),true);
});
test('saved ChatGPT links stay on ChatGPT, strip queries and never accept credentials or script URLs',()=>{
  assert.equal(normalizeChatGPTLink(''),'https://chatgpt.com/');assert.equal(normalizeChatGPTLink('https://chatgpt.com/c/example-chat?secret=removed#part'),'https://chatgpt.com/c/example-chat');assert.equal(normalizeChatGPTLink('https://chatgpt.com/g/g-p-example/project'),'https://chatgpt.com/g/g-p-example/project');
  for(const url of ['javascript:alert(1)','http://chatgpt.com/c/a','https://chatgpt.com.evil.test/c/a','https://person:secret@chatgpt.com/c/a','https://chatgpt.com/api/auth/session'])assert.throws(()=>normalizeChatGPTLink(url));
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};saveChatGPTLink('https://chatgpt.com/c/example-chat',storage);assert.equal(readChatGPTLink(storage),'https://chatgpt.com/c/example-chat');map.set('cams-life-chatgpt-link','https://evil.test/');assert.equal(readChatGPTLink(storage),'https://chatgpt.com/');
});
test('installation help works without support and does not reload or submit information',async()=>{
  const source=await readFile(new URL('../dist/pwa.js',import.meta.url),'utf8'),events={},sheets=[];
  const context={window:{isSecureContext:true,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(name,fn)=>events[name]=fn},navigator:{},document:{querySelector:()=>({open:false})},location:{reload(){throw Error('unexpected reload');}}};
  vm.runInNewContext(source.replace('export function','function')+';globalThis.make=createPWA;',context);
  const pwa=context.make({openSheet:(...args)=>sheets.push(args),toast(){},render(){}});assert.match(pwa.card(),/Add to home screen/);assert.equal(await pwa.action('anything'),false);assert.equal(await pwa.action('install-app'),true);assert.match(sheets[0][1],/Android/);assert.match(sheets[0][1],/Safari/);
});
