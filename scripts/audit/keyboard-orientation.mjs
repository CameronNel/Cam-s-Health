// Targeted keyboard-state checks. These cases record actual focus/viewport state;
// they are not a replacement for the complete sheet geometry audit.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createAudit,sourceFingerprint,closeSheet,captureNativeScreenshot} from './harness.mjs';

const domain=process.env.AUDIT_DOMAIN||'keyboard-orientation';
const base=process.env.AUDIT_KEYBOARD_OUT||path.join('/workspace/cams-health-layout-audit',domain);
const requestedTheme=process.env.AUDIT_THEME||'both';
if(!['dark','light','both'].includes(requestedTheme))throw Error('AUDIT_THEME must be dark, light or both');
const themes=requestedTheme==='both'?['dark','light']:[requestedTheme];
const expected=process.env.AUDIT_EXPECT_SOURCE;
const sourceAtStart=await sourceFingerprint();
if(!expected||sourceAtStart!==expected)throw Error('AUDIT_EXPECT_SOURCE must match before keyboard-state checks');
// Only explicit prototype runs may replace this asset. Final runs omit the env var.
const overrideFile=process.env.AUDIT_KEYBOARD_STUDIO_OVERRIDE||null;
const override=overrideFile?await fs.readFile(overrideFile,'utf8'):null;
const prototype=override!==null;
const prototypeAssetHash=prototype?createHash('sha256').update(override).digest('hex'):null;
const profiles=[
 {id:'oppo-keyboard',width:424,height:500,dpr:3,screenWidth:424,screenHeight:924,description:'Portrait viewport reduced for keyboard, after actual input blur'},
 {id:'oppo-landscape',width:924,height:424,dpr:3,screenWidth:924,screenHeight:424,description:'Landscape home after rotation, actual blur and Close'},
 {id:'short480',width:424,height:480,dpr:3,screenWidth:424,screenHeight:480,description:'Ordinary short viewport, actual input focused without keyboard reduction'}
];
const states=[
 {id:'keyboard-portrait-blur-recovery',profile:'oppo-keyboard',mode:'popup'},
 {id:'keyboard-rotation-dismiss-active-timer',profile:'oppo-landscape',mode:'page'},
 {id:'keyboard-short-viewport-editing',profile:'short480',mode:'popup'}
];
const summaries=[];
for(const theme of themes){
 const out=path.join(base,theme);await fs.mkdir(out,{recursive:true});
 const plan={scope:'Three predeclared keyboard-state scenarios; one native landscape timer viewport',theme,profiles,states,expectedNativeCases:[{...states[1],theme}],expectedCases:3};
 // Preserve a finisher-owned independent plan if one was already registered.
 await fs.writeFile(path.join(out,'expected-states.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
 const a=await createAudit(domain,{out,theme,expectedSource:expected}),{page,context}=a,cdp=await context.newCDPSession(page),snapshots=[];
 if(prototype)await context.route(/\/studio\.js(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'text/javascript',body:override}));
 async function settle(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForTimeout(60);}
 async function viewport(width,height,short=false){
  await page.setViewportSize({width,height});
  const landscape=width>height;
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:3,mobile:true,screenWidth:landscape?924:424,screenHeight:landscape?424:short?480:924,screenOrientation:{type:landscape?'landscapePrimary':'portraitPrimary',angle:landscape?90:0}});
  await settle();
 }
 async function snapshot(step){
  const actual=await page.evaluate(()=>{
   const dock=document.querySelector('#timer-dock'),style=getComputedStyle(dock),end=Number(localStorage.getItem('cams-health-timer')),sheet=document.querySelector('#sheet');
   return{viewport:{width:innerWidth,height:innerHeight},visualViewport:{width:visualViewport.width,height:visualViewport.height},screen:{width:screen.width,height:screen.height,orientation:screen.orientation.type},devicePixelRatio,keyboardOpen:document.body.classList.contains('keyboard-open'),active:{tag:document.activeElement.tagName,name:document.activeElement.name||null},sheetOpen:sheet.open,mode:sheet.open?sheet.dataset.mode:'page',timer:{hidden:dock.hidden,display:style.display,visible:!dock.hidden&&style.display!=='none'&&!!dock.getClientRects().length,text:dock.textContent.trim(),end,remainingMs:end>0?end-Date.now():null},theme:document.documentElement.dataset.theme,themePreference:localStorage.getItem('cams-health-theme'),colorScheme:getComputedStyle(document.documentElement).colorScheme};
  });
  if(actual.theme!==theme||actual.themePreference!==theme||actual.colorScheme!==theme)throw Error('Actual theme differs from requested theme');
  snapshots.push({step,...actual});return actual;
 }
 async function field(){await page.locator('#app [data-act=body-log]').click();await page.locator('#sheet [name=weightKg]').focus();await settle();}
 async function blur(){await page.locator('#sheet [name=weightKg]').evaluate(element=>element.blur());await settle();}
 async function record(index,actual,detail,screenshot=null){
  const state=states[index],profile=profiles.find(profile=>profile.id===state.profile),sourceAtFinish=await sourceFingerprint();
  if(sourceAtFinish!==expected)throw Error('Source changed during keyboard-state case');
  if(actual.viewport.width!==profile.width||actual.viewport.height!==profile.height||actual.devicePixelRatio!==profile.dpr||actual.mode!==state.mode)throw Error('Observed viewport, DPR or mode differs from declared keyboard-state case');
  const item={...state,sourceHash:sourceAtStart,sourceChangedSinceBoot:false,prototype,assetOverrides:prototype?['studio.js']:[],behaviorOnly:true,behaviorScope:'Actual focus, blur, viewport and keyboard-state transition; full geometry metrics are not collected here',...actual,requestedTheme:theme,themeMatchesRequest:true,sourceAtStart,sourceAtFinish,detail,screenshots:screenshot?[screenshot]:[]};
  if(screenshot)item.capturePolicy={maxPages:1,profiles:[state.profile],paginated:false,scope:'Landscape home after actual keyboard rotation, blur and dialog Close'};
  a.cases.push(item);await a.saveResults();return item;
 }
 let fatal=null;
 try{
  await a.check('Portrait keyboard blur retains compact mode until viewport height recovers',async()=>{
   await viewport(424,924);await a.boot();await field();await viewport(424,500);
   const reduced=await snapshot('Portrait reduced while actual input is focused');if(!reduced.keyboardOpen||reduced.active.name!=='weightKg')throw Error('Reduced focused portrait did not enter keyboard mode');
   await blur();const blurred=await snapshot('Portrait actual blur before height recovery');if(!blurred.keyboardOpen)throw Error('Blur prematurely removed compact keyboard mode');
   await record(0,blurred,{reduced,blurred});
   await viewport(424,924);const restored=await snapshot('Portrait height recovered');if(restored.keyboardOpen)throw Error('Recovered portrait retained keyboard mode');await closeSheet(page);
   return{prototype,sourceAtStart,sourceAtFinish:await sourceFingerprint(),actualTheme:theme,reduced,blurred,restored};
  });
  await a.check('Keyboard rotation and dismissal restore the active 60s timer on landscape home',async()=>{
   await viewport(424,924);await a.boot();await page.locator('[data-peek=workouts]').click();await page.locator('#sheet [data-act=expand-sheet]').click();await page.locator('#sheet [data-act=timer]').click();await page.locator('#sheet [data-seconds="60"]').click();await closeSheet(page);
   const started=await snapshot('Portrait actual 60s UI timer active');if(!started.timer.visible||started.timer.remainingMs<=0)throw Error('Actual UI timer did not start');
   await field();await viewport(424,500);const reduced=await snapshot('Portrait keyboard before rotation');if(!reduced.keyboardOpen)throw Error('Portrait keyboard mode missing before rotation');
   await viewport(924,424);const rotated=await snapshot('Landscape while actual input remains focused');await blur();await closeSheet(page);
   const home=await snapshot('Landscape home after actual blur and Close');if(home.keyboardOpen||!home.timer.visible||home.timer.remainingMs<=0)throw Error('Active rest timer remains hidden after rotated keyboard dismissal');
   const screenshot=`keyboard-rotation-dismiss-active-timer--oppo-landscape--page--${theme}.png`,png=Buffer.from((await captureNativeScreenshot(cdp)).data,'base64');await fs.writeFile(path.join(out,screenshot),png);
   const pngDimensions={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};if(pngDimensions.width!==2772||pngDimensions.height!==1272)throw Error('Unexpected native landscape dimensions');
   const captured=await snapshot('Landscape native capture completed');if(captured.keyboardOpen||!captured.timer.visible||captured.timer.remainingMs<=0)throw Error('Active timer expired or became hidden during native capture');
   await record(1,captured,{started,reduced,rotated,home,captured,pngDimensions},screenshot);
   return{prototype,sourceAtStart,sourceAtFinish:await sourceFingerprint(),actualTheme:theme,started,reduced,rotated,home,captured,screenshot,pngDimensions};
  });
  await a.check('Ordinary 480px-high viewport does not imply an open keyboard while editing',async()=>{
   await viewport(424,480,true);await a.boot();const idle=await snapshot('Fresh ordinary 480px-high home');await field();const focused=await snapshot('Ordinary 480px-high actual input focused');
   if(idle.keyboardOpen||focused.keyboardOpen||focused.active.name!=='weightKg')throw Error('Ordinary short viewport was misclassified as an open keyboard');
   await record(2,focused,{idle,focused});await blur();const blurred=await snapshot('Ordinary 480px-high actual input blurred');if(blurred.keyboardOpen)throw Error('Ordinary short viewport blur enabled keyboard mode');await closeSheet(page);
   return{prototype,sourceAtStart,sourceAtFinish:await sourceFingerprint(),actualTheme:theme,idle,focused,blurred};
  });
 }catch(error){fatal=error;}finally{try{await a.finish();}catch(error){fatal||=error;}}
 const sourceAtFinish=await sourceFingerprint();
 const observations={sourceAtStart,sourceAtFinish,sourceHash:sourceAtStart,prototype,assetOverrides:prototype?['studio.js']:[],prototypeAssetHash,theme,actualTheme:theme,caseCount:a.cases.length,snapshots,checks:a.checks,errors:a.errors,mockWrites:a.writes.length,fatalError:fatal?.message||null,note:'Targeted actual DOM focus/blur/Close and actual 60s UI timer. Viewport resizing models the Android keyboard and rotation; browser emulation, not a physical phone.'};
 await fs.writeFile(path.join(out,'observations.json'),JSON.stringify(observations,null,2)+'\n');
 // This driver has an intentionally narrow profile set including a declared short viewport.
 const ledger=JSON.parse(await fs.readFile(path.join(out,'cases.json'),'utf8'));ledger.profiles=profiles;ledger.screenPlans=states.map(state=>({id:state.id,profiles:[state.profile],modes:[state.mode],requestedTheme:theme}));await fs.writeFile(path.join(out,'cases.json'),JSON.stringify(ledger,null,2)+'\n');
 const summary={theme,sourceAtStart,sourceAtFinish,prototype,cases:a.cases.length,checks:a.checks.length,failedChecks:a.checks.filter(check=>!check.pass),errors:a.errors,mockWrites:a.writes.length,fatalError:fatal?.message||null};summaries.push(summary);
 if(fatal||a.writes.length||a.checks.some(check=>!check.pass)||a.errors.length||a.cases.length!==3||sourceAtFinish!==expected)process.exitCode=1;
}
await fs.mkdir(base,{recursive:true});await fs.writeFile(path.join(base,'observations.json'),JSON.stringify({sourceAtStart,sourceAtFinish:await sourceFingerprint(),prototype,prototypeAssetHash,summaries},null,2)+'\n');console.log(JSON.stringify({domain,base,summaries},null,2));
