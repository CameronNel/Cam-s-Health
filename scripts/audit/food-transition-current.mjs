import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createAudit,act,closeSheet,captureNativeScreenshot,sourceFingerprint} from './harness.mjs';
import {view,clearText,captureCase,saveToken,assertBaseCase,withNativeCaptureLease,declareProfiles} from './food-current-proof-helpers.mjs';

const expectedSource=process.env.AUDIT_EXPECT_SOURCE;assert.ok(expectedSource);
const base=process.env.FOOD_AUDIT_OUT||'/workspace/cams-health-layout-audit/food-transition-current',summaries=[];
const transitionProfiles=[{id:'oppo',width:424,height:924,dpr:3},{id:'oppo-text-200',width:424,height:924,dpr:3,textScale:2},{id:'oppo-keyboard-text-128',width:424,height:500,dpr:3,textScale:1.28,keyboard:true,screenHeight:924},{id:'oppo-landscape',width:924,height:424,dpr:3}];
const focusProfiles=[{id:'oppo-keyboard',width:424,height:500,dpr:3,keyboard:true,screenHeight:924},{id:'oppo-keyboard-text-128',width:424,height:500,dpr:3,textScale:1.28,keyboard:true,screenHeight:924},{id:'oppo-landscape',width:924,height:424,dpr:3},{id:'oppo-landscape-text-128',width:924,height:424,dpr:3,textScale:1.28}];
declareProfiles([...transitionProfiles,...focusProfiles]);

async function actionFacts(page){return page.evaluate(()=>{
 const d=document.querySelector('#sheet'),dr=d.getBoundingClientRect(),head=d.querySelector('.sheet-head').getBoundingClientRect(),toast=document.querySelector('#toast'),tr=toast.getBoundingClientRect(),visible=toast.classList.contains('show')&&tr.width>0&&tr.height>0&&getComputedStyle(toast).visibility!=='hidden'&&Number(getComputedStyle(toast).opacity)>.01;
 const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
 const actions=[...d.querySelectorAll('.save-panel .form-actions button')].map(b=>{const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {label:b.textContent.trim(),top:r.top,bottom:r.bottom,width:r.width,height:r.height,fullyVisible:r.top>=Math.max(0,head.bottom)-1&&r.bottom<=Math.min(innerHeight,dr.bottom)+1,centerHitsButton:hit?.closest('button')===b,toastOverlapArea:visible?overlap(r,tr):0};});
 return {toastText:toast.textContent,toastVisible:visible,toastBounds:{left:tr.left,right:tr.right,top:tr.top,bottom:tr.bottom},actions};
});}
function assertActions(facts){assert.equal(facts.actions.length,2);assert.equal(new Set(facts.actions.map(b=>b.label)).size,2);for(const b of facts.actions){assert.ok(b.width>=43.5&&b.height>=43.5,JSON.stringify(b));assert.equal(b.fullyVisible,true,JSON.stringify(b));assert.equal(b.centerHitsButton,true,JSON.stringify(b));assert.equal(b.toastOverlapArea,0,JSON.stringify(b));}}

