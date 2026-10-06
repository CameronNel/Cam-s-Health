import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createWorker} from '../server/worker.mjs';

const ORIGIN='https://cams-life.example';
const source=readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');
const pwaSource=readFileSync(new URL('../dist/pwa.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const types={html:'text/html',js:'text/javascript',css:'text/css',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png'};
function harness(mode='normal') {
  const handlers={},stores=new Map(),deleted=[];let skipped=0;
  const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return {async put(key,value){map.set(key,value);},async match(key){return map.get(key)?.clone();}};},async delete(name){deleted.push(name);return stores.delete(name);},async keys(){return [...stores.keys()];}};
  const self={location:{origin:ORIGIN},clients:{async claim(){}},async skipWaiting(){skipped++;},addEventListener(name,fn){handlers[name]=fn;}};
  const fetcher=async request=>{
    const url=new URL(typeof request==='string'?request:request.url,ORIGIN);
    if(mode==='offline')throw TypeError('Offline');
    if(mode==='login')return new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}});
    if(mode==='forbidden')return new Response('Access denied',{status:403});
    if(mode==='redirect'){const response=new Response('Sign in',{headers:{'Content-Type':'text/html'}});Object.defineProperty(response,'redirected',{value:true});return response;}
    if(mode==='new-shell'&&['/','/index.html'].includes(url.pathname))return new Response('<html>New revision</html>',{headers:{'Content-Type':'text/html','X-Cams-Life-Shell':'1','Content-Security-Policy':"frame-ancestors 'none'",'Referrer-Policy':'no-referrer','Set-Cookie':'synthetic-new-secret'}});
    const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(mode==='poison'&&path==='studio.js')return new Response('Sign in',{headers:{'Content-Type':'text/javascript'}});
    return new Response(readFileSync(new URL('../dist/'+path,import.meta.url)),{headers:{'Content-Type':types[path.split('.').at(-1)],'Set-Cookie':'synthetic-secret','X-User-Identity':'synthetic-owner','Cache-Control':'private, no-store','X-Frame-Options':'DENY'}});
  };
  vm.runInNewContext(source,{self,caches,fetch:fetcher,crypto:webcrypto,URL,Map,Headers,Response,Uint8Array});
  const lifecycle=async name=>{let job;handlers[name]({waitUntil(value){job=value;}});await job;};
  const dispatch=async(path,{method='GET',navigate=false,authorization=false}={})=>{
    let result;handlers.fetch({request:{url:new URL(path,ORIGIN).href,method,mode:navigate?'navigate':'cors',headers:new Headers(authorization?{Authorization:'synthetic-token'}:{})},respondWith(value){result=value;}});return result?await result:null;
  };
  return {stores,deleted,handlers,lifecycle,dispatch,setMode(value){mode=value;},get skipped(){return skipped;}};
}
test('PWA caches only verified public files and strips gateway identity headers',async()=>{
  const sw=harness();await sw.lifecycle('install');
  const cache=[...sw.stores.values()][0];assert.equal(cache.size,18);
  for(const [path,response] of cache){assert.ok(!/api|health\.json|photo|callback|auth/.test(path));assert.equal(response.headers.has('Set-Cookie'),false);assert.equal(response.headers.has('X-User-Identity'),false);assert.equal(response.headers.has('Cache-Control'),false);}
  assert.equal(await cache.get('/index.html').clone().text(),index);
  assert.equal(cache.get('/index.html').headers.get('X-Frame-Options'),'DENY');
  assert.equal(cache.get('/index.html').headers.get('X-Content-Type-Options'),'nosniff');
});
test('a poisoned or changed asset aborts installation without removing the previous release',async()=>{
  const sw=harness('poison');sw.stores.set('cams-life-shell-previous',new Map());sw.stores.set('unrelated-cache',new Map());
  await assert.rejects(sw.lifecycle('install'),/changed/);
  assert.deepEqual([...sw.stores.keys()],['cams-life-shell-previous','unrelated-cache']);
});
test('offline reloads retain the shell but dynamic/private routes and writes are never intercepted',async()=>{
  const sw=harness();await sw.lifecycle('install');sw.setMode('offline');
  assert.equal(await(await sw.dispatch('/?date=2026-10-04',{navigate:true})).text(),index);
  for(const path of ['/update.html','/api/life','/api/ai/setup','/api/assistant','/api/inbox/callback?code=synthetic','/data/health.json','/login','https://api.github.com/user','/studio.js?token=synthetic'])assert.equal(await sw.dispatch(path),null,path);
  assert.equal(await sw.dispatch('/update.html',{navigate:true}),null);
  assert.equal(await sw.dispatch('/api/life',{method:'PUT'}),null);
  assert.equal(await sw.dispatch('/studio.js',{authorization:true}),null);
});
test('online login, redirects and permission failures pass through instead of using an offline shell',async()=>{
  const sw=harness();await sw.lifecycle('install');
  for(const mode of ['login','forbidden','redirect']){sw.setMode(mode);const response=await sw.dispatch('/',{navigate:true});assert.notEqual(await response.text(),index);if(mode==='forbidden')assert.equal(response.status,403);if(mode==='redirect')assert.equal(response.redirected,true);}
});
test('authorized navigation during an update keeps a coherent old shell until activation',async()=>{
  const sw=harness();await sw.lifecycle('install');sw.setMode('new-shell');
  const shell=await sw.dispatch('/',{navigate:true});
  assert.equal(await shell.text(),index);
  assert.equal(shell.headers.get('Content-Security-Policy'),"frame-ancestors 'none'");
  assert.equal(shell.headers.get('Referrer-Policy'),'no-referrer');
  assert.equal(shell.headers.has('Set-Cookie'),false);
  assert.equal(await(await sw.dispatch('/studio.js?v=6')).text(),readFileSync(new URL('../dist/studio.js',import.meta.url),'utf8'));
});
test('activation removes only previous app caches and updates require an explicit message',async()=>{
  const sw=harness();await sw.lifecycle('install');sw.stores.set('cams-life-shell-old',new Map());sw.stores.set('other-app',new Map());await sw.lifecycle('activate');
  assert.ok(sw.stores.has('other-app'));assert.ok(!sw.stores.has('cams-life-shell-old'));assert.equal(sw.skipped,0);
  let job;sw.handlers.message({data:{type:'ACTIVATE_UPDATE'},waitUntil(value){job=value;}});await job;assert.equal(sw.skipped,1);
});
test('Worker marks only successful app HTML and sends service worker update headers',async()=>{
  const worker=createWorker();
  const asset=(body,status=200,type='text/html')=>({ASSETS:{async fetch(){return new Response(body,{status,headers:{'Content-Type':type}});}}});
  assert.equal((await worker.fetch(new Request(ORIGIN+'/'),asset(index))).headers.get('X-Cams-Life-Shell'),'1');
  assert.equal((await worker.fetch(new Request(ORIGIN+'/'),asset('Forbidden',403))).headers.has('X-Cams-Life-Shell'),false);
  assert.equal((await worker.fetch(new Request(ORIGIN+'/manifest.webmanifest'),asset('{}',200,'application/manifest+json'))).headers.has('X-Cams-Life-Shell'),false);
  const sw=await worker.fetch(new Request(ORIGIN+'/sw.js'),asset(source,200,'text/javascript'));
  assert.equal(sw.headers.get('Service-Worker-Allowed'),'/');assert.equal(sw.headers.get('Cache-Control'),'no-cache');
  const recovery=await worker.fetch(new Request(ORIGIN+'/update.html'),asset('<html>Update recovery</html>'));
  assert.equal(recovery.headers.get('Cache-Control'),'no-store');
  assert.equal(recovery.headers.has('X-Cams-Life-Shell'),false);
});

