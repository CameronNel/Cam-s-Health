import fs from 'node:fs/promises';
import path from 'node:path';
import {createAudit,PROFILES,makeFixture,act,closeSheet,sourceFingerprint} from './harness.mjs';
import {BODY_METRICS} from '../../dist/body-studio-model.js';
import {BODY_FIELDS,METHODS} from '../../dist/body.js';

const out=process.env.AUDIT_BODY_OUTPUT||'/workspace/cams-health-layout-audit/body-final';
const expectedSource=process.env.AUDIT_EXPECT_SOURCE||null;
const sourceAtStart=await sourceFingerprint();
const nativeSweep=process.env.AUDIT_NATIVE_SWEEP==='1';
const phaseProfiles=nativeSweep?PROFILES.filter(p=>['oppo','oppo-text-200'].includes(p.id)):PROFILES;
const baseFixture=makeFixture('rich');
const expectedStates=buildExpectedStates(baseFixture);
await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'expected-states.json'),JSON.stringify({domain:'body',theme:process.env.AUDIT_THEME||'app preference',ids:expectedStates,profiles:PROFILES.map(p=>p.id),modes:['popup','full'],expectedGeometryCases:expectedStates.length*PROFILES.length*2,currentPhase:nativeSweep?(process.env.AUDIT_METRICS_ONLY==='1'?'primary-and-enlarged-geometry':'native-visual-sweep'):'all-profile-geometry',requestedPhaseProfiles:phaseProfiles.map(p=>p.id),expectedRequestedPhaseCases:expectedStates.length*phaseProfiles.length*2},null,2));
const a=await createAudit('body',{fixture:baseFixture,out});
const {page,context}=a;
const metrics=BODY_METRICS.map(([key])=>key),label=key=>BODY_METRICS.find(([k])=>key===k)?.[1]||key;
const main=PROFILES.filter(p=>(p.id||p.name)==='oppo'),text=PROFILES.filter(p=>['oppo','oppo-text-200'].includes(p.id||p.name));
const selected=process.env.AUDIT_BODY_FILTER?new RegExp(process.env.AUDIT_BODY_FILTER):null;
function buildExpectedStates(fixture){
 const keys=BODY_METRICS.map(([key])=>key),ids=['tracker-rich','home-rich','map-rich'];
 for(const unit of ['metric','imperial']){ids.push(...keys.map(k=>`measure-${unit}-${k}`),`full-checkin-${unit}-rich`,`full-checkin-${unit}-tape-expanded`,...keys.map(k=>`goals-${unit}-${k}`));}
 ids.push(...['lower-only','upper-only','band','clear'].map(s=>'goal-state-'+s),'measure-missing-authorization','measure-rejected-authorization','measure-value-error','goal-order-error','measure-save-conflict');
 for(const key of keys)ids.push(`trend-${key}-rich`,...['7','30','90','all'].map(range=>`trend-${key}-range-${range}`));
 for(const key of ['bodyFatPct','skeletalMuscleKg','waist'])ids.push(...['all',...METHODS].map(method=>`trend-${key}-method-${method.replaceAll(' ','-')}`));
 ids.push('trend-original-readings-expanded',...Object.keys(fixture.days).filter(d=>d<='2026-10-15'&&fixture.days[d].weightKg!=null).sort().map(d=>'original-point-'+d),'annotations-rich',...(fixture.tracker.body.annotations||[]).map(n=>'annotation-edit-'+n.id),'annotation-new','annotation-long-unbroken','annotation-delete-selected','comparison-rich','comparison-same-date','comparison-reversed-dates','comparison-missing-date','comparison-same-method');
 for(const unit of ['metric','imperial'])ids.push(`pairs-${unit}-rich`,`pairs-${unit}-missing`);
 ids.push(...['saved','all','none'].map(s=>'pins-'+s),...['default','granted','denied','unavailable'].map(s=>'reminders-permission-'+s),'reminders-all-days','reminders-no-days-error');
 ids.push(...['empty','format-expanded','unclosed-quote-error','oversize-error','mapping-imperial','new-preview','date-mapping-error','duplicate-mapping-error','no-measurement-mapping-error','identical-duplicate-preview','replacement-consent','replacement-approved','row-validation-errors','conflicting-duplicate-rows','long-header-mapping','long-note-preview','concurrent-field-conflict'].map(s=>'csv-'+s));
 ids.push('home-all-pinned','pairs-partial','comparison-unknown-method','trend-unspecified-method','point-long-original-notes','home-no-pins','point-no-original-notes',...['home','map','trend','compare','pairs','pins','annotations','reminders'].map(s=>s+'-empty'),...keys.map(k=>'measure-empty-'+k),'full-checkin-empty','measure-imperial-supported-boundary','goals-imperial-supported-boundary','trend-single-reading');
 return ids;
}
const routed=[];
const pixelPointDates=new Set();
function captureCase(id,meta){
 if(/^trend-.+-range-/.test(id))return /^trend-(weightKg|bodyFatPct)-range-(7|all)$/.test(id);
 if(/^trend-.+-method-/.test(id))return id.startsWith('trend-bodyFatPct-method-')&&['all','BIA scale','DEXA','Not specified'].includes(meta.method);
 if(id.startsWith('original-point-'))return pixelPointDates.has(meta.date);
 if(id.startsWith('measure-empty-'))return ['weightKg','bodyFatPct','skeletalMuscleKg','waist'].includes(meta.metric);
 return true;
}
function captureProfilesFor(id,meta){
 if(/^(measure|goals)-(metric|imperial)-/.test(id)||/^trend-.+-rich$/.test(id))return ['weightKg','bodyFatPct','skeletalMuscleKg','upperArmRight'].includes(meta.metric)?['oppo','oppo-text-200']:['oppo'];
 if(id.startsWith('comparison-')&&!['comparison-rich','comparison-missing-date','comparison-unknown-method'].includes(id))return ['oppo'];
 if(id.startsWith('pins-')&&id!=='pins-saved')return ['oppo'];
 if(id.startsWith('pairs-imperial-'))return ['oppo'];
 if(id.startsWith('reminders-')&&!['reminders-permission-default','reminders-permission-unavailable','reminders-no-days-error'].includes(id))return ['oppo'];
 if(['annotation-long-unbroken','annotation-delete-selected','trend-single-reading'].includes(id))return ['oppo'];
 if(id.startsWith('csv-')&&!['csv-format-expanded','csv-new-preview','csv-replacement-approved','csv-row-validation-errors','csv-long-header-mapping','csv-long-note-preview','csv-concurrent-field-conflict'].includes(id))return ['oppo'];
 return ['oppo','oppo-text-200'];
}
async function bs(action,values={}){await page.evaluate(({action,values})=>{const b=document.createElement('button');b.type='button';b.dataset.bs=action;Object.assign(b.dataset,values);document.body.append(b);b.click();b.remove();},{action,values});await page.waitForTimeout(25);}
async function screen(id,meta={},_profiles=PROFILES){routed.push({id,...meta});if(!selected||selected.test(id)){console.log('BODY '+id);await a.screen(id,{profiles:PROFILES,modes:['popup','full'],capture:captureCase(id,meta),captureProfiles:captureProfilesFor(id,meta),meta:{theme:await page.locator('html').getAttribute('data-theme'),directAction:'Actual delegated Body controller; temporary navigation button removed before capture',...meta}});}}
async function setUnits(value){await act(page,'settings');await page.locator(`[data-units="${value}"]`).click();}
async function loadFixture(kind='rich',transform){let fixture=makeFixture(kind);if(transform)transform(fixture);await a.setRemote(fixture);await a.boot();}
async function upload(text,name='measurements.csv'){await bs('import');await page.locator('[data-bs-change=import-file]').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(text)});await page.waitForTimeout(50);}
async function review(){await page.locator('[data-bs=import-review]').click();await page.waitForTimeout(25);}
async function fieldValue(selector,value){await page.locator(selector).fill(String(value));}
async function saveMock(){const inline=page.locator('.inline-connect');if(await inline.count()){await inline.evaluate(el=>el.open=true);await page.locator('[name=githubToken]').fill('local-layout-audit-only');}await page.locator('#sheet form button[type=submit]').last().click();}

