import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createAudit,PROFILES,act,closeSheet,sourceFingerprint} from './harness.mjs';

const expectedSource=process.env.AUDIT_EXPECT_SOURCE;
if(!expectedSource)throw Error('Supply frozen AUDIT_EXPECT_SOURCE.');
const theme=process.env.AUDIT_THEME||'light';
const out=process.env.FOOD_AUDIT_OUT;
assert.ok(out,'Supply fresh FOOD_AUDIT_OUT.');
const a=await createAudit('food-conditional-'+theme+'-repairs',{out,theme});
const {page}=a;
const click=async name=>{await page.locator('#sheet [data-fs="'+name+'"]').first().click();};
const fresh=async mode=>{await closeSheet(page);await page.waitForFunction(()=>!document.querySelector('#sheet').open&&!document.querySelector('#sheet').innerHTML);await act(page,'food-tools');await page.locator('#sheet .fs-tools').waitFor();if(mode&&mode!=='hub')await click(mode);};
const snap=async name=>{assert.equal(await sourceFingerprint(),expectedSource,'Frozen source changed before '+name);console.log('Food current final:',name);await a.screen(name,{profiles:PROFILES,modes:['popup','full'],captureProfiles:['oppo','oppo-text-200'],meta:{theme,syntheticData:true,auditPhase:'post-repair-final',proofSourceHash:expectedSource,finalProofCandidate:true,coverage:'Nine representative Food states measured at all nine profiles and both sheet modes; every native and 200 percent text vertical screenshot segment captured'}});};
const contrasts=[];
async function contrast(label,selector,pseudo=null,opaque=false){
  if(theme==='dark'&&!opaque)return;
  const result=await page.locator(selector).first().evaluate((el,{pseudo,opaque})=>{
    const s=getComputedStyle(el,pseudo),parse=x=>x.match(/[\d.]+/g).map(Number),fg=parse(s.color),bg=parse(s.backgroundColor),lum=rgb=>rgb.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0),ratio=(x,y)=>(Math.max(lum(x),lum(y))+.05)/(Math.min(lum(x),lum(y))+.05);
    const bases=opaque?[[0,0,0],[255,255,255]]:[[243,245,250],[255,255,255]],alpha=bg[3]??1;
    const backgrounds=bases.map(base=>bg.slice(0,3).map((n,i)=>n*alpha+base[i]*(1-alpha)));
    return {foreground:s.color,background:s.backgroundColor,minContrast:Math.min(...backgrounds.map(back=>ratio(fg.slice(0,3),back)))};
  },{pseudo,opaque});
  contrasts.push({label,...result});assert.ok(result.minContrast>=4.5,label+' contrast '+result.minContrast);
}
try{
 await a.check('Food current representative run starts on the approved frozen source',async()=>assert.equal(await sourceFingerprint(),expectedSource));
 await a.boot({clearStorage:true});
 await a.check('saved theme preference reaches the actual app theme',async()=>{assert.equal(await page.locator('html').getAttribute('data-theme'),theme);assert.equal(await page.evaluate(()=>localStorage.getItem('cams-health-theme')),theme);});
 await fresh('hub');await snap('hub');await contrast('tool supporting text','.fs-tool small');
 await fresh('library');await click('portion');await page.locator('#sheet button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#form-error')?.textContent.includes('Connect'));await snap('portion-auth-required');await contrast('save error','.form-error');
 await fresh('library');await click('custom');await page.locator('[name=name]').fill('Synthetic pearl yoghurt');await page.locator('[name=source]').fill('Synthetic package label');for(const [name,value]of Object.entries({kcal:210,protein:24,carbs:15,fat:6}))await page.locator('[name='+name+']').fill(String(value));await snap('custom-filled');
 await fresh('recipes');await click('recipe-edit');await snap('recipe-edit');await contrast('recipe supporting text','.fs-intro .help');
 await fresh('hub');await click('barcode');await page.locator('[data-fs-barcode-input]').fill('123');await click('barcode-lookup');await snap('barcode-invalid');await contrast('barcode error/status','.fs-progress');
 await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,640,480);window.__foodLightStream=c.captureStream(15);navigator.mediaDevices.getUserMedia=async()=>window.__foodLightStream;});await click('barcode-camera');await page.locator('.fs-camera:not([hidden]) video').waitFor();await snap('camera-decoding-blank');await contrast('camera Stop over light/dark video','[data-fs=barcode-stop]',null,true);await click('barcode-stop');
 await a.check('synthetic live camera stops every track',async()=>assert.equal(await page.evaluate(()=>window.__foodLightStream.getTracks().every(t=>t.readyState==='ended')),true));
 await fresh('hub');await click('label');await page.locator('[data-fs-label-file]').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});await snap('label-file-type-error');await contrast('label progress/error','.fs-progress');await contrast('file picker action','[data-fs-label-file]','::file-selector-button');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1400;c.height=1000;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,c.width,c.height);g.fillStyle='black';g.font='56px Arial';['Nutrition per 100 g','Energy 320 kcal','Fat 8 g','Carbohydrates 40 g','Protein 22 g'].forEach((t,i)=>g.fillText(t,70,140+i*150));return c.toDataURL().split(',')[1];});
 await page.locator('[data-fs-label-file]').setInputFiles({name:'synthetic-label.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>document.querySelector('[data-fs-ocr-status]')?.textContent.includes('Numbers extracted'),{},{timeout:90000});await page.locator('.food-studio details:not(.inline-connect)').evaluate(el=>el.open=true);await snap('label-recognized-text');await contrast('recognized label text','textarea[data-fs-ocr-text]');
 await a.check('local OCR extracts known synthetic nutrition without confirming basis',async()=>{for(const [name,value]of Object.entries({kcal:'320',protein:'22',carbs:'40',fat:'8'}))assert.equal(await page.locator('[name='+name+']').inputValue(),value);assert.equal(await page.locator('[name=basisConfirmed]').isChecked(),false);});
 await fresh('patterns');await snap('patterns-mixed');await contrast('weekly supporting note','.fs-note');
 await fs.writeFile(a.out+'/contrast.json',JSON.stringify({phase:'post-repair-final',sourceHash:expectedSource,contrasts},null,2));
 await a.check('Food current representative captures match frozen source and requested theme',async()=>{assert.equal(await sourceFingerprint(),expectedSource);assert.ok(a.cases.every(c=>c.sourceHash===expectedSource&&!c.sourceChangedSinceBoot&&c.theme===theme&&c.requestedTheme===theme&&c.themeMatchesRequest));});
 await a.check('All nine Food representative states cover all nine profiles and both sheet modes',async()=>{assert.equal(new Set(a.cases.map(c=>c.id)).size,9);assert.equal(a.cases.length,162);assert.equal(new Set(a.cases.map(c=>c.profile)).size,9);});
 await a.check('Food current representative cases have no layout or capture violations',async()=>{const bad=a.cases.filter(c=>c.documentOverflow>2||c.sheetOverflow>2||c.clippedControls.length||c.offscreenControls.length||c.smallTargets.length||c.unnamedControls.length||c.verticallyClippedStickyControls.length||c.captureErrors?.length);assert.deepEqual(bad,[]);});
 await a.check('Sampled Food current text contrasts exceed 4.5 to 1',async()=>{assert.equal(contrasts.length,theme==='light'?9:1);assert.ok(contrasts.every(c=>c.minContrast>=4.5));return {probes:contrasts.length,minimum:Math.min(...contrasts.map(c=>c.minContrast))};});
 await a.check('Food current representative proof has no unhandled page errors or health writes',async()=>{assert.deepEqual(a.errors,[]);assert.equal(a.writes.length,0);});
 const summary={domain:'food-conditional-'+theme+'-repairs',theme,status:'passed',phase:'post-repair-final',sourceHash:expectedSource,states:new Set(a.cases.map(c=>c.id)).size,cases:a.cases.length,nativeImages:a.cases.reduce((n,c)=>n+(c.screenshots?.length||0),0),checks:a.checks,errors:a.errors,mockWrites:a.writes.length,contrastMinimum:Math.min(...contrasts.map(c=>c.minContrast)),limitations:'Synthetic GitHub-intercepted Chromium proof at CSS424×924@3, not a physical-phone or production capture.'};
 await fs.writeFile(a.out+'/summary.json',JSON.stringify(summary,null,2));
 console.log(JSON.stringify({summary,finish:await a.finish()},null,2));
}catch(error){console.error(error);await a.saveResults();await fs.writeFile(a.out+'/summary.json',JSON.stringify({phase:'post-repair-final',sourceHash:expectedSource,error:error.message,checks:a.checks,errors:a.errors,cases:a.cases.length},null,2));await a.browser.close();process.exitCode=1;}
