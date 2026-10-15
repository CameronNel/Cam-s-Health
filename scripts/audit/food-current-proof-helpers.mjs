import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {captureNativeScreenshot,sourceFingerprint,awaitPaint,PROFILES} from './harness.mjs';

// createAudit serializes this shared catalogue into every ledger. Declare custom
// planned viewports before creating the audit so native dimensions are reproducible.
export function declareProfiles(profiles){
  for(const profile of profiles){
    const known=PROFILES.find(p=>p.id===profile.id);
    if(!known){PROFILES.push({...profile});continue;}
    for(const key of ['width','height','dpr','textScale','keyboard'])if(profile[key]!=null)assert.equal(known[key],profile[key],profile.id+' '+key);
  }
}

export async function withNativeCaptureLease(fn){
  const lock='/workspace/cams-health-layout-audit/.native-capture-lock';let acquired=false;
  while(!acquired){try{await fs.mkdir(lock);await fs.writeFile(lock+'/owner',String(process.pid));acquired=true;}catch(error){if(error.code!=='EEXIST')throw error;try{const pid=Number(await fs.readFile(lock+'/owner','utf8'));try{process.kill(pid,0);}catch{await fs.rm(lock,{recursive:true,force:true});}}catch{}if(!acquired)await new Promise(resolve=>setTimeout(resolve,50));}}
  try{return await fn();}finally{await fs.rm(lock,{recursive:true,force:true});}
}

