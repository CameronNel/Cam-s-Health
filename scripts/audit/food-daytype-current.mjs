import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createAudit,act,closeSheet,sourceFingerprint} from './harness.mjs';
import {view,clearText,captureCase,assertBaseCase,declareProfiles} from './food-current-proof-helpers.mjs';

const expectedSource=process.env.AUDIT_EXPECT_SOURCE;assert.ok(expectedSource);
const base=process.env.FOOD_AUDIT_OUT||'/workspace/cams-health-layout-audit/food-daytype-current';
const profiles=[{id:'small320-text-200',width:320,height:568,dpr:3,textScale:2},{id:'oppo-text-200',width:424,height:924,dpr:3,textScale:2}];
const labels={default:'Profile targets',training:'Training day',rest:'Rest day'};
declareProfiles(profiles);
const summaries=[];
for(const theme of ['dark','light']){
 const out=base+'/'+theme;
 try{await fs.access(out+'/cases.json');throw Error('Refusing to overwrite '+out);}catch(error){if(error.code!=='ENOENT')throw error;}
 await fs.mkdir(out,{recursive:true});
 const inventory={sourceHash:expectedSource,theme,scope:'All three originally planned Food dayType selected values, 200% text, widths320/424, both modes; actual-source targeted native proof.',expectedCaseCount:12,expectedNativeImageCount:12,profiles,expectedScreenStates:Object.keys(labels).flatMap(value=>profiles.flatMap(profile=>['popup','full'].map(mode=>({id:'daytype-'+value,profile:profile.id,mode}))))};
 try{const existing=JSON.parse(await fs.readFile(out+'/inventory.json','utf8'));assert.equal(existing.sourceHash,expectedSource);assert.deepEqual(existing.expectedScreenStates.map(c=>[c.id,c.profile,c.mode].join('|')).sort(),inventory.expectedScreenStates.map(c=>[c.id,c.profile,c.mode].join('|')).sort());}catch(error){if(error.code!=='ENOENT')throw error;}
 await fs.writeFile(out+'/inventory.json',JSON.stringify(inventory,null,2));
 const a=await createAudit('food-daytype-current-'+theme,{out,theme});const {page}=a,cdp=await a.context.newCDPSession(page);
 try{
  await a.boot({clearStorage:true});await act(page,'food-tools');await page.locator('#sheet [data-fs=settings]').click();
  for(const[value,label]of Object.entries(labels))for(const profile of profiles)for(const mode of ['popup','full']){
   console.log('Food dayType current:',theme,value,profile.id,mode);
   await view(page,cdp,profile,mode);
   const select=page.locator('#sheet [name=dayType]');await select.selectOption(value);await select.focus();await page.waitForTimeout(120);
   const selected=await select.evaluate(el=>{
    const s=getComputedStyle(el),canvas=document.createElement('canvas'),g=canvas.getContext('2d');g.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const label=el.selectedOptions[0].textContent,textWidth=g.measureText(label).width,contentWidth=el.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),available=contentWidth-22;
    return {selectedValue:el.value,selectedLabel:label,font:g.font,textWidth,controlContentWidth:contentWidth,textFitsContentBox:textWidth<=contentWidth+1,conservativeArrowAllowance:22,conservativeAvailableWidth:available,fullLabelFitsConservativeEstimate:textWidth<=available+1,optionValues:[...el.options].map(o=>o.value),optionLabels:[...el.options].map(o=>o.textContent)};
   });
   const c=await captureCase(a,cdp,{id:'daytype-'+value,profile,mode,expectedSource,selector:'[name=dayType]',meta:{theme,syntheticData:true,auditPhase:'actual-current-conditional-proof',...selected}});
   await a.check(`Food dayType ${value} retains its selected label and content-box room at ${profile.width}px, 200%, ${mode}, ${theme}`,async()=>{
    assertBaseCase(c);assert.equal(selected.selectedLabel,label);assert.deepEqual(selected.optionValues,['default','training','rest']);assert.deepEqual(selected.optionLabels,Object.values(labels));assert.equal(selected.textFitsContentBox,true,JSON.stringify(selected));assert.equal(c.focusedControl.aboveHeader,false);assert.equal(c.focusedControl.belowViewport,false);assert.equal(c.focusedControl.behindFooter,false);return selected;
   });
  }
  await clearText(page);await closeSheet(page);
  await a.check('All three Food dayType selected values cover both widths and modes on actual current source',async()=>{assert.equal(a.cases.length,12);assert.equal(await sourceFingerprint(),expectedSource);assert.deepEqual(a.errors,[]);assert.equal(a.writes.length,0);});
  await a.finish();const summary={theme,sourceHash:expectedSource,cases:a.cases.length,nativeImages:a.cases.length,checks:a.checks.length,status:'passed',limitations:'Synthetic actual-current Chromium proof; 320px is a stress viewport, 424px uses the native 1272×2772 panel.'};summaries.push(summary);await fs.writeFile(out+'/summary.json',JSON.stringify(summary,null,2));
 }catch(error){await a.saveResults();await a.browser.close();console.error(error);process.exitCode=1;break;}
}
await fs.mkdir(base,{recursive:true});await fs.writeFile(base+'/summary.json',JSON.stringify({sourceHash:expectedSource,expectedCases:24,results:summaries},null,2));