for(const theme of ['dark','light']){
 const out=base+'/'+theme;
 try{await fs.access(out+'/cases.json');throw Error('Refusing to overwrite '+out);}catch(error){if(error.code!=='ENOENT')throw error;}
 await fs.mkdir(out,{recursive:true});
 const profiles=[...new Map([...transitionProfiles,...focusProfiles].map(p=>[p.id,p])).values()];
 const inventory={sourceHash:expectedSource,theme,scope:'Originally agreed actual-save→new-form toast and density-error→focus/action plan; no app asset overrides.',expectedCaseCount:24,expectedNativeImageCount:32,expectedMockSaveCount:16,profiles,expectedScreenStates:[...['custom','recipe-portion'].flatMap(target=>transitionProfiles.flatMap(profile=>['popup','full'].map(mode=>({id:'old-success-toast-to-'+target,profile:profile.id,mode})))),...focusProfiles.flatMap(profile=>['popup','full'].map(mode=>({id:'density-error-then-focus',profile:profile.id,mode})))]};
 try{const existing=JSON.parse(await fs.readFile(out+'/inventory.json','utf8'));assert.equal(existing.sourceHash,expectedSource);assert.deepEqual(existing.expectedScreenStates.map(c=>[c.id,c.profile,c.mode].join('|')).sort(),inventory.expectedScreenStates.map(c=>[c.id,c.profile,c.mode].join('|')).sort());}catch(error){if(error.code!=='ENOENT')throw error;}
 await fs.writeFile(out+'/inventory.json',JSON.stringify(inventory,null,2));
 const a=await createAudit('food-transition-current-'+theme,{out,theme}),{page}=a,cdp=await a.context.newCDPSession(page);
 const click=async name=>page.locator('#sheet [data-fs="'+name+'"]').first().click();
 const fresh=async mode=>{await closeSheet(page);await act(page,'food-tools');if(mode&&mode!=='hub')await click(mode);};
 const standard=async()=>{await clearText(page);await page.setViewportSize({width:424,height:924});await cdp.send('Emulation.setDeviceMetricsOverride',{width:424,height:924,deviceScaleFactor:3,mobile:true,screenWidth:424,screenHeight:924});};
 const save=async()=>{await saveToken(page);await page.locator('#sheet button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#sheet').open);await page.locator('#toast.show').waitFor({state:'visible'});assert.match(await page.locator('#toast').textContent(),/Saved and verified/);};
 try{
  const sourceAtStart=await sourceFingerprint();assert.equal(sourceAtStart,expectedSource);
  await a.boot({clearStorage:true});let n=0;
  for(const target of ['custom','recipe-portion'])for(const profile of transitionProfiles)for(const mode of ['popup','full']){
   console.log('Food transition current:',theme,target,profile.id,mode);
   await standard();
   if(target==='custom'){
    await fresh('library');await click('custom');await page.locator('[name=name]').fill('Synthetic transition food '+(++n));await page.locator('[name=source]').fill('Synthetic transition label');for(const[k,v]of Object.entries({kcal:210,protein:24,carbs:15,fat:6}))await page.locator('[name='+k+']').fill(String(v));
   }else{
    await fresh('recipes');await click('recipe-edit');await page.locator('[name=name]').fill('Synthetic recipe transition proof '+(++n));
   }
   await withNativeCaptureLease(async()=>{
    await save();const successAt=Date.now();
    await fresh(target==='custom'?'library':'recipes');await click(target);
    await view(page,cdp,profile.keyboard?{...profile,height:924}:profile,mode);
    if(profile.keyboard){await page.locator('#sheet input:not([type=checkbox]):not([type=hidden])').first().focus();await page.setViewportSize({width:profile.width,height:profile.height});await cdp.send('Emulation.setDeviceMetricsOverride',{width:profile.width,height:profile.height,deviceScaleFactor:3,mobile:true,screenWidth:424,screenHeight:924});await page.waitForTimeout(100);}
    await page.locator('#sheet .save-panel .form-actions').scrollIntoViewIfNeeded();await page.waitForTimeout(80);
    const facts=await actionFacts(page),successAgeAtActionCheckMs=Date.now()-successAt;
    assert.ok(successAgeAtActionCheckMs<4000,'Check must precede the ordinary toast timeout');
    const c=await captureCase(a,cdp,{id:'old-success-toast-to-'+target,profile,mode,expectedSource,captureUnderOwnedLease:true,meta:{theme,syntheticData:true,auditPhase:'actual-current-conditional-proof',transition:'Actual intercepted successful save immediately followed by a new '+target+' form',oldSuccessToastObservedBeforeOpening:true,successAgeAtActionCheckMs,nativeLeaseBeforeSave:true,ordinaryToastTimerUnmodified:true,transitionActionFacts:facts,...facts}});
    await a.check(`Food old successful-save toast cannot overlap or intercept either ${target} action at ${profile.id}/${mode}/${theme}`,async()=>{assertBaseCase(c);assertActions(facts);return facts;});
   });
  }
  for(const profile of focusProfiles)for(const mode of ['popup','full']){
   console.log('Food focused error current:',theme,profile.id,mode);
   await standard();await fresh('library');await click('portion');await page.locator('[name=unit]').selectOption('ml');await page.locator('[name=densityGPerMl]').fill('');await saveToken(page);await page.locator('#sheet button[type=submit]').click();await page.waitForFunction(()=>/density/i.test(document.querySelector('#form-error')?.textContent||''));
   const fullProfile=profile.keyboard?{...profile,height:924}:profile;
   await view(page,cdp,fullProfile,mode);const density=page.locator('[name=densityGPerMl]');await density.focus();
   if(profile.keyboard){await page.setViewportSize({width:profile.width,height:profile.height});await cdp.send('Emulation.setDeviceMetricsOverride',{width:profile.width,height:profile.height,deviceScaleFactor:3,mobile:true,screenWidth:424,screenHeight:924});}
   await page.waitForTimeout(150);
   const focus=await density.evaluate(el=>{const r=el.getBoundingClientRect(),label=el.closest('.field').getBoundingClientRect(),head=document.querySelector('.sheet-head').getBoundingClientRect(),panel=el.closest('form').querySelector('.save-panel').getBoundingClientRect(),d=document.querySelector('#sheet').getBoundingClientRect();const bottom=Math.min(innerHeight,d.bottom,panel.top<innerHeight&&panel.bottom>d.top?panel.top:Infinity);return {activeName:document.activeElement?.name,labelTop:label.top,labelBottom:label.bottom,labelFullyVisible:label.top>=Math.max(0,head.bottom)-1&&label.bottom<=bottom+1,errorText:document.querySelector('#form-error').textContent,fieldHeight:r.height};});
   const c=await captureCase(a,cdp,{id:'density-error-then-focus',profile,mode,expectedSource,selector:'[name=densityGPerMl]',meta:{theme,syntheticData:true,auditPhase:'actual-current-conditional-proof',focusAfterActualValidationError:true,...focus}});
   await a.check(`Food density field and label remain visible after actual error then focus at ${profile.id}/${mode}/${theme}`,async()=>{assertBaseCase(c);assert.equal(focus.activeName,'densityGPerMl');assert.match(focus.errorText,/density/i);assert.equal(focus.labelFullyVisible,true,JSON.stringify(focus));assert.equal(c.focusedControl.aboveHeader,false);assert.equal(c.focusedControl.belowViewport,false);assert.equal(c.focusedControl.behindFooter,false);return focus;});
   await page.locator('#sheet .save-panel .form-actions').scrollIntoViewIfNeeded();await page.waitForTimeout(80);const facts=await actionFacts(page);
   await a.check(`Food density error keeps both actions visible and hit-testable at ${profile.id}/${mode}/${theme}`,async()=>{assertActions(facts);return facts;});
   const actionFile=`density-error-then-focus--${profile.id}--${mode}--actions.png`,shot=await captureNativeScreenshot(cdp);await fs.writeFile(out+'/'+actionFile,Buffer.from(shot.data,'base64'));c.screenshots.push(actionFile);c.reachableErrorActions=facts;c.capturePolicy={paginated:false,scope:'Focused density input and label after actual error, then both reachable error-form actions.'};await a.saveResults();
  }
  await a.check('All actual Food save-to-new-form transitions keep stale toast away from both actions',async()=>{const transitions=a.cases.filter(c=>c.id.startsWith('old-success-toast-to-'));assert.equal(transitions.length,16);for(const c of transitions){assert.equal(c.oldSuccessToastObservedBeforeOpening,true);assert.ok(c.successAgeAtActionCheckMs<4000);assertActions(c.transitionActionFacts);}return{transitions:transitions.length,syntheticSaves:a.writes.length};});
  await a.check('Food conditional transitions and focused errors cover every independently planned case on current source',async()=>{assert.equal(a.cases.length,24);assert.equal(a.writes.length,16);assert.deepEqual(a.errors,[]);assert.equal(await sourceFingerprint(),expectedSource);});
  await a.finish();const sourceAtFinish=a.checks.find(c=>c.name==='Audit source matches requested final freeze').detail.sourceAtFinish;
  await fs.writeFile(out+'/observations.json',JSON.stringify({sourceAtStart,sourceAtFinish,theme,prototype:false,assetOverrides:false,ordinaryToastTimerUnmodified:true,toastTransitions:a.cases.filter(c=>c.id.startsWith('old-success-toast-to-')).map(c=>({id:c.id,profile:c.profile,mode:c.mode,oldSuccessToastObservedBeforeOpening:c.oldSuccessToastObservedBeforeOpening,successAgeAtActionCheckMs:c.successAgeAtActionCheckMs,actionFacts:c.transitionActionFacts,screenshots:c.screenshots})),fieldReachability:a.cases.filter(c=>c.id==='density-error-then-focus').map(c=>({id:c.id,profile:c.profile,mode:c.mode,field:'densityGPerMl',focusedControl:c.focusedControl,labelFullyVisible:c.labelFullyVisible,errorText:c.errorText,reachableErrorActions:c.reachableErrorActions,screenshots:c.screenshots}))},null,2));
  const summary={sourceHash:expectedSource,theme,cases:a.cases.length,nativeImages:a.cases.reduce((n,c)=>n+c.screenshots.length,0),checks:a.checks.length,mockWrites:a.writes.length,status:'passed'};summaries.push(summary);await fs.writeFile(out+'/summary.json',JSON.stringify(summary,null,2));
 }catch(error){await a.saveResults();await a.browser.close();console.error(error);process.exitCode=1;break;}
}
await fs.mkdir(base,{recursive:true});await fs.writeFile(base+'/summary.json',JSON.stringify({sourceHash:expectedSource,expectedCases:48,results:summaries},null,2));