export async function clearText(page){
  await page.evaluate(()=>{document.querySelector('#audit-text-style')?.remove();document.querySelectorAll('[data-audit-font]').forEach(e=>e.removeAttribute('data-audit-font'));});
}
export async function view(page,cdp,profile,mode){
  await clearText(page);
  await page.setViewportSize({width:profile.width,height:profile.height});
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:profile.width,height:profile.height,deviceScaleFactor:profile.dpr||3,mobile:true,screenWidth:profile.screenWidth||profile.width,screenHeight:profile.screenHeight||profile.height});
  if(await page.locator('#sheet').getAttribute('data-mode')!==mode)await page.locator('#sheet [data-act=expand-sheet]').click();
  await page.waitForFunction(mode=>document.querySelector('#sheet')?.dataset.mode===mode,mode);
  if(profile.textScale)await page.evaluate(scale=>{
    const rules=[];
    for(const[index,el]of [...document.querySelectorAll('body *')].entries()){
      if(['SCRIPT','STYLE','SVG','PATH','CANVAS','OPTION'].includes(el.tagName)||el.closest('svg'))continue;
      const s=getComputedStyle(el),font=parseFloat(s.fontSize);if(!(font>0))continue;
      el.dataset.auditFont=String(index);rules.push(`[data-audit-font="${index}"]{font-size:${font*scale}px!important;${Number.isFinite(parseFloat(s.lineHeight))?'line-height:'+parseFloat(s.lineHeight)*scale+'px!important;':''}}`);
    }
    const style=document.createElement('style');style.id='audit-text-style';style.textContent=rules.join('');document.head.append(style);
  },profile.textScale);
  await page.waitForTimeout(100);
}
export async function captureCase(a,cdp,{id,profile,mode,expectedSource,meta={},selector=null,captureUnderOwnedLease=false}){
  assert.equal(await sourceFingerprint(),expectedSource);
  const metrics=await a.page.evaluate(selector=>{
    const d=document.querySelector('#sheet'),r=d.getBoundingClientRect(),header=d.querySelector('.sheet-head')?.getBoundingClientRect(),footer=d.querySelector('.save-panel')?.getBoundingClientRect();
    const el=selector?d.querySelector(selector):null,er=el?.getBoundingClientRect();
    const rect=x=>x?{left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height}:null;
    const actions=[...d.querySelectorAll('.save-panel .form-actions button')].map(b=>({label:b.textContent.trim(),...rect(b.getBoundingClientRect())}));
    const smallTargets=[],clippedControls=[],editableValueOverflow=[],offscreenControls=[],unnamedControls=[],verticallyClippedStickyControls=[];
    for(const node of d.querySelectorAll('button,a,summary,input,select,textarea,[role=button]')){
      const s=getComputedStyle(node),b=node.getBoundingClientRect();if(s.display==='none'||s.visibility==='hidden'||!b.width||!b.height||node.closest('[hidden]')||node.type==='hidden')continue;
      const label=node.getAttribute('aria-label')||node.textContent?.trim()||node.labels?.[0]?.textContent?.trim()||node.title||'',intentional=node.closest('.table-scroll,.demo-sequence,.ws-exercise-rail,.ws-exercise-strip,.fs-week-chart,[data-audit-overflow-allowed]')||getComputedStyle(node.parentElement||node).overflowX==='auto';
      if(!label)unnamedControls.push(node.outerHTML.slice(0,180));
      if(node.closest('.sticky-actions,.sheet-head')&&!intentional&&(b.top<Math.max(0,r.top)-1||b.bottom>Math.min(innerHeight,r.bottom)+1))verticallyClippedStickyControls.push({label,top:b.top,bottom:b.bottom});
      if(['checkbox','radio'].includes(node.type))continue;
      if((b.width<43.5||b.height<43.5)&&!node.disabled)smallTargets.push({label,width:b.width,height:b.height});
      if(!intentional&&(b.left<r.left-2||b.right>r.right+2))offscreenControls.push({label,left:b.left,right:b.right});
      if(node.scrollWidth>node.clientWidth+2&&['hidden','clip'].includes(s.overflowX)&&!intentional){const item={label,scroll:node.scrollWidth,width:node.clientWidth};if(node.matches('input,textarea'))editableValueOverflow.push(item);else clippedControls.push(item);}
    }
    const content=d.querySelector('.sheet-content')||d;
    return {title:document.querySelector('#sheet-title').textContent,devicePixelRatio,keyboardOpen:document.body.classList.contains('keyboard-open'),viewport:{width:innerWidth,height:innerHeight},dialogBounds:rect(r),documentOverflow:document.documentElement.scrollWidth-innerWidth,sheetOverflow:Math.max(0,content.scrollWidth-content.clientWidth),controlBounds:rect(er),headerBounds:rect(header),footerBounds:rect(footer),actions,smallTargets,clippedControls,editableValueOverflow,offscreenControls,unnamedControls,verticallyClippedStickyControls,focusedControl:el?{name:el.name,top:er.top,bottom:er.bottom,aboveHeader:er.top<(header?.bottom||r.top)-1,belowViewport:er.bottom>Math.min(innerHeight,r.bottom)+1,behindFooter:footer&&footer.top<Math.min(innerHeight,r.bottom)&&footer.bottom>r.top?er.bottom>footer.top+1:false}:null};
  },selector);
  const theme=await a.themeMetadata(),name=`${id}--${profile.id}--${mode}--target.png`;let shot;
  if(captureUnderOwnedLease){assert.equal(await fs.readFile('/workspace/cams-health-layout-audit/.native-capture-lock/owner','utf8'),String(process.pid));await awaitPaint(cdp);shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true,optimizeForSpeed:true});}
  else shot=await captureNativeScreenshot(cdp);
  await fs.writeFile(a.out+'/'+name,Buffer.from(shot.data,'base64'));
  const item={id,profile:profile.id,mode,sourceHash:expectedSource,sourceChangedSinceBoot:false,...theme,...meta,...metrics,screenshots:[name],capturePolicy:{maxPages:1,paginated:false,scope:'Single native viewport focused on the conditional control or action; full form coverage belongs to the representative/matrix ledgers.'}};
  a.cases.push(item);await a.saveResults();return item;
}
export async function saveToken(page){
  const token=page.locator('#sheet [name=githubToken]');
  if(await token.count()){await page.locator('#sheet .inline-connect').evaluate(el=>el.open=true);await token.fill('audit-synthetic-token-never-valid');}
}
export function assertBaseCase(c){
  assert.ok(c.documentOverflow<=2&&c.sheetOverflow<=2,'No horizontal overflow');
  assert.deepEqual(c.smallTargets,[],'Actions retain minimum size');
  assert.deepEqual(c.clippedControls,[],'No clipped control text');
  assert.deepEqual(c.offscreenControls,[],'No horizontally offscreen control');
  assert.deepEqual(c.unnamedControls,[],'All controls are named');
  assert.deepEqual(c.verticallyClippedStickyControls,[],'Sticky controls remain within viewport');
  assert.equal(c.themeMatchesRequest,true);
  assert.equal(c.sourceChangedSinceBoot,false);
}
