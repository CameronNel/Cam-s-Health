/** Settled actual-pointer check for the Setup fixture, separate from toast timing. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createAudit,makeFixture,act,sourceFingerprint} from './harness.mjs';
const a=await createAudit(process.env.AUDIT_DOMAIN||'setup-checkbox-pointer-final',{fixture:makeFixture('rich')}),{page}=a;
const sourceAtStart=await sourceFingerprint();let observation;
await fs.writeFile(path.join(a.out,'expected-states.json'),JSON.stringify([{id:'setup-equipment-pointer-toggle',profile:'oppo',mode:'popup'}],null,2)+'\n');
try{
 await a.boot();
 await a.check('Settled native pointer toggles Setup equipment at100% text',async()=>{
  await act(page,'workouts-tools');await page.locator('[data-ws=config]').press('Enter');
  const checkbox=page.locator('[name=equipment][value=manual]');await checkbox.waitFor();
  await checkbox.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const before=await checkbox.isChecked(),bounds=await checkbox.boundingBox();
  const hit=await page.evaluate(({x,y,width,height})=>{const el=document.elementFromPoint(x+width/2,y+height/2);window.__auditPointerEvents=[];document.addEventListener('pointerdown',event=>window.__auditPointerEvents.push({tag:event.target.tagName,name:event.target.name||null,value:event.target.value||null,trusted:event.isTrusted}),{once:true,capture:true});return{tag:el?.tagName,name:el?.getAttribute('name'),value:el?.getAttribute('value')};},bounds);
  await checkbox.click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const after=await checkbox.isChecked(),events=await page.evaluate(()=>window.__auditPointerEvents);
  observation={before,after,bounds,hit,events,changed:before!==after,keyboardOpen:await page.locator('body').evaluate(el=>el.classList.contains('keyboard-open'))};
  a.cases.push({...await a.themeMetadata(),id:'setup-equipment-pointer-toggle',profile:'oppo',mode:'popup',sourceHash:await sourceFingerprint(),sourceChangedSinceBoot:false,devicePixelRatio:await page.evaluate(()=>devicePixelRatio),viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight})),behaviorOnly:true,observation,screenshots:[]});
  await a.saveResults();
  if(!observation.changed||!events.some(event=>event.trusted&&event.name==='equipment'))throw Error('Actual pointer did not toggle settled equipment checkbox: '+JSON.stringify(observation));
  return observation;
 });
}finally{
 await fs.writeFile(path.join(a.out,'observations.json'),JSON.stringify({...await a.themeMetadata(),sourceAtStart,sourceAtFinish:await sourceFingerprint(),prototype:false,observation,mockWrites:a.writes.length,method:'Fresh actual Setup at424x924/DPR3,100% text. Scroll and two animation frames settle the native checkbox; trusted pointer activation and checked-state change recorded. No DOM state override or health write.'},null,2)+'\n');
 await a.finish();
}