function appUpdateHarness() {
  const document=Object.assign(new EventTarget(),{readyState:'complete',visibilityState:'visible'});
  const window=Object.assign(new EventTarget(),{isSecureContext:true});
  const media=Object.assign(new EventTarget(),{matches:true});
  const serviceWorker=new EventTarget(),messages=[];
  let reloads=0,updates=0,update=async()=>{};
  const registration=Object.assign(new EventTarget(),{
    active:{state:'activated'},waiting:null,installing:null,
    async update(){updates++;return update();},
  });
  serviceWorker.register=async()=>registration;
  const navigator={serviceWorker,onLine:true};
  const context={document,window,navigator,matchMedia:()=>media,location:{reload(){reloads++;}},setTimeout,clearTimeout};
  vm.runInNewContext(pwaSource.replace('export function','function')+'\nthis.createPWA=createPWA;',context);
  const pwa=context.createPWA();
  const worker=state=>Object.assign(new EventTarget(),{state,postMessage(message){messages.push(message);}});
  return {pwa,registration,navigator,document,serviceWorker,messages,worker,setUpdate(fn){update=fn;},get updates(){return updates;},get reloads(){return reloads;}};
}
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));

test('manual update checks wait for a verified install, preserve the running app and require reviewed activation',async()=>{
  const h=appUpdateHarness();await nextTurn();
  const worker=h.worker('installing');
  h.setUpdate(async()=>{h.registration.installing=worker;h.registration.dispatchEvent(new Event('updatefound'));});
  const check=h.pwa.checkForUpdates();await nextTurn();
  assert.equal(h.pwa.state.checkingUpdate,true);
  assert.equal(h.pwa.state.updateChecked,false);
  assert.equal(h.pwa.state.updateAvailable,false);
  assert.equal(h.pwa.checkForUpdates(),check);
  assert.equal(h.updates,1);
  h.registration.installing=null;h.registration.waiting=worker;worker.state='installed';worker.dispatchEvent(new Event('statechange'));
  assert.equal(await check,true);
  assert.equal(h.pwa.state.checkingUpdate,false);
  assert.equal(h.pwa.state.updateChecked,true);
  assert.equal(h.pwa.state.updateAvailable,true);
  assert.deepEqual(h.messages,[]);assert.equal(h.reloads,0);
  await h.pwa.activateUpdate();
  assert.equal(h.messages.length,1);assert.equal(h.messages[0].type,'ACTIVATE_UPDATE');
  assert.equal(h.reloads,0);
  h.serviceWorker.dispatchEvent(new Event('controllerchange'));
  assert.equal(h.reloads,1);
});

