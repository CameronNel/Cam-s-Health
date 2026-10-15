// Exhaustive integrated movement/viewer audit. All health data below is an intercepted fixture.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAudit,PROFILES,AUDIT_DATE,makeFixture,act,closeSheet,sourceFingerprint,captureNativeScreenshot} from './harness.mjs';
import {exerciseDemos,getExercisePose,exercisePhaseAt} from '../../dist/exercise-catalogue.js';
import {exerciseDemoWorkingSide,exerciseDemoCamera,reflectExercisePose,projectExercisePoint} from '../../dist/exercise-demo.js';
import {validateLifeHealth} from '../../dist/health-intelligence.js';

const OUT=process.env.AUDIT_OUT||'/workspace/cams-health-layout-audit/movements';
const captureStates=process.env.AUDIT_CAPTURE_STATES?.split(',');
const shouldCapture=id=>!captureStates||captureStates.includes(id);
const galleryRepresentativesOnly=process.env.AUDIT_GALLERY_REPRESENTATIVES_ONLY==='1';
await fs.mkdir(path.join(OUT,'stages'),{recursive:true});
const canonicalBefore=createHash('sha256').update(await fs.readFile(new URL('../../dist/data/health.json',import.meta.url))).digest('hex');
const angles=['three-quarter','front','side','rear'];
const entries=exerciseDemos.flatMap((demo,index)=>(demo.variants||[{id:'default',label:'Default'}]).map(variant=>({index,id:demo.id,name:demo.name,variant:variant.id,variantLabel:variant.label,workingSide:exerciseDemoWorkingSide(demo.id),sides:exerciseDemoWorkingSide(demo.id)?['right','left']:['both'],cycle:demo.cycleSeconds,cadence:demo.cadence.kind})));
const states=entries.flatMap(entry=>entry.sides.flatMap(side=>angles.map(angle=>({...entry,side,angle,stateId:`demo:${entry.id}:${entry.variant}:${angle}:${side}`}))));
function keyframeTimes(entry){const descriptor=exerciseDemos[entry.index];return entry.cadence==='hold'?[0]:entry.id==='neck-circuit'&&entry.variant==='circuit'?[12.5,37.5,62.5,87.5]:entry.id==='neck-circuit'&&entry.variant==='lateral'?[0,25,75]:entry.id==='neck-circuit'?[0,50]:entry.id==='wrist-flexion-extension'&&entry.variant==='both'?[8.75,26.25,58.75,76.25]:entry.cadence==='wrist'?[0,25,75]:[0,descriptor.cadence.firstHalfFraction*100];}
const baselineExpectedNativeCaptureIds=[...entries.map(e=>`demo-${e.id}-${e.variant}--oppo-popup`),...states.map(s=>s.stateId+'--35pct'),...entries.flatMap(e=>keyframeTimes(e).map(t=>`demo-${e.id}-${e.variant}--pose-${t}`))];
const expectedNativeCaptureIds=galleryRepresentativesOnly?entries.map(e=>`demo-${e.id}-${e.variant}--oppo-popup`):baselineExpectedNativeCaptureIds;
function fixture(){const data=makeFixture('rich');data.days[AUDIT_DATE].workouts=[{id:'audit-all-movements',sessionId:null,name:'All movement studies — synthetic layout and camera audit, never a performed workout',status:'partial',durationMin:null,notes:'Synthetic browser fixture only.',actualExercises:[...exerciseDemos.map((d,index)=>({name:d.name,sets:null,reps:null,load:null,...(index===0?{note:'Synthetic program note for the layout audit. '.repeat(12)}:{})})),{name:'Uncatalogued custom movement — unknown technique must never receive a guessed illustration',sets:null,reps:null,load:null},{name:'An unusually descriptive custom movement with a long single identifying word SupercalifragilisticexpialidociousSupercalifragilisticexpialidocious and a long explanation for text reflow',sets:null,reps:null,load:null}]}];validateLifeHealth(data);return data;}
const sourceHash=await sourceFingerprint();
const responsiveFamilies=[['single-arm-db-overhead-extension','unilateral-overhead-long-title'],['neck-circuit','neck-circuit-variants'],['wrist-flexion-extension','supported-wrist-variants'],['farmer-hold-dead-hang','static-grip-hang-variants'],['single-leg-db-rdl','unilateral-standing-hinge'],['cable-leg-extension','unilateral-seated-knee-extension'],['weighted-deficit-push-up','floor-press'],['one-arm-cable-row','unilateral-cable-pull']];
const expectedResponsiveStates=responsiveFamilies.flatMap(([id,family])=>PROFILES.flatMap(profile=>['popup','full'].flatMap(mode=>['folded','expanded'].map(options=>({exercise:id,family,profile:profile.id,mode,options})))));
function familyFor(id){
 if(id==='neck-circuit')return 'neck-circuit-variants';
 if(['wrist-flexion-extension','wrist-curl','wrist-extension'].includes(id))return 'supported-wrist-variants';
 if(id==='farmer-hold-dead-hang')return 'static-grip-hang-variants';
 if(['cable-leg-extension','cable-hamstring-curl'].includes(id))return 'unilateral-seated-knee-extension';
 if(['weighted-deficit-push-up','flat-db-press','incline-db-press'].includes(id))return 'floor-press';
 if(['bulgarian-split-squat','single-leg-db-rdl','step-up','single-leg-calf-raise','reverse-db-lunge','db-rdl','single-leg-hip-thrust','hanging-leg-raise','rdl-example','cable-crunch'].includes(id))return 'unilateral-standing-hinge';
 if(['one-arm-cable-row','v-bar-pulldown','lat-pulldown','single-arm-cable-pulldown','straight-arm-pulldown','bent-over-db-row','face-pull','pull-ups','chin-ups','cable-rear-delt-fly','scapular-cable-fly','cable-fly','single-arm-cable-fly','cable-crossover-example'].includes(id))return 'unilateral-cable-pull';
 return 'unilateral-overhead-long-title';
}
for(const entry of entries){entry.family=familyFor(entry.id);entry.responsiveRepresentative=responsiveFamilies.find(([,family])=>family===entry.family)[0];}
for(const state of states){state.family=familyFor(state.id);state.responsiveRepresentative=responsiveFamilies.find(([,family])=>family===state.family)[0];}
const expectedScreenStates=[...entries.flatMap(entry=>['folded','options'].flatMap(options=>['popup','full'].map(mode=>({id:`demo-${entry.id}-${entry.variant}-${options}`,exercise:entry.id,variant:entry.variant,family:entry.family,profile:'oppo',mode,options:options==='options'?'expanded':'folded'})))),...expectedResponsiveStates.map(state=>({...state,id:`responsive-${state.exercise}-${state.options==='expanded'?'options':'folded'}`})),...['long-program-note-expanded','unknown-custom','unknown-custom-long-name','rest-no-demonstration'].flatMap(id=>PROFILES.flatMap(profile=>['popup','full'].map(mode=>({id,profile:profile.id,mode}))))];
const scope=process.env.AUDIT_GALLERY_ONLY==='1'?'native-gallery':process.env.AUDIT_RESPONSIVE_ONLY==='1'?'responsive':'all';
const inventory={sourceHash,scope,expectedScreenStates:expectedScreenStates.filter(s=>scope==='all'||(scope==='native-gallery'?s.id.startsWith('demo-'):!s.id.startsWith('demo-'))),expectedAllScreenStates:expectedScreenStates,layoutFamilyNote:'Responsive families map shared sheet/control structure, not muscle anatomy. Every catalogue movement and authored variant is separately rendered in all four camera angles; representatives cover shared controls across all9viewport/text profiles.',responsiveFamilies:responsiveFamilies.map(([representative,family])=>({family,representative})),expectedResponsiveStates,generatedAt:new Date().toISOString(),demoCount:exerciseDemos.length,variantCount:entries.length,unilateralCount:exerciseDemos.filter(d=>exerciseDemoWorkingSide(d.id)).length,angleSideStates:states.length,animationSamples:states.length*8,profiles:PROFILES,entries,states,additionalStates:['loading','no-webgl','webgl-context-lost','shader-prewarm-context-loss','unknown-custom','rest-no-demonstration','reduced-motion','hidden-document','offscreen-viewer','closed-viewer','reopened-viewer','real-touch-hold','real-touch-pinch','android-back','long-title','long-program-note','multiple-exercises','timed-static-hold','keyboard-focus','timeline-speed-overlay','compact-options','expanded-options']};
inventory.expectedNativeCaptureIds=expectedNativeCaptureIds;assert.equal(baselineExpectedNativeCaptureIds.length,488);
if(galleryRepresentativesOnly){assert.equal(expectedNativeCaptureIds.length,59);inventory.captureScope='59 default-phone demo/variant representatives; the separately labelled 488-image Dark baseline retains its original camera/side/range coverage.';inventory.layoutFamilyNote='The catalogue universe has304 camera/side states. This current Light representative run renders59 default three-quarter right/both demo/variant states; the separately labelled Dark baseline covers the full camera/side/range universe, and current responsive ledgers cover allnine layout profiles.';inventory.expectedRenderedStates=states.filter(state=>state.angle==='three-quarter'&&state.side===(state.workingSide?'right':'both'));assert.equal(inventory.expectedRenderedStates.length,59);inventory.baselineExpectedNativeCaptureIds=baselineExpectedNativeCaptureIds;}
if(process.env.AUDIT_NATIVE_SWEEP==='1'&&scope==='responsive'){
 inventory.scope='responsive-native-baseline';inventory.expectedScreenStates=inventory.expectedScreenStates.filter(s=>['oppo','oppo-text-200'].includes(s.profile)||s.id.startsWith('responsive-single-arm-db-overhead-extension-'));inventory.baselineNote='Native OPPO and200% captures for every representative state, plus the first36 full-profile cases completed before the intentional CPU-coordination pause. All9 profiles are independently planned in expectedAllScreenStates and will receive a separate current-source geometry pass after scoped shared repairs.';
}
await fs.writeFile(path.join(OUT,'inventory.json'),JSON.stringify(inventory,null,2));
const geometrySourceHashes=Object.fromEntries(await Promise.all(['exercise-catalogue.js','exercise-extra.js','exercise-demo.js','exercise-anatomy.js','exercise-anatomy-mesh.js'].map(async file=>[file,createHash('sha256').update(await fs.readFile(new URL('../../dist/'+file,import.meta.url))).digest('hex')])));
const run={sourceHash,theme:process.env.AUDIT_THEME||'dark',captureScope:galleryRepresentativesOnly?'59-default-phone-representatives':'full-native-gallery',geometrySourceHashes,generatedAt:new Date().toISOString(),coverage:{demos:0,variants:0,angleSideStates:0,poseSamples:0},renderStates:[],geometry:[],captures:[],lifecycle:[],errors:[],canonicalBefore};
if(captureStates)run.selectedNativeCaptureStates=captureStates;
const save=()=>fs.writeFile(path.join(OUT,'results.json'),JSON.stringify(run,null,2));
const safe=value=>value.replace(/[^a-zA-Z0-9_.-]/g,'-');
const settle=p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function hold(page,locator){await locator.scrollIntoViewIfNeeded();const r=await locator.boundingBox(),element=await locator.elementHandle();await element.dispatchEvent('pointerdown',{button:0,isPrimary:true,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2});await page.waitForTimeout(500);await element.dispatchEvent('pointerup',{button:0,isPrimary:true,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2});}
async function openViewer(a){await hold(a.page,a.page.locator('[data-peek=workouts]'));await a.page.locator('.exercise-studio').waitFor();}
async function index(page,i){await page.locator(`[data-act=demo-select][data-index="${i}"]`).evaluate(b=>b.click());await page.locator('.exercise-studio').waitFor();}
async function options(page,open){await page.locator('.demo-options').evaluate((el,open)=>{if(el.open!==open)el.querySelector('summary').click();},open);}
async function controls(page,{variant,side,angle,time=35,overlay=false,speed=1}={}){
 await page.evaluate(value=>{
  const root=document.querySelector('#sheet');
  if(value.variant&&value.variant!=='default'){const b=root.querySelector(`[data-demo-variant="${CSS.escape(value.variant)}"]`);if(b?.getAttribute('aria-pressed')!=='true')b?.click();}
  if(value.side&&value.side!=='both'){const b=root.querySelector(`[data-demo-side="${value.side}"]`);if(b?.getAttribute('aria-pressed')!=='true')b?.click();}
  if(value.angle){const b=root.querySelector(`[data-demo-angle="${value.angle}"]`);if(b?.getAttribute('aria-pressed')!=='true')b?.click();}
  const select=root.querySelector('[data-demo-speed]');if(select&&Number(select.value)!==Number(value.speed)){select.value=String(value.speed);select.dispatchEvent(new Event('change',{bubbles:true}));}
  const toggle=root.querySelector('[data-demo-overlay]');if(toggle&&toggle.getAttribute('aria-pressed')!==String(value.overlay))toggle.click();
  const input=root.querySelector('[data-demo-scrub]'),stage=root.querySelector('[data-exercise-demo]');if(input&&(stage?.dataset.demoState!=='paused'||Math.abs(Number(input.value)-value.time)>.05)){input.value=String(value.time);input.dispatchEvent(new Event('input',{bubbles:true}));}
 },{variant,side,angle,time,overlay,speed});
}
async function mode(page,target){if(await page.locator('#sheet').getAttribute('data-mode')!==target){await page.locator('[data-act=expand-sheet]').evaluate(b=>b.click());await page.waitForFunction(target=>document.querySelector('#sheet').dataset.mode===target,target);}await settle(page);}
async function layout(page){return page.evaluate(()=>{
 const sheet=document.querySelector('#sheet'),content=sheet.querySelector('.sheet-content'),stage=sheet.querySelector('[data-exercise-demo]');
 const small=[],clipped=[],unnamed=[];
 for(const el of sheet.querySelectorAll('button,summary,input,select,textarea')){
  const style=getComputedStyle(el),r=el.getBoundingClientRect();if(!r.width||!r.height||el.closest('[hidden]')||style.display==='none'||style.visibility==='hidden')continue;
  const name=el.getAttribute('aria-label')||el.textContent.trim()||el.labels?.[0]?.textContent.trim()||'';
  if(!name&&!el.disabled)unnamed.push(el.outerHTML.slice(0,150));
  if(!el.disabled&&!['checkbox','radio'].includes(el.type)&&(r.width<43.5||r.height<43.5))small.push({name,w:r.width,h:r.height});
  if(!el.closest('.demo-sequence')&&el.scrollWidth>el.clientWidth+2&&['clip','hidden'].includes(style.overflowX))clipped.push({name,w:el.clientWidth,scroll:el.scrollWidth});
 }
 return {theme:document.documentElement.dataset.theme,documentOverflow:document.documentElement.scrollWidth-innerWidth,sheetOverflow:content.scrollWidth-content.clientWidth,small,clipped,unnamed,actualDPR:devicePixelRatio,renderer:stage?.dataset.renderer,viewerId:stage?.dataset.viewerId,workingSide:stage?.dataset.workingSide,variant:stage?.dataset.variant,angle:stage?.dataset.demoAngleValue,speed:stage?.dataset.demoSpeedValue,progress:stage?.dataset.demoProgressValue,phase:stage?.dataset.phase,stage:stage?{width:stage.clientWidth,height:stage.clientHeight}:null};
});}
let captureSession;
async function nativeCapture(page,id,file,{stage=false}={}){
 if(!captureSession){
  captureSession=await page.context().newCDPSession(page);
  // CDP screenshot density is session-scoped even when window.devicePixelRatio
  // reflects another session's emulation. Pin this capture session explicitly.
  await captureSession.send('Emulation.setDeviceMetricsOverride',{width:424,height:924,deviceScaleFactor:3,mobile:true,screenWidth:424,screenHeight:924});
  await settle(page);
 }
 // Control handlers synchronously draw the actual pose. CDP captures the next
 // compositor surface; no Playwright stable-frame wait or duplicate pose draw.
 if(stage)await page.locator('.demo-stage-wrap').evaluate(el=>{const r=el.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)el.scrollIntoView({block:'center',behavior:'instant'});});
 const metrics=await page.evaluate(stage=>{const r=stage?document.querySelector('.demo-stage-wrap').getBoundingClientRect():null;return {theme:document.documentElement.dataset.theme,dpr:devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},clip:r?{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}:null};},stage);
 assert.equal(metrics.dpr,3,'native movement captures use actual DPR3');
 assert.equal(metrics.theme,run.theme,'native movement captures retain the actual requested theme');
 const shot=await captureNativeScreenshot(captureSession,metrics.clip?{clip:metrics.clip}:{});
 const bytes=Buffer.from(shot.data,'base64'),nativeSize={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)},cssSize=metrics.clip||metrics.viewport;
 assert.ok(Math.abs(nativeSize.width-cssSize.width*metrics.dpr)<=3&&Math.abs(nativeSize.height-cssSize.height*metrics.dpr)<=3,'native screenshot dimensions match real device scale '+JSON.stringify({id,nativeSize,metrics}));
 await fs.writeFile(path.join(OUT,file),bytes);run.captures.push({id,file,theme:metrics.theme,actualDPR:metrics.dpr,nativeSize,cssSize});return file;
}
async function stageCapture(page,id){if(process.env.AUDIT_METRICS_ONLY==='1')return null;return nativeCapture(page,id,path.join('stages',safe(id)+'.png'),{stage:true});}
function geometryCheck(state,width,height){const out=[];const samples=[];for(const time of [0,.125,.25,.375,.5,.625,.75,.875]){
 let pose=getExercisePose(state.id,exercisePhaseAt(state.id,time),state.variant==='default'?undefined:state.variant);if(state.workingSide&&state.side!==state.workingSide)pose=reflectExercisePose(pose);
 const camera=exerciseDemoCamera(pose,state.angle,state.side==='left'?'left':'right'),target=pose.target||[0,.91,0];
 for(const [joint,point]of Object.entries(pose.joints)){
  const p=projectExercisePoint(point,camera,target,width,height);assert.ok(p.every(Number.isFinite),state.stateId+' finite projection');
  const cropped=p[0]<0||p[0]>width||p[1]<0||p[1]>height;
  const intentional=state.id==='neck-circuit'||['wrist-flexion-extension','wrist-curl','wrist-extension'].includes(state.id);
  if(cropped&&!(intentional&&/^(ankle|toe)/.test(joint)))out.push({time,joint,position:p});
 }
 samples.push({time,phase:pose.phaseLabel});
 }return {samples:samples.length,unexpectedClipping:out};}