try{
 if(expectedSource)await a.check('Body audit begins at the frozen production fingerprint',async()=>{if(await sourceFingerprint()!==expectedSource)throw Error('Production source differs from expected freeze.');});
 await a.boot();
 if(['light','dark'].includes(process.env.AUDIT_THEME)){await act(page,'settings');await page.locator('[data-theme-choice="'+process.env.AUDIT_THEME+'"]').click();await a.check('Actual Settings applies requested audit theme',async()=>{if(await page.locator('html').getAttribute('data-theme')!==process.env.AUDIT_THEME)throw Error('Audit theme did not apply.');});await closeSheet(page);}
 await a.check('Body widget tap and long press lead to actual compact popup',async()=>{await page.locator('.body-widget [data-peek=body]').click();await page.locator('[data-act=body-tools]').waitFor();if(!await page.locator('#sheet').evaluate(el=>el.open))throw Error('Body popup did not open');await closeSheet(page);const box=await page.locator('.body-widget [data-peek=body]').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+30);await page.mouse.down();await page.waitForTimeout(500);await page.mouse.up();await page.locator('[data-act=body-tools]').waitFor();if(await page.locator('#sheet').getAttribute('data-mode')!=='popup')throw Error('Long press did not retain popup');});
 await screen('tracker-rich',{route:'body-popup',fixture:'rich',entrypoint:'Visible Body widget button'});
 await a.check('Visible Body studio and quick weigh-in entrypoints work',async()=>{await page.locator('[data-act=quick-weigh]').click();await page.locator('.bs-measure-form').waitFor();await bs('home');});
 await screen('home-rich',{route:'home',fixture:'rich'});
 await bs('map');await screen('map-rich',{route:'map',fixture:'rich'});
 for(const [key,textLabel]of BODY_FIELDS){
   await a.check(`Map hotspot ${key} opens matching measurement`,async()=>{await bs('map');await page.locator(`.bs-hotspot[data-key="${key}"]`).click();if(!await page.locator('#sheet-title').innerText().then(t=>t===textLabel))throw Error('Wrong measurement form');});
   await a.check(`Map text alternative ${key} opens matching measurement`,async()=>{await bs('map');await page.locator(`.bs-landmarks [data-key="${key}"]`).click();await page.locator('.bs-measure-form').waitFor();});
 }
 await a.check('Map keyboard landmark activation opens measurement',async()=>{await bs('map');await page.locator('.bs-hotspot[data-key=waist]').focus();await page.keyboard.press('Enter');await page.locator('.bs-measure-form').waitFor();});
 for(const unit of ['metric','imperial']){
   await setUnits(unit);
   for(const key of metrics){await bs('measure',{key});await screen(`measure-${unit}-${key}`,{route:'measure',metric:key,units:unit,fixture:'rich'});}
   await act(page,'body-log');await screen(`full-checkin-${unit}-rich`,{route:'legacy-body-form',units:unit,fixture:'rich'});
   await page.locator('.measurement-fields').evaluate(el=>el.open=true);await screen(`full-checkin-${unit}-tape-expanded`,{route:'legacy-body-form',units:unit,state:'all tape fields expanded'});
   for(const key of metrics){await bs('goals',{key});await screen(`goals-${unit}-${key}`,{route:'goals',metric:key,units:unit,fixture:'rich'});}
 }
 await setUnits('metric');
 await a.check('Quick weigh-in performs a verified mock save and Undo restores it',async()=>{const before=a.remote.days['2026-10-15'].weightKg;await bs('weigh');await fieldValue('[name=reading]',before+.5);await saveMock();await page.waitForFunction(()=>!document.querySelector('#sheet').open);if(a.remote.days['2026-10-15'].weightKg!==before+.5)throw Error('Quick weigh-in did not persist');await act(page,'undo-save');await page.waitForFunction(()=>document.querySelector('#undo-dock').hidden);if(a.remote.days['2026-10-15'].weightKg!==before)throw Error('Undo did not restore reading');});
 // Distinct goal states and form errors include their actual save/auth footer.
 for(const [state,min,max]of [['lower-only','76',''],['upper-only','','80'],['band','76','80'],['clear','','']]){await bs('goals',{key:'weightKg'});await fieldValue('[name=min]',min);await fieldValue('[name=max]',max);await screen('goal-state-'+state,{route:'goals',state},text);}
 await a.boot();await bs('measure',{key:'weightKg'});await page.locator('#sheet form button[type=submit]').last().click();await screen('measure-missing-authorization',{route:'measure',state:'GitHub connection required; form retained'});
 await a.check('Quick weigh-in authorization feedback stays above the footer with the keyboard open',async()=>{await page.setViewportSize({width:424,height:924});await page.locator('[name=githubToken]').focus();await page.setViewportSize({width:424,height:500});await page.waitForTimeout(150);const r=await page.locator('#sheet').evaluate(sheet=>{const error=sheet.querySelector('#form-error').getBoundingClientRect(),footer=sheet.querySelector('.save-panel .form-actions,.form-actions.sticky-actions').getBoundingClientRect(),header=sheet.querySelector('.sheet-head').getBoundingClientRect(),token=sheet.querySelector('[name=githubToken]').getBoundingClientRect();return {error:{top:error.top,bottom:error.bottom},footerTop:footer.top,headerBottom:header.bottom,token:{top:token.top,bottom:token.bottom}};});if(r.error.top<r.headerBottom-1||r.error.bottom>r.footerTop+1)throw Error('Authorization feedback is obscured: '+JSON.stringify(r));await page.setViewportSize({width:424,height:924});});
 await a.setAuthFailure(true);await fieldValue('[name=reading]','82');await saveMock();await page.locator('#form-error').filter({hasText:'authorization'}).waitFor();await screen('measure-rejected-authorization',{route:'measure',state:'mock authorization rejected; field retained'},text);await a.setAuthFailure(false);
 await fieldValue('[name=reading]','10000');await saveMock();await page.locator('#form-error').filter({hasText:'supported range'}).waitFor();await screen('measure-value-error',{route:'measure',state:'out of range; error and authorization footer'},text);
 await bs('goals',{key:'weightKg'});await fieldValue('[name=min]','80');await fieldValue('[name=max]','70');await saveMock();await page.locator('#form-error').filter({hasText:'lower bound'}).waitFor();await screen('goal-order-error',{route:'goals',state:'lower bound above upper bound'},text);
 await bs('measure',{key:'waist'});await a.setSaveFailure({status:409});await fieldValue('[name=reading]','45');await saveMock();await page.locator('#form-error').filter({hasText:'GitHub rejected'}).waitFor();await screen('measure-save-conflict',{route:'measure',state:'GitHub conflict; field retained'},text);await a.setSaveFailure(null);
 for(const key of metrics){
   await bs('trend',{key});await screen(`trend-${key}-rich`,{route:'trend',metric:key,fixture:'rich'});
   for(const range of ['7','30','90','all']){await bs('range',{value:range});await screen(`trend-${key}-range-${range}`,{route:'trend',metric:key,range,fixture:'rich'},main);}
 }
 for(const key of ['bodyFatPct','skeletalMuscleKg','waist']){
   await bs('trend',{key});
   for(const method of ['all',...METHODS]){await page.locator('[data-bs-change=method]').selectOption(method);await screen(`trend-${key}-method-${method.replaceAll(' ','-')}`,{route:'trend',metric:key,method,fixture:'rich'},text);}
 }
 await bs('trend',{key:'weightKg'});await page.locator('[data-bs-change=method]').selectOption('all');await bs('range',{value:'all'});
 await page.locator('.bs-disclosure').first().evaluate(el=>el.open=true);await screen('trend-original-readings-expanded',{route:'trend',state:'all original readings expanded'});
 const dates=await page.locator('.bs-chart-point').evaluateAll(els=>els.map(el=>el.dataset.date));if(dates.length){pixelPointDates.add(dates[0]);pixelPointDates.add(dates.at(-1));}
 for(const date of dates){await bs('point',{date});await screen(`original-point-${date}`,{route:'point',date,fixture:'rich'},text);}
 await a.check('Dense chart pointer hit areas select the nearest visible reading',async()=>{for(const index of [1,2,3]){await bs('trend',{key:'weightKg'});await page.locator('[data-bs-change=method]').selectOption('all');await bs('range',{value:'all'});const dot=page.locator('.bs-chart-point').nth(index),expected=await dot.getAttribute('data-date'),visibleDot=dot.locator('.bs-point-dot');await visibleDot.scrollIntoViewIfNeeded();const r=await visibleDot.boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);if(await page.locator('[data-bs=measure]').getAttribute('data-date')!==expected)throw Error('An overlapping point intercepted '+expected);}});
 await a.check('Chart-note keyboard activation reaches original annotation',async()=>{await bs('trend',{key:'weightKg'});const note=page.locator('.bs-chart-note').first();if(await note.count()){await note.focus();await page.keyboard.press('Enter');await page.locator('[name=text]').waitFor();}});
 await bs('annotations');await screen('annotations-rich',{route:'annotations',fixture:'rich'});
 const annotationIds=await page.locator('[data-bs=annotation-edit]').evaluateAll(els=>els.map(el=>el.dataset.id));
 for(const id of annotationIds){await bs('annotation-edit',{id});await screen('annotation-edit-'+id,{route:'annotation',state:'edit',annotationId:id},text);}
 await a.check('Chart note create and delete verify mock GitHub writes',async()=>{const before=(a.remote.tracker.body.annotations||[]).length;await bs('annotation-new');await fieldValue('[name=text]','Synthetic layout audit context');await saveMock();await page.waitForFunction(()=>!document.querySelector('#sheet').open);if(a.remote.tracker.body.annotations.length!==before+1)throw Error('Chart note not created');const note=a.remote.tracker.body.annotations.at(-1);await bs('annotation-edit',{id:note.id});await page.locator('[name=remove]').check();await fieldValue('[name=text]','');if(!await page.locator('[name=text]').evaluate(el=>el.checkValidity()))throw Error('Cleared note blocks explicit deletion');await saveMock();await page.waitForFunction(()=>!document.querySelector('#sheet').open);if(a.remote.tracker.body.annotations.some(n=>n.id===note.id))throw Error('Chart note not deleted');});
 await bs('annotation-new');await screen('annotation-new',{route:'annotation',state:'new'});
 await fieldValue('[name=text]','A'.repeat(500));await screen('annotation-long-unbroken',{route:'annotation',state:'500-character unbroken text'},text);
 if(annotationIds.length){await bs('annotation-edit',{id:annotationIds[0]});await page.locator('[name=remove]').check();await screen('annotation-delete-selected',{route:'annotation',state:'delete selected'},text);}
 await bs('compare');await screen('comparison-rich',{route:'compare',fixture:'rich'});
 const available=Object.keys(a.remote.days).filter(d=>a.remote.days[d].body).sort();
 for(const [name,left,right] of [['same-date',available.at(-1),available.at(-1)],['reversed-dates',available.at(-1),available[0]],['missing-date','2026-09-01','2026-09-02']]){await bs('compare');await fieldValue('[data-bs-change=compare-a]',left);await fieldValue('[data-bs-change=compare-b]',right);await screen('comparison-'+name,{route:'compare',state:name},text);}
 await bs('compare');
 const sameMethodDates=available.filter(d=>a.remote.days[d].body.method==='BIA scale');if(sameMethodDates.length>1){await fieldValue('[data-bs-change=compare-a]',sameMethodDates[0]);await fieldValue('[data-bs-change=compare-b]',sameMethodDates.at(-1));await screen('comparison-same-method',{route:'compare',state:'two known matching BIA scale methods'},text);}
 for(const unit of ['metric','imperial']){await setUnits(unit);await bs('pairs');await screen(`pairs-${unit}-rich`,{route:'pairs',units:unit,fixture:'rich'});await fieldValue('[data-bs-change=pairs-date]','2026-09-01');await screen(`pairs-${unit}-missing`,{route:'pairs',units:unit,state:'no recorded readings'},text);}
 await setUnits('metric');
 for(const state of ['saved','all','none']){await bs('pins');if(state!=='saved')await page.locator('[name=pinned]').evaluateAll((els,checked)=>els.forEach(el=>{el.checked=checked;el.dispatchEvent(new Event('input',{bubbles:true}));}),state==='all');await screen('pins-'+state,{route:'pins',state});}
 for(const permission of ['default','granted','denied','unavailable']){
   await page.evaluate(permission=>{window.__bodyAuditNotification??=window.Notification;if(permission==='unavailable')Object.defineProperty(window,'Notification',{value:undefined,configurable:true});else{class NotificationStub{static get permission(){return permission;}static requestPermission(){return Promise.resolve(permission==='default'?'denied':permission);}}Object.defineProperty(window,'Notification',{value:NotificationStub,configurable:true});}},permission);
   await bs('reminders');await screen('reminders-permission-'+permission,{route:'reminders',notificationState:permission,platformBranch:'Notification capability simulated for deterministic branch coverage'});
   if(['denied','unavailable'].includes(permission))await a.check('Disabled '+permission+' notification control survives failed schedule save',async()=>{await page.locator('[name=weekday]').evaluateAll(els=>els.forEach(el=>el.checked=false));await saveMock();await page.locator('#form-error').filter({hasText:'Choose at least one'}).waitFor();if(!await page.locator('[data-bs=notification-permission]').isDisabled())throw Error('A failed save enabled the blocked notification action.');});
 }
 await page.evaluate(()=>Object.defineProperty(window,'Notification',{value:window.__bodyAuditNotification,configurable:true}));
 await bs('reminders');await page.locator('[name=enabled]').check();await page.locator('[name=weekday]').evaluateAll(els=>els.forEach(el=>el.checked=true));await screen('reminders-all-days',{route:'reminders',state:'all days enabled'});
 await a.check('Weekday schedule targets remain at least 44 pixels at 320 CSS pixels',async()=>{await page.setViewportSize({width:320,height:568});const bounds=await page.locator('.bs-weekdays label').evaluateAll(els=>els.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));if(bounds.some(r=>r.width<43.5||r.height<43.5))throw Error('Small weekday target '+JSON.stringify(bounds));await page.setViewportSize({width:424,height:924});});
 await a.check('Calendar reminder downloads valid Amsterdam recurring ICS',async()=>{const pending=page.waitForEvent('download');await page.locator('[data-bs=calendar-download]').click();const download=await pending;await download.saveAs(path.join(out,'check-in.ics'));const content=await fs.readFile(path.join(out,'check-in.ics'),'utf8');if(!content.includes('TZID:Europe/Amsterdam')||!content.includes('RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA'))throw Error('Incorrect recurrence/timezone');});
 await page.locator('[name=weekday]').evaluateAll(els=>els.forEach(el=>el.checked=false));await bs('calendar-download');await screen('reminders-no-days-error',{route:'reminders',state:'calendar has no selected weekdays'},text);
 await bs('import');await screen('csv-empty',{route:'import',state:'no file'});
 await page.locator('.bs-disclosure').evaluate(el=>el.open=true);await screen('csv-format-expanded',{route:'import',state:'supported format open'},text);
 await upload('date,weightKg\n2026-10-15,"80');await screen('csv-unclosed-quote-error',{route:'import',state:'malformed CSV'},text);
 await bs('import');await page.locator('[type=file]').setInputFiles({name:'oversize.csv',mimeType:'text/csv',buffer:Buffer.alloc(350001,65)});await screen('csv-oversize-error',{route:'import',state:'oversize file'},text);
 await upload('date,weightLb,waistIn,notes\n2026-10-16,176.4,33.4,"New check-in, relaxed"');await screen('csv-mapping-imperial',{route:'import',state:'explicit imperial mapping'});
 await review();await screen('csv-new-preview',{route:'import',state:'new readings preview'});
 await upload('date,weightKg,waistCm\n2026-10-16,80,85');await page.locator('[data-bs-change=import-map][data-index="0"]').selectOption('');await review();await screen('csv-date-mapping-error',{route:'import',state:'no mapped date'},text);
 await page.locator('[data-bs-change=import-map][data-index="0"]').selectOption('date');await page.locator('[data-bs-change=import-map][data-index="2"]').selectOption('weightKg');await review();await screen('csv-duplicate-mapping-error',{route:'import',state:'two columns mapped to weight'},text);
 await page.locator('[data-bs-change=import-map][data-index="1"]').selectOption('');await page.locator('[data-bs-change=import-map][data-index="2"]').selectOption('');await review();await screen('csv-no-measurement-mapping-error',{route:'import',state:'no measurement selected'},text);
 const knownDate=Object.keys(a.remote.days).filter(d=>a.remote.days[d].weightKg!=null).sort().at(-1),knownWeight=a.remote.days[knownDate].weightKg;
 await upload(`date,weightKg\n${knownDate},${knownWeight}`);await review();await screen('csv-identical-duplicate-preview',{route:'import',state:'exact existing reading skipped'});
 await upload(`date,weightKg\n${knownDate},${knownWeight+1}`);await review();await screen('csv-replacement-consent',{route:'import',state:'replaces recorded value with explicit consent'});
 await page.locator('[name=replace]').check();await screen('csv-replacement-approved',{route:'import',state:'replacement checked'},text);
 await upload('date,weightKg,bodyFatPct,method,skeletalMuscleKg\n2026-02-30,80,20,BIA scale,\n2026-10-16,-1,20,BIA scale,\n2026-10-17,80,20,Unknown scale,\n2026-10-18,70,20,BIA scale,80');await review();await screen('csv-row-validation-errors',{route:'import',state:'invalid date, negative reading, unknown method, muscle above weight'});
 await upload('date,weightKg\n2026-10-16,80\n2026-10-16,81');await review();await screen('csv-conflicting-duplicate-rows',{route:'import',state:'same date/field different values'},text);
 await upload(`date,weightKg,notes,${'Unbroken_header_'.repeat(12)}\n2026-10-16,80,${'X'.repeat(4500)},ignored`,'A_very_long_filename_with_a_date_and_export_'.repeat(4)+'.csv');await screen('csv-long-header-mapping',{route:'import',state:'long unbroken header and filename'});
 await review();await screen('csv-long-note-preview',{route:'import',state:'4500-character unbroken import note'});
 // Import mutation paths use the validated mock GitHub endpoint exclusively.
 await upload(`date,weightKg\n${knownDate},${knownWeight+2}`);await review();await page.locator('[name=replace]').check();const changed=structuredClone(a.remote);changed.days[knownDate].weightKg=knownWeight+3;await a.setRemote(changed);await saveMock();await page.locator('#form-error').filter({hasText:'changed elsewhere'}).waitFor();await screen('csv-concurrent-field-conflict',{route:'import',state:'record changed after preview; no overwrite'},text);
 await loadFixture('rich',fixture=>{fixture.tracker.body.pinned=metrics;for(const [k,day]of Object.entries(fixture.days))if(['2026-10-14','2026-10-15'].includes(k)){day.body.method='Not specified';day.body.measurementsCm.upperArmRight=null;day.body.notes='N'.repeat(4900);}});
 await bs('home');await screen('home-all-pinned',{route:'home',state:'all 16 metrics pinned'});await bs('pairs');await screen('pairs-partial',{route:'pairs',state:'left upper arm recorded, right unknown'});await bs('compare');await fieldValue('[data-bs-change=compare-a]','2026-10-15');await fieldValue('[data-bs-change=compare-b]','2026-10-14');await screen('comparison-unknown-method',{route:'compare',state:'two distinct dates with unspecified methods'},text);await bs('trend',{key:'bodyFatPct'});await screen('trend-unspecified-method',{route:'trend',state:'unknown method remains an unconnected point'},text);await bs('point',{date:'2026-10-15'});await screen('point-long-original-notes',{route:'point',state:'4900-character unbroken original notes'});
 await loadFixture('rich',fixture=>{fixture.tracker.body.pinned=[];});await bs('home');await screen('home-no-pins',{route:'home',state:'no metrics pinned'});
 await a.check('Reviewed new CSV reading saves through validated mock GitHub',async()=>{await upload('date,weightKg,waistCm\n2026-10-16,80,85');await review();await saveMock();await page.waitForFunction(()=>!document.querySelector('#sheet').open);if(a.remote.days['2026-10-16']?.weightKg!==80||a.remote.days['2026-10-16']?.body?.measurementsCm?.waist!==85)throw Error('CSV save incomplete');});
 await loadFixture('rich',fixture=>{fixture.days['2026-10-15'].body.notes='';delete fixture.days['2026-10-15'].body.recordedAt;fixture.tracker.body.annotations=[];});await bs('trend',{key:'weightKg'});await bs('point',{date:'2026-10-15'});await screen('point-no-original-notes',{route:'point',state:'no original notes, no recorded-at timestamp, no chart annotation'});
 // Fresh empty data verifies every form stays genuinely blank.
 await loadFixture('empty');
 for(const route of ['home','map','trend','compare','pairs','pins','annotations','reminders']){await bs(route);await screen(route+'-empty',{route,fixture:'empty'});}
 for(const key of metrics){await bs('measure',{key});await screen('measure-empty-'+key,{route:'measure',metric:key,fixture:'empty'},text);}
 await act(page,'body-log');await screen('full-checkin-empty',{route:'legacy-body-form',fixture:'empty'});
 await loadFixture('rich',fixture=>{const d=fixture.days['2026-10-15'];d.weightKg=500;d.body.bodyFatPct=99.9;d.body.skeletalMuscleKg=300;d.body.measurementsCm=Object.fromEntries(BODY_FIELDS.map(([key])=>[key,400]));fixture.tracker.body.goals.weightKg={min:490,max:500};});await setUnits('imperial');await bs('measure',{key:'weightKg'});await screen('measure-imperial-supported-boundary',{route:'measure',state:'500 kg displayed in lb without invalid grouping',units:'imperial'});await a.check('Supported imperial weight boundary remains a valid numeric input',async()=>{if(await page.locator('[name=reading]').inputValue()!=='1102.31'||!await page.locator('[name=reading]').evaluate(el=>el.checkValidity()))throw Error('Pounds field was emptied or invalidated by numeric grouping');});await bs('goals',{key:'weightKg'});await screen('goals-imperial-supported-boundary',{route:'goals',state:'490–500 kg goal shown in lb',units:'imperial'});await a.check('Imperial goal bounds remain valid plain numeric strings',async()=>{const values=await page.locator('[name=min],[name=max]').evaluateAll(els=>els.map(el=>({value:el.value,valid:el.checkValidity()})));if(values.some(x=>!x.value||!x.valid))throw Error('Invalid imperial goal inputs '+JSON.stringify(values));});
 // A single reading is one point, with neither extrapolation nor fake gaps.
 await loadFixture('rich',fixture=>{const d=Object.keys(fixture.days).filter(d=>fixture.days[d].weightKg!=null).sort().at(-1);fixture.days={[d]:fixture.days[d]};});
 await bs('trend',{key:'weightKg'});await screen('trend-single-reading',{route:'trend',fixture:'single reading'});
 await a.check('Single reading is represented by exactly one actual point',async()=>{if(await page.locator('.bs-chart-point').count()!==1)throw Error('Single reading manufactured additional points');});
 await fs.writeFile(path.join(out,'routes.json'),JSON.stringify(routed,null,2));
 await a.check('Every declared Body state has the requested phase profiles in both modes',async()=>{const found=new Set(a.cases.map(c=>c.id)),missing=expectedStates.filter(id=>!found.has(id)),extra=[...found].filter(id=>!expectedStates.includes(id));if(missing.length||extra.length)throw Error('State coverage mismatch '+JSON.stringify({missing,extra}));for(const id of expectedStates){const rows=a.cases.filter(c=>c.id===id),matrix=new Set(rows.map(c=>c.profile+'/'+c.mode)),required=phaseProfiles.flatMap(p=>['popup','full'].map(mode=>p.id+'/'+mode));if(matrix.size!==rows.length||required.some(key=>!matrix.has(key))||(!nativeSweep&&rows.length!==PROFILES.length*2))throw Error(id+' has '+rows.length+' cases and '+matrix.size+' unique profile/modes; requested '+required.length+'.');}});
 await a.check('Body final geometry and capture ledger contains no clipping or stale source',async()=>{const bad=a.cases.filter(c=>c.documentOverflow>2||c.sheetOverflow>2||c.smallTargets.length||c.clippedControls.length||c.offscreenControls.length||c.unnamedControls.length||(c.verticallyClippedStickyControls||[]).some(control=>!control.inactiveForm)||(c.captureErrors||[]).length||c.sourceChangedSinceBoot||(expectedSource&&c.sourceHash!==expectedSource));if(bad.length)throw Error('Review '+bad.length+' geometry, capture or source cases; see cases.json.');});
}finally{
 const issues=a.cases.filter(c=>c.documentOverflow>2||c.sheetOverflow>2||c.smallTargets.length||c.clippedControls.length||c.offscreenControls.length||c.unnamedControls.length||(c.verticallyClippedStickyControls||[]).some(control=>!control.inactiveForm)||(c.captureErrors||[]).length);
 await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({domain:'body',sourceAtStart,sourceAtFinish:await sourceFingerprint(),phase:nativeSweep?(process.env.AUDIT_METRICS_ONLY==='1'?'primary-and-enlarged-geometry':'native-visual-sweep'):'all-profile-geometry',requestedPhaseProfiles:phaseProfiles.map(p=>p.id),completedAt:new Date().toISOString(),sourceHashes:[...new Set(a.cases.map(c=>c.sourceHash))],sourceChangedCases:a.cases.filter(c=>c.sourceChangedSinceBoot).length,screenStates:[...new Set(a.cases.map(c=>c.id))].length,geometryCases:a.cases.length,profiles:[...new Set(a.cases.map(c=>c.profile))],modes:[...new Set(a.cases.map(c=>c.mode))],checks:a.checks.length,uniqueChecks:new Set(a.checks.map(c=>c.name)).size,failedChecks:a.checks.filter(c=>!c.pass),runtimeErrors:a.errors,inactiveBelowFoldFormCases:a.cases.filter(c=>(c.verticallyClippedStickyControls||[]).some(control=>control.inactiveForm)).map(c=>({id:c.id,profile:c.profile,mode:c.mode,controls:c.verticallyClippedStickyControls.filter(control=>control.inactiveForm)})),layoutIssueCases:issues.map(c=>({id:c.id,profile:c.profile,mode:c.mode,documentOverflow:c.documentOverflow,sheetOverflow:c.sheetOverflow,smallTargets:c.smallTargets,clippedControls:c.clippedControls,offscreenControls:c.offscreenControls,unnamedControls:c.unnamedControls,verticallyClippedStickyControls:c.verticallyClippedStickyControls||[],captureErrors:c.captureErrors||[]})),mockWrites:a.writes.map(w=>w.message),remoteSafety:'All GitHub requests intercepted by the shared audit harness; no real health records written.',limitations:'Chromium emulation of documented CSS viewport, DPR, text scaling and keyboard geometry; not a capture from a physical OPPO device.'},null,2));
 console.log(JSON.stringify(await a.finish()));
}
