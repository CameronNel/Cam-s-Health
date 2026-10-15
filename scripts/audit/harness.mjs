// Reusable integrated browser audit. GitHub writes are intercepted and validated.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateLifeHealth} from '../../dist/health-intelligence.js';
import {BODY_FIELDS} from '../../dist/body.js';
import {makeRecipeVersion,commitRecipeVersion} from '../../dist/food-studio-model.js';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const original=JSON.parse(await fs.readFile(path.join(ROOT,'dist/data/health.json'),'utf8'));
export const AUDIT_DATE='2026-10-15';
export const PROFILES=[
 {id:'oppo',width:424,height:924,dpr:3,description:'Derived CSS424×924@3; official native1272×2772'},
 {id:'oppo-browser',width:424,height:804,dpr:3,description:'Simulated browser bars reduce available height'},
 {id:'oppo-landscape',width:924,height:424,dpr:3,description:'Exact official panel aspect, landscape'},
 {id:'oppo-keyboard',width:424,height:500,dpr:3,keyboard:true,description:'Simulated keyboard-reduced viewport'},
 {id:'oppo-text-200',width:424,height:924,dpr:3,textScale:2,description:'Every computed font and line height doubled'},
 {id:'oppo-density-360',width:360,height:785,dpr:3,description:'Alternate Android density sensitivity; rounded panel aspect'},
 {id:'small320',width:320,height:568,dpr:2,description:'Small phone stress case'},
 {id:'tablet',width:768,height:1024,dpr:1},
 {id:'desktop',width:1440,height:900,dpr:1}
];
export function makeFixture(mode='rich'){
 const data=structuredClone(original);data.profile={name:'Layout Audit',timezone:'Europe/Amsterdam',heightCm:180,targets:{kcal:2400,protein:160,carbs:260,fat:75},trainingStatus:'ready',trainingNote:'Synthetic audit profile. No real training clearance is implied.',equipment:['dumbbells','bench','cable']};data.training.notes=['Synthetic audit program note. '.repeat(12)];delete data.provenance;data.updatedAt='2026-10-15T09:00:00Z';data.days={};data.recipes=[];delete data.tracker;
 if(mode==='empty'){validateLifeHealth(data);return data;}
 for(let i=0;i<42;i++){
  if(i%9===3)continue;const date=new Date(Date.UTC(2026,9,15-i)).toISOString().slice(0,10);
  const food=Array.from({length:i===0?8:2},(_,j)=>({id:`audit-food-${i}-${j}`,name:j===0?'Slow-roasted vegetable, chickpea and brown-rice bowl with lemon tahini dressing':`Synthetic meal ${j+1}`,quantity:'150 g cooked portion, reviewed from the package label',kcal:j===1?null:320+j*40,protein:j===1?null:22,carbs:40,fat:8,estimated:j%2===0,source:'Synthetic audit fixture — never a real health log',note:'Long preparation and source notes. '.repeat(12),meal:['breakfast','lunch','dinner','snacks'][j%4],reviewRequired:j===1}));
  data.days[date]={food,workouts:[],steps:null,waterMl:null,weightKg:81+i*.08,notes:'Synthetic audit only.',foodLogComplete:i%3===0,body:{bodyFatPct:18+i*.03,skeletalMuscleKg:33,method:i%5===0?'DEXA':'BIA scale',measurementsCm:Object.fromEntries(BODY_FIELDS.map(([key],k)=>[key,32+k*3+i*.02])),notes:'Measured in the morning. '.repeat(12),recordedAt:date+'T07:30:00Z'}};
  if(i%3===0){const session=data.training.sessions.find(s=>s.id===data.training.rotation[i%data.training.rotation.length]&&s.exercises.length)||data.training.sessions.find(s=>s.exercises.length);data.days[date].workouts.push({id:`audit-workout-${i}`,sessionId:session.id,name:session.name,status:i%2?'completed':'partial',durationMin:65,notes:'Synthetic performance notes. '.repeat(12),actualExercises:session.exercises.slice(0,3).map((e,k)=>({name:e.name,originalName:e.name,sets:3,reps:10,load:24,measure:/sec/i.test(e.reps)?'seconds':'reps',setLog:Array.from({length:3},(_,n)=>({id:`audit-set-${i}-${k}-${n}`,reps:n===2?null:10,load:n===2?null:24,kind:n===0?'warmup':'working',rir:n===1?2:null,rpe:n===0?6:null,completedAt:date+`T08:${String(10+k*5+n).padStart(2,'0')}:00Z`}))}))});}
 }
 const library=[{id:'audit-library-1',name:'Long-name multigrain yoghurt breakfast with blueberries and toasted pumpkin seeds',per100g:{kcal:320,protein:22,carbs:40,fat:8},densityGPerMl:1.03,portions:[{id:'serving',label:'Large household breakfast bowl',grams:175}],source:'Synthetic package label',estimated:false,note:'Synthetic audit only.'},{id:'audit-library-2',name:'Unknown nutrition example',per100g:{kcal:null,protein:null,carbs:null,fat:null},portions:[],source:'Unknown synthetic label',estimated:true}];
 const snapshot={name:library[0].name,quantity:'175g serving',kcal:560,protein:38.5,carbs:70,fat:14,estimated:false,source:'Synthetic audit package',note:'Review before logging.'};
 data.tracker={food:{library,favorites:[{id:'audit-favorite',foodId:library[0].id,amount:1,unit:'serving'}],templates:[{id:'audit-template',name:'Breakfast template with an intentionally descriptive and unusually long title',meal:'breakfast',items:[snapshot,{...snapshot,name:'Second template food'}]}],recipeVersions:[],plannedMeals:{[AUDIT_DATE]:[{id:'audit-plan',name:'A planned dinner with a longer descriptive meal name',meal:'dinner',items:[snapshot]}]},targets:{training:{kcal:2400,protein:160,carbs:260,fat:75},rest:{kcal:2100,protein:160,carbs:190,fat:70}},dayTypes:{[AUDIT_DATE]:'training'},proteinFocus:false},body:{pinned:['weightKg','bodyFatPct','skeletalMuscleKg','waist'],goals:{weightKg:{min:77,max:80}},annotations:[{id:'audit-note',date:AUDIT_DATE,text:'A long timeline note explaining a change in measurement device and training routine.'}],reminder:{enabled:false,weekdays:[1,3,5],time:'08:30',timezone:'Europe/Amsterdam'}},workouts:{equipment:['dumbbells','bench','cable'],substitutions:{},supersets:{},progression:{}}};
 for(let i=0;i<2;i++){const version=makeRecipeVersion({id:'audit-version-'+i,recipeId:'audit-recipe',name:'One-pot roasted vegetable and lentil recipe with a long descriptive title',yieldG:1200+i*100,servings:4,ingredients:[{name:'Lentils, cooked',grams:500,kcal:116,protein:9,carbs:20,fat:.4,source:'Synthetic ingredient label'},{name:'Roasted vegetables',grams:700,kcal:80,protein:2,carbs:12,fat:3,source:'Synthetic ingredient label'}],createdAt:`2026-10-${14+i}T09:00:00Z`});commitRecipeVersion(data,version,i===0?null:structuredClone(data.recipes.find(r=>r.id==='audit-recipe')));}
 validateLifeHealth(data);return data;
}
export async function sourceFingerprint(){const names=(await fs.readdir(path.join(ROOT,'dist'))).filter(n=>/\.(js|css|html)$/.test(n)&&n!=='sw.js').sort();const hash=createHash('sha256');for(const name of names)hash.update(name).update(await fs.readFile(path.join(ROOT,'dist',name)));return hash.digest('hex');}
let playwright;
try{playwright=await import(process.env.CAM_HEALTH_PLAYWRIGHT||'playwright');}catch{playwright=await import('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}
export async function act(page,action,attributes={}){
 await page.evaluate(({action,attributes})=>{const b=document.createElement('button');b.dataset.act=action;for(const [k,v]of Object.entries(attributes))b.setAttribute(k,String(v));document.body.append(b);b.click();b.remove();},{action,attributes});
 await page.waitForTimeout(35);
}
export async function closeSheet(page,{discard=true}={}){
 if(!await page.locator('#sheet').evaluate(e=>e.open)){await page.waitForFunction(()=>!document.querySelector('#sheet').innerHTML,{},{timeout:3000});return;}
 await page.locator('.sheet-head [data-act=close-sheet]').click();
 if(discard&&await page.locator('.discard-confirm:not([hidden])').count())await page.locator('[data-act=discard]').click();
 await page.waitForFunction(()=>{const sheet=document.querySelector('#sheet');return !sheet.open&&!sheet.innerHTML&&!history.state?.sheet;},{},{timeout:3000});await page.waitForTimeout(40);
}
// Serialize native readback on the software GPU without changing app pixels.
export async function awaitPaint(cdp){
 await cdp.send('Runtime.evaluate',{expression:'new Promise(resolve=>{const timer=setTimeout(resolve,150);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve();}));})',awaitPromise:true});
}
export async function captureNativeScreenshot(cdp,options={}){
 const lock='/workspace/cams-health-layout-audit/.native-capture-lock';let acquired=false;
 while(!acquired){try{await fs.mkdir(lock);await fs.writeFile(path.join(lock,'owner'),String(process.pid));acquired=true;}catch(error){if(error.code!=='EEXIST')throw error;try{const pid=Number(await fs.readFile(path.join(lock,'owner'),'utf8'));try{process.kill(pid,0);}catch{await fs.rm(lock,{recursive:true,force:true});}}catch{}if(!acquired)await new Promise(resolve=>setTimeout(resolve,50));}}
 try{await awaitPaint(cdp);return await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true,optimizeForSpeed:true,...options});}finally{await fs.rm(lock,{recursive:true,force:true});}
}
export async function createAudit(domain,options={}){
 const out=options.out||path.join('/workspace/cams-health-layout-audit',domain);await fs.mkdir(out,{recursive:true});
 const expectedSource=options.expectedSource||process.env.AUDIT_EXPECT_SOURCE||null;
 if(expectedSource&&await sourceFingerprint()!==expectedSource)throw Error('Audit source does not match AUDIT_EXPECT_SOURCE before browser launch');
 const requestedTheme=options.theme??process.env.AUDIT_THEME??'dark';
 if(!['dark','light'].includes(requestedTheme))throw Error('AUDIT_THEME must be dark or light');
 const requestedProfileIds=process.env.AUDIT_PROFILES?process.env.AUDIT_PROFILES.split(',').map(id=>id.trim()).filter(Boolean):process.env.AUDIT_NATIVE_SWEEP==='1'?['oppo','oppo-text-200']:null;
 if(requestedProfileIds?.some(id=>!PROFILES.some(p=>p.id===id)))throw Error('Unknown AUDIT_PROFILES entry');
 const requestedStateIds=process.env.AUDIT_SHELL_ONLY_IDS?.split(',').map(id=>id.trim()).filter(Boolean)||null;
 const excludedStatePatterns=process.env.AUDIT_SHELL_SKIP_COMBOS?['^home-combination-']:[];
 const screenPlans=[];
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CAM_HEALTH_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage',...(options.args||[])]});
 const context=await browser.newContext({viewport:{width:424,height:924},screen:{width:424,height:924},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:options.reducedMotion||'reduce',serviceWorkers:'block',...(options.contextOptions||{})});
 // Seed a real saved preference before the application reads it. Existing
 // values survive reload, so actual Settings toggles can still prove persistence.
 await context.addInitScript(theme=>{try{if(!localStorage.getItem('cams-health-theme'))localStorage.setItem('cams-health-theme',theme);}catch{}},requestedTheme);
 let remote=structuredClone(options.fixture||makeFixture('rich')),revision=0,authFailure=false,saveFailure=null;const commits=new Map(),writes=[],blocked=[],errors=[],cases=[],checks=[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(['127.0.0.1','localhost'].includes(url.hostname)){if(url.pathname==='/data/health.json')return route.fulfill({json:remote});return route.continue();}
  if(url.hostname==='raw.githubusercontent.com')return route.fulfill({json:remote});
  if(url.hostname==='api.github.com'){
   if(url.pathname==='/user')return route.fulfill(authFailure?{status:401,json:{message:'Synthetic invalid token'}}:{json:{login:'layout-audit'}});
   if(url.pathname.includes('/contents/dist/data/health.json')){
    if(req.method()==='PUT'){
     if(saveFailure)return route.fulfill({status:saveFailure.status||409,json:{message:saveFailure.message||'Synthetic conflict'}});
     const input=req.postDataJSON();if(input.sha!=='audit-blob-'+revision)return route.fulfill({status:409,json:{message:'Synthetic stale SHA'}});
     const candidate=JSON.parse(Buffer.from(input.content,'base64').toString());validateLifeHealth(candidate);remote=candidate;revision++;const sha='audit-commit-'+revision;commits.set(sha,structuredClone(remote));writes.push({message:input.message,data:structuredClone(remote)});return route.fulfill({json:{commit:{sha},content:{sha:'audit-blob-'+revision}}});
    }
    const data=commits.get(url.searchParams.get('ref'))||remote;return route.fulfill({json:{sha:'audit-blob-'+revision,content:Buffer.from(JSON.stringify(data)).toString('base64')}});
   }
  }
  blocked.push({url:req.url(),method:req.method()});return route.abort();
 });
 if(process.env.AUDIT_RESUME==='1'){try{const previous=JSON.parse(await fs.readFile(path.join(out,'cases.json'),'utf8')),hash=await sourceFingerprint();if(previous.cases?.some(c=>c.sourceHash!==hash||c.sourceChangedSinceBoot||c.requestedTheme!==requestedTheme))throw Error('Cannot resume a different source or requested theme');cases.push(...(previous.cases||[]));checks.push(...(previous.checks||[]));screenPlans.push(...(previous.screenPlans||[]));}catch(error){if(error.code!=='ENOENT')throw error;}}
 const page=await context.newPage(),cdp=await context.newCDPSession(page);let loadedSourceHash=await sourceFingerprint();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 async function boot({date=AUDIT_DATE,clearStorage=false,expectWidgets=true}={}){loadedSourceHash=await sourceFingerprint();if(expectedSource&&loadedSourceHash!==expectedSource)throw Error('Audit source changed from AUDIT_EXPECT_SOURCE before boot');if(clearStorage){await page.goto('http://127.0.0.1:5173/');await page.evaluate(()=>localStorage.clear());}await page.goto('http://127.0.0.1:5173/?date='+date);if(expectWidgets)await page.locator('.health-widget').first().waitFor({timeout:30000});await page.evaluate(()=>document.fonts.ready);}
 async function themeMetadata(){const actual=await page.evaluate(()=>{let themePreference=null;try{themePreference=localStorage.getItem('cams-health-theme');}catch{}return{theme:document.documentElement.getAttribute('data-theme'),themePreference,colorScheme:getComputedStyle(document.documentElement).colorScheme};});return{...actual,requestedTheme,themeMatchesRequest:actual.theme===requestedTheme};}
 async function check(name,fn){try{const detail=await fn();checks.push({name,pass:true,...(detail&&typeof detail==='object'?{detail}:{})});}catch(e){checks.push({name,pass:false,error:e.message});await saveResults();throw e;}}
 async function auditSheetMode(mode){
  if(!['full','popup'].includes(mode))return;
  if((await page.locator('#sheet').getAttribute('data-mode'))!==mode)await page.locator('[data-act=expand-sheet]').click();
  await page.waitForFunction(mode=>{const d=document.querySelector('#sheet');return d?.open&&d.dataset.mode===mode&&history.state?.sheet&&!!history.state.fullscreen===(mode==='full');},mode,{timeout:5000});
 }
 async function screen(id,{profiles=PROFILES,modes=['popup','full'],capture=true,captureMaxPages=Infinity,captureProfiles=['oppo','oppo-text-200'],meta={},settle=45}={}){
  if(requestedProfileIds)profiles=profiles.filter(p=>requestedProfileIds.includes(p.id));
  capture=capture&&process.env.AUDIT_METRICS_ONLY!=='1';const foundSheet=await page.locator('#sheet').count(),initialMode=foundSheet?await page.locator('#sheet').getAttribute('data-mode'):null,hasSheet=foundSheet?await page.locator('#sheet').evaluate(e=>e.open):false;const observedSourceHash=await sourceFingerprint();
  screenPlans.push({id,requestedTheme,profiles:profiles.map(p=>p.id),modes:hasSheet?modes:['page']});
  const desired=profiles.flatMap(p=>modes.map(m=>({profile:p.id,mode:hasSheet?m:'page'})));if(process.env.AUDIT_RESUME==='1'&&desired.every(key=>cases.some(c=>c.id===id&&c.profile===key.profile&&c.mode===key.mode&&c.sourceHash===loadedSourceHash&&!c.sourceChangedSinceBoot&&!c.captureErrors?.length)))return;
  if(process.env.AUDIT_RESUME==='1')for(let i=cases.length-1;i>=0;i--)if(cases[i].id===id&&desired.some(key=>key.profile===cases[i].profile&&key.mode===cases[i].mode))cases.splice(i,1);
  for(const profile of profiles){
   if(!profile.keyboard)await page.evaluate(()=>document.activeElement?.blur());
   await page.setViewportSize({width:profile.width,height:profile.height});await cdp.send('Emulation.clearDeviceMetricsOverride');await cdp.send('Emulation.setDeviceMetricsOverride',{width:profile.width,height:profile.height,deviceScaleFactor:profile.dpr||3,mobile:profile.id!=='desktop',screenWidth:profile.id.startsWith('oppo')?(profile.width>profile.height?924:424):profile.width,screenHeight:profile.id.startsWith('oppo')?(profile.width>profile.height?424:924):profile.height});
   for(const mode of modes){
    if(hasSheet)await auditSheetMode(mode);
    await page.evaluate(()=>{document.querySelector('#audit-text-style')?.remove();document.querySelectorAll('[data-audit-font]').forEach(e=>e.removeAttribute('data-audit-font'));});
    if(profile.textScale)await page.evaluate(scale=>{const rules=[];for(const [index,el]of [...document.querySelectorAll('body *')].entries()){if(['SCRIPT','STYLE','SVG','PATH','CANVAS','OPTION'].includes(el.tagName)||el.closest('svg'))continue;const s=getComputedStyle(el),font=parseFloat(s.fontSize);if(!(font>0))continue;el.dataset.auditFont=String(index);rules.push(`[data-audit-font="${index}"]{font-size:${font*scale}px!important;${Number.isFinite(parseFloat(s.lineHeight))?'line-height:'+parseFloat(s.lineHeight)*scale+'px!important;':''}}`);}const style=document.createElement('style');style.id='audit-text-style';style.textContent=rules.join('');document.head.append(style);},profile.textScale);
    if(profile.keyboard){await page.evaluate(()=>document.activeElement?.blur());await page.setViewportSize({width:424,height:924});await page.waitForTimeout(35);const input=page.locator('#sheet input:not([type=checkbox]):not([type=radio]):not([type=file]):visible,#sheet textarea:visible').first();if(await input.count())await input.focus({timeout:1000}).catch(()=>{});await page.setViewportSize({width:424,height:500});await cdp.send('Emulation.setDeviceMetricsOverride',{width:424,height:500,deviceScaleFactor:3,mobile:true,screenWidth:424,screenHeight:924});}
    await page.evaluate(keyboard=>{const d=document.querySelector('#sheet');if(d?.open)d.scrollTop=0;window.scrollTo(0,0);if(keyboard&&document.activeElement?.matches('input,textarea'))document.activeElement.scrollIntoView({block:'center'});},!!profile.keyboard);await page.waitForTimeout(settle);
    const metrics=await page.evaluate(()=>{
     const d=document.querySelector('#sheet'),scope=d?.open?d:(document.querySelector('#app')?.childElementCount?document.querySelector('#app'):document.body),s=scope?.querySelector('.sheet-content')||scope;
     const rect=scope?.getBoundingClientRect(),intentional=el=>el.closest('.table-scroll,.demo-sequence,.ws-exercise-rail,.ws-exercise-strip,.fs-week-chart,[data-audit-overflow-allowed]')||getComputedStyle(el.parentElement||el).overflowX==='auto';
     const small=[],clipped=[],editableValueOverflow=[],unnamed=[],offscreen=[],verticallyClippedStickyControls=[],modalHeadingWordBreaks=[];
     const heading=d?.open?d.querySelector('#sheet-title'):null;
     if(heading){
      const header=heading.closest('.sheet-head'),style=getComputedStyle(header),available=header.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT);
      for(let node=walker.nextNode();node;node=walker.nextNode())for(const match of node.textContent.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)){
       const range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
       const fragments=[...range.getClientRects()].filter(r=>r.width>.5&&r.height>.5),lines=new Set(fragments.map(r=>Math.round(r.top))),naturalWidth=fragments.reduce((n,r)=>n+r.width,0);
       if(lines.size>1&&naturalWidth<=available+1)modalHeadingWordBreaks.push({word:match[0],lines:lines.size,naturalWidth,available});
      }
     }
     for(const el of scope.querySelectorAll('button,a,summary,input,select,textarea,[role=button]')){
      const st=getComputedStyle(el),r=el.getBoundingClientRect();if(st.display==='none'||st.visibility==='hidden'||!r.width||!r.height||el.closest('[hidden]')||el.type==='hidden')continue;
      const label=el.getAttribute('aria-label')||el.textContent?.trim()||el.labels?.[0]?.textContent?.trim()||el.title||'';
      if(!label)unnamed.push(el.outerHTML.slice(0,180));
      if(el.closest('.sticky-actions,.sheet-head')&&!intentional(el)&&(r.top<Math.max(0,rect.top)-1||r.bottom>Math.min(innerHeight,rect.bottom)+1))verticallyClippedStickyControls.push({label:label.slice(0,100),top:r.top,bottom:r.bottom,clipTop:Math.max(0,rect.top),clipBottom:Math.min(innerHeight,rect.bottom),formTop:el.closest('form')?.getBoundingClientRect().top??null,formBottom:el.closest('form')?.getBoundingClientRect().bottom??null,inactiveForm:!!el.closest('form')&&(el.closest('form').getBoundingClientRect().top>=Math.min(innerHeight,rect.bottom)||el.closest('form').getBoundingClientRect().bottom<=Math.max(0,rect.top))});if(['checkbox','radio'].includes(el.type))continue;
      if((r.width<43.5||r.height<43.5)&&!el.disabled)small.push({tag:el.tagName,label:label.slice(0,80),w:Math.round(r.width),h:Math.round(r.height)});
      if(!intentional(el)&&(r.left<rect.left-2||r.right>rect.right+2))offscreen.push({label:label.slice(0,100),left:Math.round(r.left),right:Math.round(r.right)});
      if(el.scrollWidth>el.clientWidth+2&&['hidden','clip'].includes(st.overflowX)&&!intentional(el)){const item={label:label.slice(0,100),scroll:el.scrollWidth,width:el.clientWidth};if(el.matches('input,textarea'))editableValueOverflow.push(item);else clipped.push(item);}
     }
     const active=document.activeElement,ar=active?.getBoundingClientRect(),hr=document.querySelector('.sheet-head')?.getBoundingClientRect(),footer=active?.closest('form')?.querySelector('.sticky-actions')?.getBoundingClientRect();const focusedControl=active?.matches('input,textarea,select')?{name:active.name||active.id,top:ar.top,bottom:ar.bottom,aboveHeader:hr?ar.top<hr.bottom-1:false,belowViewport:ar.bottom>Math.min(innerHeight,rect.bottom)+1,behindFooter:footer?ar.bottom>footer.top+1&&footer.top<Math.min(innerHeight,rect.bottom):false}:null;let themePreference=null;try{themePreference=localStorage.getItem('cams-health-theme');}catch{}return {theme:document.documentElement.getAttribute('data-theme'),themePreference,colorScheme:getComputedStyle(document.documentElement).colorScheme,devicePixelRatio,focusedControl,modalHeadingWordBreaks,viewport:{width:innerWidth,height:innerHeight},keyboardOpen:document.body.classList.contains('keyboard-open'),title:document.querySelector('#sheet-title')?.textContent||document.title,documentOverflow:document.documentElement.scrollWidth-innerWidth,sheetOverflow:s?Math.max(0,s.scrollWidth-s.clientWidth):0,dialogBounds:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,smallTargets:small,clippedControls:clipped,editableValueOverflow,verticallyClippedStickyControls,offscreenControls:offscreen,unnamedControls:unnamed,scrollHeight:d?.open?scope.scrollHeight:document.scrollingElement.scrollHeight,clientHeight:d?.open?scope.clientHeight:innerHeight};
    });
    const item={id,profile:profile.id,mode:hasSheet?mode:'page',sourceHash:loadedSourceHash,sourceChangedSinceBoot:observedSourceHash!==loadedSourceHash,...meta,...metrics,requestedTheme,themeMatchesRequest:metrics.theme===requestedTheme};cases.push(item);
    if(capture&&(captureProfiles.includes(profile.id)||metrics.sheetOverflow>2||metrics.documentOverflow>2)){
     const stem=(id+'--'+profile.id+'--'+item.mode).replace(/[^a-zA-Z0-9_.-]/g,'-');item.screenshots=[];
     const naturalSteps=Math.max(0,Math.ceil((metrics.scrollHeight-metrics.clientHeight)/Math.max(120,metrics.clientHeight-140)));const steps=Math.min(naturalSteps,Math.max(1,captureMaxPages-1));item.capturePolicy={maxPages:Number.isFinite(captureMaxPages)?captureMaxPages:null,profiles:captureProfiles,paginated:steps===naturalSteps};for(let part=0;part<=steps;part++){await page.evaluate(({part,steps})=>{const d=document.querySelector('#sheet');if(d?.open)d.scrollTop=(d.scrollHeight-d.clientHeight)*part/(steps||1);else window.scrollTo(0,(document.scrollingElement.scrollHeight-innerHeight)*part/(steps||1));},{part,steps});const position=part===0?'top':part===steps?'bottom':'part-'+part;const file=stem+'--'+position+'.png';try{const shot=await captureNativeScreenshot(cdp);await fs.writeFile(path.join(out,file),Buffer.from(shot.data,'base64'));item.screenshots.push(file);}catch(error){(item.captureErrors??=[]).push(error.message);}}
    }
   }
  }
  await page.evaluate(()=>{document.querySelector('#audit-text-style')?.remove();document.querySelectorAll('[data-audit-font]').forEach(e=>e.removeAttribute('data-audit-font'));});
  await page.setViewportSize({width:424,height:924});await cdp.send('Emulation.setDeviceMetricsOverride',{width:424,height:924,deviceScaleFactor:3,mobile:true,screenWidth:424,screenHeight:924});if(hasSheet&&initialMode)await auditSheetMode(initialMode);
  await page.evaluate(()=>{const d=document.querySelector('#sheet');if(d?.open)d.scrollTop=0;window.scrollTo(0,0);});await saveResults();
 }
 async function saveResults(){await fs.writeFile(path.join(out,'cases.json'),JSON.stringify({domain,date:new Date().toISOString(),profiles:PROFILES,runConfiguration:{requestedTheme,expectedSource,requestedProfileIds,requestedStateIds,excludedStatePatterns,themeSeed:'Missing local preference only, before app boot; actual DOM theme recorded per case',javaScriptEnabled:options.contextOptions?.javaScriptEnabled!==false},screenPlans,cases,checks,errors,blockedRequests:blocked,mockWrites:writes.map(w=>w.message)},null,2));}
 async function finish(){const sourceAtFinish=await sourceFingerprint(),sourcePass=!expectedSource||sourceAtFinish===expectedSource;if(expectedSource)checks.push({name:'Audit source matches requested final freeze',pass:sourcePass,detail:{expectedSource,sourceAtFinish}});await saveResults();await browser.close();if(!sourcePass)throw Error('Audit source changed from AUDIT_EXPECT_SOURCE before finish');return {domain,screens:new Set(cases.map(c=>c.id)).size,cases:cases.length,checks:checks.length,errors};}
 return {domain,out,page,context,browser,captureSession:cdp,boot,screen,check,finish,saveResults,themeMetadata,cases,checks,errors,writes,blocked,get remote(){return remote;},setRemote(data){remote=structuredClone(data);revision++;},setAuthFailure(v){authFailure=v;},setSaveFailure(v){saveFailure=v;}};
}