const a=await createAudit(process.env.AUDIT_DOMAIN||'movements',{out:OUT,fixture:fixture(),reducedMotion:'reduce'}),{page}=a;
run.resumedCases=a.cases.length;
try{
 await a.boot();run.requestedTheme=run.theme;run.theme=await page.locator('html').getAttribute('data-theme');assert.equal(run.theme,run.requestedTheme);await page.waitForFunction(()=>document.documentElement.dataset.exerciseReady==='ready',{},{timeout:30000});await openViewer(a);const pooled=await page.locator('[data-exercise-demo]').getAttribute('data-viewer-id');
 await a.check('fixture gallery has every catalogue movement, two unknowns and a prewarmed shared renderer',async()=>{assert.equal(await page.locator('.demo-sequence [data-act=demo-select]').count(),55);assert.ok(pooled);assert.equal(await page.locator('[data-exercise-demo]').getAttribute('data-demo-state'),'paused');});
 for(const entry of process.env.AUDIT_RESPONSIVE_ONLY==='1'?[]:entries){
  await index(page,entry.index);await options(page,true);await controls(page,{variant:entry.variant,angle:'three-quarter',side:'right',time:35});
  await page.locator('[data-exercise-demo]').waitFor();
  const stem=`demo-${entry.id}-${entry.variant}`;
  // Every exercise and every authored variant receives both real popup/full layouts.
  await options(page,false);await a.screen(stem+'-folded',{profiles:PROFILES.filter(p=>p.id==='oppo'),modes:['popup','full'],capture:false,meta:{exercise:entry.id,variant:entry.variant,family:entry.family,options:'folded'}});
  await options(page,true);await a.screen(stem+'-options',{profiles:PROFILES.filter(p=>p.id==='oppo'),modes:['popup','full'],capture:false,meta:{exercise:entry.id,variant:entry.variant,family:entry.family,options:'expanded'}});
  await mode(page,'popup');if(process.env.AUDIT_METRICS_ONLY!=='1')await nativeCapture(page,stem+'--oppo-popup',safe(stem)+'--oppo-popup.png');
  for(const side of galleryRepresentativesOnly?(entry.workingSide?['right']:['both']):entry.sides)for(const angle of galleryRepresentativesOnly?['three-quarter']:angles){
   const state={...entry,side,angle,stateId:`demo:${entry.id}:${entry.variant}:${angle}:${side}`};
   await controls(page,{variant:entry.variant,side,angle,time:35,overlay:true});await settle(page);
   const metrics=await layout(page);assert.equal(metrics.viewerId,pooled,state.stateId+' retains one renderer');assert.equal(metrics.renderer,'webgl',state.stateId+' WebGL remains healthy');assert.equal(metrics.angle,angle);if(side!=='both')assert.equal(metrics.workingSide,side);
   const geometry=geometryCheck(state,metrics.stage.width,metrics.stage.height);assert.equal(geometry.unexpectedClipping.length,0,state.stateId+' working joints stay in frame');
   run.renderStates.push({sourceHash,...state,metrics});run.geometry.push({stateId:state.stateId,...geometry});run.coverage.angleSideStates++;run.coverage.poseSamples+=geometry.samples;
   if(!galleryRepresentativesOnly)await stageCapture(page,state.stateId+'--35pct');
  }
  // Distinct full-range endpoints, with circuit samples inside each submovement.
  const times=keyframeTimes(entry);
  if(!galleryRepresentativesOnly)for(const time of times){await controls(page,{variant:entry.variant,angle:'three-quarter',side:'right',time,overlay:false});await stageCapture(page,`${stem}--pose-${time}`);}
  run.coverage.variants++;run.coverage.demos=new Set(run.renderStates.map(x=>x.id)).size;await save();console.log(`Movement ${run.coverage.variants}/${entries.length}: ${entry.id}/${entry.variant}; ${run.coverage.angleSideStates}/${states.length} camera-side states`);
 }
 if(process.env.AUDIT_GALLERY_ONLY!=='1'){
 const representatives=['single-arm-db-overhead-extension','neck-circuit','wrist-flexion-extension','farmer-hold-dead-hang','single-leg-db-rdl','cable-leg-extension','weighted-deficit-push-up','one-arm-cable-row'];
 for(const id of representatives.slice(0,Number(process.env.AUDIT_REPRESENTATIVE_LIMIT??representatives.length))){const entry=entries.find(e=>e.id===id);await index(page,entry.index);await options(page,true);await controls(page,{variant:entry.variant,angle:'side',side:entry.workingSide?'left':'both',time:35,overlay:true});await a.screen('responsive-'+id+'-options',{profiles:PROFILES,modes:['popup','full'],capture:shouldCapture('responsive-'+id+'-options'),meta:{exercise:id,family:responsiveFamilies.find(([exercise])=>exercise===id)?.[1],options:'expanded',coverageReason:'long labels, zoomed neck/wrist, static hold, unilateral hinge/extension, floor and cable apparatus'}});await options(page,false);await a.screen('responsive-'+id+'-folded',{profiles:PROFILES,modes:['popup','full'],capture:shouldCapture('responsive-'+id+'-folded'),meta:{exercise:id,family:responsiveFamilies.find(([exercise])=>exercise===id)?.[1],options:'folded'}});}
 await index(page,0);await page.locator('.demo-program-note summary').evaluate(s=>s.click());await a.screen('long-program-note-expanded',{profiles:PROFILES,modes:['popup','full'],capture:shouldCapture('long-program-note-expanded')});
 await index(page,53);await a.check('unknown movement has no unrelated illustration',async()=>{assert.equal(await page.locator('[data-exercise-demo]').count(),0);assert.equal(await page.locator('.demo-unavailable').count(),1);});await a.screen('unknown-custom',{profiles:PROFILES,modes:['popup','full'],capture:shouldCapture('unknown-custom')});
 await index(page,54);await a.screen('unknown-custom-long-name',{profiles:PROFILES,modes:['popup','full'],capture:shouldCapture('unknown-custom-long-name')});
 await closeSheet(page);await page.locator('[data-peek=workouts]').click();await page.locator('[data-act=expand-sheet]').click();
 const rest=await page.locator('[data-workout]').evaluateAll(buttons=>buttons.find(b=>/rest/i.test(b.dataset.workout))?.dataset.workout);assert.ok(rest,'actual program contains rest');await hold(page,page.locator(`[data-workout="${rest}"]`));
 await a.check('rest preview contains recovery information and no fabricated movement',async()=>{assert.equal(await page.locator('#sheet-title').textContent(),'Recovery');assert.equal(await page.locator('[data-exercise-demo]').count(),0);});await a.screen('rest-no-demonstration',{profiles:PROFILES,modes:['popup','full'],capture:shouldCapture('rest-no-demonstration')});
 }
 await a.check('all actual integrated movement layouts avoid overflow and retain reachable named controls',async()=>{const bad=a.cases.filter(c=>c.documentOverflow>2||c.sheetOverflow>2||c.smallTargets.length||c.clippedControls.length||c.unnamedControls.length);run.layoutFailures=bad;assert.equal(bad.length,0,JSON.stringify(bad.slice(0,5)));});
 assert.equal(a.errors.length,0,'no integrated runtime errors');assert.equal(a.writes.length,0,'no health write attempts');run.integrated=await a.finish();
}catch(error){run.errors.push({phase:'gallery',message:error.message,stack:error.stack});await a.saveResults();await page.screenshot({path:path.join(OUT,'gallery-failure.png'),animations:'disabled'}).catch(()=>{});await a.browser.close();await save();throw error;}
run.sourceHashAfter=await sourceFingerprint();run.sourceChangedSinceStart=run.sourceHashAfter!==sourceHash;
run.canonicalAfter=createHash('sha256').update(await fs.readFile(new URL('../../dist/data/health.json',import.meta.url))).digest('hex');assert.equal(run.canonicalAfter,canonicalBefore,'canonical health record never changes during synthetic audit');await save();
console.log(JSON.stringify({domain:'movements',coverage:run.coverage,integrated:run.integrated,captures:run.captures.length,errors:run.errors}));
