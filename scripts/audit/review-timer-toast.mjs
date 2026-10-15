/** Real timer UI/expiry handler while a guided Review's lower actions remain open. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAudit,makeFixture,act,closeSheet,sourceFingerprint} from './harness.mjs';
import {nativeTransaction} from './native-transaction.mjs';

const sourceAtStart=await sourceFingerprint();
if(process.env.AUDIT_EXPECT_SOURCE)assert.equal(sourceAtStart,process.env.AUDIT_EXPECT_SOURCE);
const prototypePath=process.env.AUDIT_REVIEW_TIMER_PROTO_STUDIO||null;
if(prototypePath&&!process.env.AUDIT_REVIEW_TIMER_PREFIX)throw Error('A prototype requires an explicit separate AUDIT_REVIEW_TIMER_PREFIX');
const prototypeStudio=prototypePath?await fs.readFile(prototypePath,'utf8'):null;
const prototypeSHA256=prototypeStudio?createHash('sha256').update(prototypeStudio).digest('hex'):null;
function measureTimerToast(){
 const d=document.querySelector('#sheet'),t=document.querySelector('#toast'),rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};},tr=rect(t),dr=rect(d),head=d.querySelector('.sheet-head'),header=rect(head),content=d.querySelector('.sheet-content')||d;
 const actions=[],smallTargets=[],clippedControls=[],offscreenControls=[],unnamedControls=[],verticallyClippedStickyControls=[],modalHeadingWordBreaks=[];
 for(const e of d.querySelectorAll('button,summary')){
  const r=rect(e),s=getComputedStyle(e);if(!r.width||!r.height||e.closest('[hidden]')||s.display==='none'||s.visibility==='hidden')continue;
  const label=e.getAttribute('aria-label')||e.textContent.trim()||e.title||'';
  const clip={left:Math.max(0,dr.left),right:Math.min(innerWidth,dr.right),top:Math.max(0,head.contains(e)?dr.top:header.bottom),bottom:Math.min(innerHeight,dr.bottom)};
  const visibleRect={left:Math.max(r.left,clip.left),right:Math.min(r.right,clip.right),top:Math.max(r.top,clip.top),bottom:Math.min(r.bottom,clip.bottom)};
  if(visibleRect.right<=visibleRect.left||visibleRect.bottom<=visibleRect.top)continue;
  const authSummary=e.matches('.inline-connect>summary');actions.push({label,tag:e.tagName.toLowerCase(),authSummary,rect:r,visibleRect});
  if(!label)unnamedControls.push(e.outerHTML.slice(0,180));
  if(!e.disabled&&(r.width<43.5||r.height<43.5))smallTargets.push({label,width:r.width,height:r.height});
  if(!e.closest('.demo-sequence,.ws-exercise-rail')&&(r.left<dr.left-2||r.right>dr.right+2))offscreenControls.push({label,left:r.left,right:r.right});
  if(e.scrollWidth>e.clientWidth+2&&['hidden','clip'].includes(s.overflowX))clippedControls.push({label,width:e.clientWidth,scroll:e.scrollWidth});
  if(e.closest('.sticky-actions,.sheet-head')&&(r.top<Math.max(0,dr.top)-1||r.bottom>Math.min(innerHeight,dr.bottom)+1))verticallyClippedStickyControls.push({label,top:r.top,bottom:r.bottom,inactiveForm:false});
 }
 const overlap=actions.filter(e=>tr.left<e.visibleRect.right&&tr.right>e.visibleRect.left&&tr.top<e.visibleRect.bottom&&tr.bottom>e.visibleRect.top);
 const heading=d.querySelector('#sheet-title');if(heading){const style=getComputedStyle(head),available=head.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT);for(let node=walker.nextNode();node;node=walker.nextNode())for(const m of node.textContent.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)){const range=document.createRange();range.setStart(node,m.index);range.setEnd(node,m.index+m[0].length);const fragments=[...range.getClientRects()].filter(r=>r.width>.5&&r.height>.5),lines=new Set(fragments.map(r=>Math.round(r.top))),naturalWidth=fragments.reduce((n,r)=>n+r.width,0);if(lines.size>1&&naturalWidth<=available+1)modalHeadingWordBreaks.push({word:m[0],lines:lines.size,naturalWidth,available});}}
 let topLayer=false;try{topLayer=t.matches(':popover-open');}catch{}
 return{text:t.textContent,role:t.getAttribute('role'),ariaLive:t.getAttribute('aria-live'),rect:tr,actions,overlap,header,topLayer,insideModal:d.contains(t),clearActions:overlap.length===0,visibleAuthSummaryCount:actions.filter(e=>e.authSummary).length,belowHeader:tr.top>=header.bottom-1,insideViewport:tr.top>=0&&tr.bottom<=innerHeight&&tr.left>=0&&tr.right<=innerWidth,focusRetained:document.activeElement===d.querySelector('.ws-actions [data-ws="discard"]'),timerStopped:localStorage.getItem('cams-health-timer')==='0'&&document.querySelector('#timer-dock').hidden,modalOpen:d.open,actualDPR:devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},measuredControlSelector:'All visible modal button and summary elements, using their visible intersection with the modal and sticky header',documentOverflow:document.documentElement.scrollWidth-innerWidth,sheetOverflow:Math.max(0,content.scrollWidth-content.clientWidth),smallTargets,clippedControls,offscreenControls,unnamedControls,verticallyClippedStickyControls,modalHeadingWordBreaks};
}
for(const theme of ['dark','light']){
 process.env.AUDIT_THEME=theme;
 const a=await createAudit((process.env.AUDIT_REVIEW_TIMER_PREFIX||'review-timer-toast-current')+'-'+theme,{fixture:makeFixture('rich')}),{page}=a;
 const cdp=await a.context.newCDPSession(page),failures=[];
 // Native density is CDP-session scoped; window.devicePixelRatio alone is insufficient.
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:424,height:924,deviceScaleFactor:3,mobile:true,screenWidth:424,screenHeight:924});
 let prototypeRequests=0;
 if(prototypeStudio)await page.route('**/studio.js*',async route=>{const response=await route.fetch();prototypeRequests++;await route.fulfill({response,body:prototypeStudio});});
 const plan=['popup','full'].map(mode=>({id:'timer-finished-guided-review',theme,profile:'oppo-text-200',mode}));
 await fs.writeFile(path.join(a.out,'expected-states.json'),JSON.stringify(plan,null,2)+'\n');
 await page.clock.install({time:new Date('2026-10-15T12:00:00Z')});
 try{
  for(const mode of ['popup','full']){
   await a.boot({clearStorage:true});
   await act(page,'timer');await page.locator('[data-seconds="60"]').press('Enter');
   await closeSheet(page,{discard:true});await act(page,'workouts-tools');
   await page.locator('[data-ws="start"][data-ws-id="push-a"]').press('Enter');
   await page.locator('[data-ws="review"]').first().press('Enter');await page.locator('#ws-review-form').waitFor();
   if(await page.locator('#sheet').getAttribute('data-mode')!==mode)await page.locator('[data-act="expand-sheet"]').press('Enter');
   await page.evaluate(()=>{
    const rules=[];
    for(const [i,e] of [...document.querySelectorAll('body *')].entries()){
     if(['SCRIPT','STYLE','SVG','PATH','CANVAS','OPTION'].includes(e.tagName)||e.closest('svg'))continue;
     const s=getComputedStyle(e),font=parseFloat(s.fontSize),line=parseFloat(s.lineHeight);if(!(font>0))continue;
     e.dataset.timerAuditFont=String(i);rules.push(`[data-timer-audit-font="${i}"]{font-size:${font*2}px!important;${Number.isFinite(line)?'line-height:'+line*2+'px!important;':''}}`);
    }
    const s=document.createElement('style');s.textContent=rules.join('');document.head.append(s);
    document.querySelector('#sheet').scrollTop=document.querySelector('#sheet').scrollHeight;
   });
   await page.locator('.ws-actions [data-ws="discard"]').focus();
   const observed=await nativeTransaction(cdp,async()=>{
    // Advance the browser clock; the application's own interval detects expiry.
    // No app state, toast function, style or timer handler is replaced.
    await page.clock.fastForward(61000);
    await page.waitForFunction(()=>{const t=document.querySelector('#toast');return t.classList.contains('show')&&t.textContent==='Rest timer finished.'&&Number(getComputedStyle(t).opacity)>.95;});
    return page.evaluate(measureTimerToast);
   });
   const file='timer-finished-guided-review--oppo-text-200--'+mode+'.png';
   const bytes=Buffer.from(observed.png.data,'base64'),nativeSize={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
   assert.equal(observed.value.actualDPR,3);assert.deepEqual(nativeSize,{width:1272,height:2772});
   await fs.writeFile(path.join(a.out,file),bytes);
   const value={...observed.value,actionToCaptureMs:observed.actionToCaptureMs,stillShownAfterCapture:await page.locator('#toast').evaluate(e=>e.classList.contains('show')),focusRetainedAfterCapture:await page.evaluate(()=>document.activeElement===document.querySelector('.ws-actions [data-ws="discard"]'))};
   a.cases.push({...await a.themeMetadata(),id:'timer-finished-guided-review',profile:'oppo-text-200',mode,sourceHash:await sourceFingerprint(),sourceChangedSinceBoot:await sourceFingerprint()!==sourceAtStart,geometryScope:'toast-only',controlScope:value.measuredControlSelector,prototype:!!prototypePath,assetOverrides:prototypePath?['studio.js']:[],prototypeAssetSHA256:prototypeSHA256,devicePixelRatio:value.actualDPR,viewport:value.viewport,nativeSize,screenshots:[file],toast:value,documentOverflow:value.documentOverflow,sheetOverflow:value.sheetOverflow,smallTargets:value.smallTargets,clippedControls:value.clippedControls,offscreenControls:value.offscreenControls,unnamedControls:value.unnamedControls,verticallyClippedStickyControls:value.verticallyClippedStickyControls,modalHeadingWordBreaks:value.modalHeadingWordBreaks,captureErrors:[]});
   await a.saveResults();
   try{await a.check('Actual timer expiry clears every visible Review button and summary ('+theme+','+mode+')',async()=>{if(!value.timerStopped||!value.modalOpen||!value.focusRetained||!value.focusRetainedAfterCapture||value.role!=='status'||value.ariaLive!=='polite'||!value.clearActions||value.visibleAuthSummaryCount!==1||!value.belowHeader||!value.insideViewport||!value.stillShownAfterCapture||!(value.topLayer||value.insideModal)||!value.actions.some(e=>e.label==='Discard local draft')||value.documentOverflow>2||value.sheetOverflow>2||value.smallTargets.length||value.clippedControls.length||value.offscreenControls.length||value.unnamedControls.length||value.verticallyClippedStickyControls.length||value.modalHeadingWordBreaks.length)throw Error(JSON.stringify(value));return value;});}catch(e){failures.push(e.message);}
  }
 }finally{
  const observations={...await a.themeMetadata(),sourceAtStart,sourceAtFinish:await sourceFingerprint(),geometryScope:'toast-only',prototype:!!prototypePath,sourceAcceptance:!prototypePath,assetOverrides:prototypePath?['studio.js']:[],prototypeAssetPath:prototypePath,prototypeAssetSHA256:prototypeSHA256,prototypeRequests,cases:a.cases.length,failures,mockWrites:a.writes.length,passed:a.cases.length===2&&!failures.length&&!a.errors.length,method:'Actual60s preset, actual guided-session Start/Review buttons and real application updateTimer interval. Playwright advances elapsed clock61s only; no timer state or handler replacement. Explicit studio.js prototype override, when present, is separately labelled and excluded from production acceptance. Computed font/line height doubled for200% stress. Native CDP session pinned toDPR3 and PNG IHDR verified1272x2772. Native lock acquired before clock advance; full screenshot while real expiry toast remains visible. All visible modal buttons and summaries are measured; this focused probe does not claim complete field geometry checks. No physical timer/device claim.'};
  assert.equal(observations.sourceAtFinish,sourceAtStart);
  if(prototypePath)assert.ok(prototypeRequests>=2);
  await fs.writeFile(path.join(a.out,'observations.json'),JSON.stringify(observations,null,2)+'\n');await a.finish();console.log(JSON.stringify({theme,cases:observations.cases,passed:observations.passed,failures}));if(!observations.passed)process.exitCode=1;
 }
}
