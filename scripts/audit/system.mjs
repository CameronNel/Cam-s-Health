/** Shared status, error, authorization and update screens. All records are synthetic. */
import fs from 'node:fs/promises';
import {createAudit,makeFixture,PROFILES,act,closeSheet} from './harness.mjs';
const a=await createAudit('system',{fixture:makeFixture('rich'),out:process.env.AUDIT_SYSTEM_OUT||'/workspace/cams-health-layout-audit/system-final'});const {page,context}=a;
await context.addInitScript(()=>{
 const nativeTimeout=AbortSignal.timeout.bind(AbortSignal);AbortSignal.timeout=ms=>window.__auditHoldRequestTimeout?new AbortController().signal:nativeTimeout(ms);
 const mode=localStorage.getItem('audit-pwa-mode')||'current';
 Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>localStorage.getItem('audit-offline')!=='yes'});
 if(mode==='unsupported'){delete Object.getPrototypeOf(navigator).serviceWorker;return;}
 if(mode==='insecure')Object.defineProperty(window,'isSecureContext',{value:false,configurable:true});
 const service=new EventTarget(),registration=new EventTarget(),waiting=new EventTarget();
 waiting.state='installed';waiting.postMessage=()=>{window.__auditUpdateApplied=true;};
 registration.active={state:'activated'};registration.waiting=['available','applying'].includes(mode)?waiting:null;registration.installing=null;
 registration.update=async()=>{if(mode==='error')throw Error('Synthetic update download failure.');if(mode==='checking')await new Promise(resolve=>window.__auditFinishUpdate=resolve);};
 service.register=async()=>{if(mode==='registration-error')throw Error('Synthetic registration failure.');return registration;};
 Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:service});window.__auditUpdateRegistration=registration;
});
async function config(key,value){await page.evaluate(([key,value])=>value===null?localStorage.removeItem(key):localStorage.setItem(key,value),[key,value]);}
async function fresh(){await a.boot();await closeSheet(page);}
async function capture(id,open,{modes=['popup','full'],...rest}={}){await a.check(id,async()=>{await fresh();await open();await a.screen(id,{modes,captureMaxPages:2,...rest});});}
async function foodDraft(){await act(page,'food-log');await page.locator('[name=name]').fill('Synthetic test lunch');await page.locator('[name=quantity]').fill('100 g reviewed portion');await page.locator('[name=kcal]').fill('150');}
async function connectInline(){await page.locator('.inline-connect').evaluate(e=>e.open=true);await page.locator('[name=githubToken]').fill('synthetic-layout-token-not-real');}
async function save(){await page.locator('form button[type=submit]').click({force:true});}
const assert=(ok,message)=>{if(!ok)throw Error(message);};
if(process.env.AUDIT_SYSTEM_REPAIR==='1'){const originalScreen=a.screen;const affected=new Set(['sync-source-error','food-save-authorization-required','food-save-conflict','food-save-in-progress','undo-dock-saved','undo-conflict-explanation','discard-confirmation','settings-update-current','update-reload-confirmation','rest-timer-finished','brief-incomplete-food']);a.screen=(id,options={})=>originalScreen(id,{...options,capture:affected.has(id),captureMaxPages:2,meta:{...options.meta,repairProof:affected.has(id)}});}
if(process.env.AUDIT_SYSTEM_RESUME){const previous=JSON.parse(await fs.readFile(a.out+'/cases.json','utf8'));await fs.writeFile(a.out+'/interrupted-prefix-'+process.env.AUDIT_SYSTEM_RESUME+'.json',JSON.stringify(previous,null,2));a.cases.push(...previous.cases.filter(c=>process.env.AUDIT_SYSTEM_RESUME!=='1'||c.id!=='food-save-in-progress'));a.checks.push(...previous.checks.filter(c=>c.pass));}
try{
 await a.boot();
 if(!process.env.AUDIT_SYSTEM_RESUME){
 // Loading, no-data and invalid-source states use real store paths.
 let release;const gate=new Promise(resolve=>release=resolve);const delay=async r=>{await gate;return r.fallback();};
 await context.route('**/dist/data/health.json*',delay);await page.goto('http://127.0.0.1:5173/?date=2026-10-15');await page.locator('.boot').waitFor();await a.screen('boot-loading',{modes:['page']});release();await context.unroute('**/dist/data/health.json*',delay);await page.locator('.health-widget').first().waitFor();
 const fail=async r=>r.fulfill({status:503,body:'Synthetic source unavailable'});await context.route('**/dist/data/health.json*',fail);await context.route('**/contents/dist/data/health.json*',fail);await context.route('**/data/health.json',fail);
 await page.evaluate(()=>localStorage.removeItem('cams-health-cache'));await a.boot({expectWidgets:false});await page.locator('.boot button').waitFor();await a.screen('boot-no-usable-data',{modes:['page']});
 await page.evaluate(data=>localStorage.setItem('cams-health-cache',JSON.stringify({data,at:'2026-10-14T09:00:00Z'})),makeFixture('rich'));await a.boot();await a.screen('home-saved-copy-source-error',{modes:['page']});await act(page,'sync-info');await a.screen('sync-source-error');
 await context.unroute('**/dist/data/health.json*',fail);await context.unroute('**/contents/dist/data/health.json*',fail);await context.unroute('**/data/health.json',fail);
 const schema=async r=>r.fulfill({json:{schemaVersion:1,days:{}}});await context.route('**/dist/data/health.json*',schema);await a.boot();await a.screen('home-invalid-schema-saved-copy',{modes:['page']});await context.unroute('**/dist/data/health.json*',schema);
 await capture('food-save-authorization-required',async()=>{await foodDraft();await save();assert(await page.locator('#form-error').innerText(),'Missing connection explanation');});
 await capture('food-save-authorization-rejected',async()=>{a.setAuthFailure(true);await foodDraft();await connectInline();await save();await page.locator('#form-error').filter({hasText:'rejected'}).waitFor();a.setAuthFailure(false);});
 await capture('food-save-offline',async()=>{await foodDraft();await connectInline();await config('audit-offline','yes');await save();await page.locator('#form-error').filter({hasText:'Offline'}).waitFor();await config('audit-offline',null);});
 await capture('food-save-conflict',async()=>{a.setSaveFailure({status:409});await foodDraft();await connectInline();await save();await page.locator('#form-error').filter({hasText:'Nothing was overwritten'}).waitFor();a.setSaveFailure(null);});
 await capture('food-save-service-error',async()=>{a.setSaveFailure({status:503});await foodDraft();await connectInline();await save();await page.locator('#form-error').filter({hasText:'503'}).waitFor();a.setSaveFailure(null);});
 const badRead=async r=>{const u=new URL(r.request().url());if(u.searchParams.get('ref')?.startsWith('audit-commit-'))return r.fulfill({json:{sha:'incomplete'}});return r.fallback();};
 await context.route('**/contents/dist/data/health.json*',badRead);await capture('food-save-readback-unconfirmed',async()=>{await foodDraft();await connectInline();await save();await page.locator('#form-error').filter({hasText:'could not be confirmed'}).waitFor();});await context.unroute('**/contents/dist/data/health.json*',badRead);
 }
 if(process.env.AUDIT_SYSTEM_RESUME!=='tail'){
 // Busy completion and back/close must not lose an active form.
 await fresh();await foodDraft();await connectInline();await page.evaluate(()=>window.__auditHoldRequestTimeout=true);let resolvePut;const putGate=new Promise(r=>resolvePut=r);const slowPut=async r=>{if(r.request().method()==='PUT')await putGate;return r.fallback();};await context.route('**/contents/dist/data/health.json*',slowPut);await save();await page.locator('form[aria-busy=true]').waitFor();await a.screen('food-save-in-progress',{captureMaxPages:2,meta:{requestTimeoutHeldForDeterministicBusyCapture:true}});await a.check('Every captured busy profile preserves the active save',async()=>assert(await page.locator('form[aria-busy=true]').count(),'Synthetic save stopped before capture finished'));await act(page,'close-sheet');assert(await page.locator('#sheet').evaluate(e=>e.open),'Closed a save in progress');resolvePut();await page.waitForFunction(()=>!document.querySelector('#sheet').open);await context.unroute('**/contents/dist/data/health.json*',slowPut);await page.evaluate(()=>window.__auditHoldRequestTimeout=false);await a.screen('undo-dock-saved',{modes:['page']});
 const latest=a.remote.days['2026-10-15'].food.at(-1),changed=structuredClone(a.remote);changed.days['2026-10-15'].food.find(f=>f.id===latest.id).name='Concurrent edit by another client';a.setRemote(changed);await act(page,'undo-save');await page.locator('#toast.show').waitFor();await a.screen('undo-conflict-explanation',{modes:['page']});await act(page,'dismiss-undo');
 await capture('discard-confirmation',async()=>{await foodDraft();await act(page,'close-sheet');await page.locator('.discard-confirm:not([hidden])').waitFor();});
 for(const state of ['current','available','error','registration-error','unsupported','insecure','checking']){
  await config('audit-pwa-mode',state);await fresh();await act(page,'settings');
  if(['checking','error','available','current'].includes(state))await page.locator('[data-life=check-updates]').click({force:true});
  if(state==='checking')await page.waitForTimeout(30);else await page.waitForTimeout(90);
  await a.screen('settings-update-'+state);
  if(state==='checking')await page.evaluate(()=>window.__auditFinishUpdate?.());
 }
 await config('audit-pwa-mode','available');await capture('update-reload-confirmation',async()=>{await act(page,'settings');await page.locator('[data-life=app-update]').click({force:true});});
 for(const state of ['current','available','error','registration-error','unsupported','insecure','checking','applying','offline']){
  await config('audit-pwa-mode',state==='offline'?'current':state);await config('audit-offline',state==='offline'?'yes':null);await page.goto('http://127.0.0.1:5173/update.html');await page.locator('#check').click();
  if(state==='applying'){await page.locator('#review:not([hidden])').waitFor();await page.locator('#apply').click();}else await page.waitForTimeout(50);
  await a.screen('update-page-'+state,{modes:['page']});
  if(state==='checking')await page.evaluate(()=>window.__auditFinishUpdate?.());
 }
 await config('audit-offline',null);await config('audit-pwa-mode',null);
 // Native install event is mocked at the API boundary; app-owned entry is real.
 await fresh();await page.evaluate(()=>{const e=new Event('beforeinstallprompt');e.prompt=async()=>{};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});await act(page,'settings');await a.screen('install-prompt-available');await page.locator('[data-life=install-app]').click({force:true});await a.screen('install-prompt-dismissed');
 }
 await fresh();await act(page,'timer');await page.evaluate(()=>{const button=document.createElement('button');button.dataset.seconds='1';document.body.append(button);button.click();button.remove();});await a.check('Rest timer completes and hides its dock',async()=>{await page.waitForFunction(()=>document.querySelector('#timer-dock').hidden,null,{timeout:10000});assert((await page.locator('#timer-display').innerText())==='0:00','Rest timer completion display is wrong');});await a.screen('rest-timer-finished');
 const fixture=makeFixture('rich');a.setRemote(fixture);await fresh();await act(page,'brief');await a.screen('brief-incomplete-food');
 a.setRemote(makeFixture('empty'));await fresh();await act(page,'brief');await a.screen('brief-empty-food');
 await a.check('Audit uses only intercepted writes and no token storage',async()=>{assert(!await page.evaluate(()=>JSON.stringify(localStorage).includes('synthetic-layout-token-not-real')),'Credential found in storage');assert(a.errors.length===0,a.errors.join(';'));});
}finally{console.log(await a.finish());}
// JavaScript-disabled recovery is an app-owned screen too.
if(process.env.AUDIT_SKIP_NOSCRIPT!=='1'){
const nojs=await createAudit('noscript',{theme:'dark',out:process.env.AUDIT_NOSCRIPT_OUT||'/workspace/cams-health-layout-audit/noscript-final',contextOptions:{javaScriptEnabled:false}});
try{for(const pageName of ['index.html','update.html']){await nojs.page.goto('http://127.0.0.1:5173/'+pageName);await nojs.screen('noscript-'+pageName,{modes:['page'],capture:process.env.AUDIT_SYSTEM_REPAIR!=='1'});}}finally{console.log(await nojs.finish());}
}