test('update failures and offline checks show safe errors and never claim the app is current',async()=>{
  const h=appUpdateHarness();await nextTurn();
  h.setUpdate(async()=>{throw Error('synthetic-private-browser-error');});
  await assert.rejects(h.pwa.checkForUpdates(),/could not be checked/);
  assert.equal(h.pwa.state.error.includes('synthetic-private-browser-error'),false);
  assert.equal(h.pwa.state.checkingUpdate,false);assert.equal(h.pwa.state.updateChecked,false);
  assert.equal(h.pwa.state.ready,true);assert.deepEqual(h.messages,[]);assert.equal(h.reloads,0);
  h.navigator.onLine=false;
  await assert.rejects(h.pwa.checkForUpdates(),/Reconnect before checking/);
  assert.equal(h.updates,1);
  h.navigator.onLine=true;h.setUpdate(async()=>{});
  assert.equal(await h.pwa.checkForUpdates(),false);
  assert.equal(h.updates,2);assert.equal(h.pwa.state.updateChecked,true);assert.equal(h.pwa.state.error,'');
});

test('a failed update install leaves the previous app available and allows a fresh check',async()=>{
  const h=appUpdateHarness();await nextTurn();
  const worker=h.worker('installing');
  h.setUpdate(async()=>{h.registration.installing=worker;h.registration.dispatchEvent(new Event('updatefound'));});
  const check=h.pwa.checkForUpdates();await nextTurn();
  h.registration.installing=null;worker.state='redundant';worker.dispatchEvent(new Event('statechange'));
  await assert.rejects(check,/could not be checked/);
  assert.equal(h.pwa.state.ready,true);assert.equal(h.pwa.state.updateChecked,false);
  assert.deepEqual(h.messages,[]);assert.equal(h.reloads,0);
  h.setUpdate(async()=>{});await h.pwa.checkForUpdates();
  assert.equal(h.pwa.state.updateChecked,true);assert.equal(h.pwa.state.error,'');
});
