/** Fresh layout and interaction coverage for the home shell and retained tracker views. */
import {createAudit,PROFILES,makeFixture,act as delegatedAct,closeSheet} from './harness.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const runFile=promisify(execFile);
const a=await createAudit('shell',{fixture:makeFixture('rich'),out:process.env.AUDIT_SHELL_OUT});
const {page,context}=a;let completed=false;
const onlyIds=new Set((process.env.AUDIT_SHELL_ONLY_IDS||'').split(',').map(id=>id.trim()).filter(Boolean));
if(onlyIds.size){const screen=a.screen;a.screen=(id,options={})=>onlyIds.has(id)?screen(id,options):Promise.resolve();}
const originalBoot=a.boot;a.boot=async options=>{page.setDefaultTimeout(30000);try{return await originalBoot(options);}finally{page.setDefaultTimeout(15000);}};
if(process.env.AUDIT_SHELL_METRICS_ONLY){const screen=a.screen;a.screen=(id,options={})=>screen(id,{...options,capture:false});}
const auditCheck=a.check;a.check=async(name,fn)=>{try{return await auditCheck(name,fn);}catch(error){console.error('AUDIT CASE FAILED:',name,error.message);}};
const profileIds=['oppo','oppo-landscape','oppo-text-200'];
const homeProfiles=PROFILES.filter(p=>profileIds.includes(p.id));
const key='cams-health-shell-v1',draftKey='cams-health-drafts-v1';
const sleep=ms=>page.waitForTimeout(ms);
async function act(p,action,attributes={}){const inside=p.locator('#sheet[open] [data-act="'+action+'"]').first(),open=await p.locator('#sheet').count()&&await p.locator('#sheet').evaluate(e=>e.open),button=await inside.count()?inside:!open?p.locator('[data-act="'+action+'"]').first():null;if(!Object.keys(attributes).length&&button&&await button.count()){await button.evaluate(e=>e.click());await sleep(35);}else await delegatedAct(p,action,attributes);}
async function fresh(){if(await page.locator('#sheet').count())await closeSheet(page,{discard:true});try{await a.boot();}catch(error){console.error('BOOT DIAGNOSTICS',await page.locator('body').innerText(),await page.evaluate(()=>[...document.scripts].map(s=>s.src)));throw error;}await closeSheet(page,{discard:true});}
async function view(id,open,{modes=['popup','full'],capture=true,meta={}}={}){
 if(onlyIds.size&&!onlyIds.has(id))return;
 await a.check('Open '+id,async()=>{await fresh();await open();if(!await page.locator('#sheet').evaluate(e=>e.open))throw Error('The intended '+id+' dialog did not open');await a.screen(id,{profiles:PROFILES,modes,capture,meta});});
}
async function settings(){await act(page,'settings');}
async function selectMain(kind,full=false){await page.locator('[data-peek="'+kind+'"]').click();if(full&&await page.locator('#sheet').getAttribute('data-mode')!=='full')await act(page,'expand-sheet');}
async function applyHome(prefs){await page.evaluate(async value=>{if(!window.auditShell){const {createTrackerShell}=await import('/tracker-shell.js');window.auditShell=createTrackerShell({storage:{getItem:()=>null,setItem:()=>{}},document,window});}window.auditShell.setPreferences(value);window.auditShell.apply(document.querySelector('#app'));},prefs);}
function permutations(list){return list.length===1?[list]:list.flatMap((item,i)=>permutations(list.filter((_,n)=>n!==i)).map(rest=>[item,...rest]));}
async function buildContacts(){
 const folder=path.join(a.out,'contacts');await fs.mkdir(folder,{recursive:true});const pictures=a.cases.flatMap(c=>(c.screenshots||[]).map(file=>({file,id:c.id,profile:c.profile,mode:c.mode,sourceHash:c.sourceHash})));const unique=[...new Map(pictures.map(p=>[p.file,p])).values()];const thumbs=[];
 for(const [i,picture] of unique.entries()){const number=String(i+1).padStart(3,'0'),thumb=path.join(folder,'thumb-'+number+'.png'),label=number+' '+picture.id.slice(0,31)+'\n'+picture.profile+' '+picture.mode+' '+picture.file.split('--').at(-1).replace('.png','');await runFile('convert',[path.join(a.out,picture.file),'-thumbnail','180x392','-background','#101218','-gravity','North','-extent','196x434','-font','DejaVu-Sans','-fill','#dedcea','-pointsize','9','-gravity','South','-annotate','+0+5',label,thumb]);thumbs.push(thumb);}
 const pages=[];for(let i=0;i<thumbs.length;i+=20){const output=path.join(folder,'contact-'+String(pages.length+1).padStart(2,'0')+'.png');await runFile('montage',[...thumbs.slice(i,i+20),'-tile','4x5','-geometry','+6+6','-background','#080a0e',output]);pages.push(output);}
 await fs.writeFile(path.join(folder,'index.json'),JSON.stringify({images:unique.map((p,i)=>({index:i+1,...p})),pages},null,2));console.log('CONTACT SHEETS',pages.length,'pages for',unique.length,'native screenshots');
}

try{
 await fresh();
 await a.screen('home-default',{profiles:PROFILES,modes:['page'],capture:true,meta:{fixture:'rich',note:'OPPO 424×924 CSS at DPR 3, derived from the official panel; browser emulation only.'}});
 await view('tracker-food',()=>selectMain('food'));
 await view('tracker-body',()=>selectMain('body'));
 await view('tracker-workouts',()=>selectMain('workouts'));
 await view('prescribed-workout-details',async()=>{await selectMain('workouts',true);await page.locator('[data-workout]').first().click();});
 await view('settings',settings);
 await view('settings-imperial',async()=>{await settings();await page.locator('[data-units=imperial]').click();});
 await view('appearance-default',async()=>{await settings();await act(page,'appearance');});
 await view('appearance-size-and-contrast',async()=>{await settings();await act(page,'appearance');await page.locator('[data-shell-palette=champagne]').click();await page.locator('[data-shell-density=compact]').click();await page.locator('[data-shell-size=body][data-size=large]').click();await page.locator('[data-shell-move=workouts][data-direction="-1"]').click();await page.locator('[data-shell-clarity]').fill('100');await page.locator('[data-shell-clarity]').dispatchEvent('input');});
 await page.evaluate(k=>localStorage.removeItem(k),key);
 await view('drafts-empty',async()=>{await page.evaluate(k=>localStorage.removeItem(k),draftKey);await a.boot();await settings();await act(page,'drafts');});
 const sampleDrafts=Array.from({length:8},(_,i)=>({key:'audit-food-'+i+':form',title:i?'An unfinished body check-in with a longer descriptive label':'Food entry · extremelylongunbrokenfooddescriptionforthewrappingaudit',date:'2026-10-15',route:{type:'food',date:'2026-10-15',units:'metric'},fields:[{name:'name',index:0,type:'text',value:'Recovered lunch with a long description'},{name:'quantity',index:0,type:'text',value:'180 g'}],updatedAt:Date.now()-i*3600000}));
 async function seedDrafts(){await page.evaluate(([k,v])=>localStorage.setItem(k,JSON.stringify(v)),[draftKey,sampleDrafts]);await a.boot();}
 await view('drafts-populated',async()=>{await seedDrafts();await settings();await act(page,'drafts');});
 await view('drafts-remove-entry',async()=>{await seedDrafts();await settings();await act(page,'drafts');await page.locator('[data-shell-remove-draft]').first().click();});
 await view('drafts-with-live-session',async()=>{await seedDrafts();await page.evaluate(async record=>{const {createSessionDraft}=await import('/workout-studio-model.js');const session=record.training.sessions.find(s=>s.exercises.length);const draft=createSessionDraft(record,session.id,'2026-10-15',()=>crypto.randomUUID());draft.name='A live strength session with a long descriptive name, waiting for the next set';localStorage.setItem('cams-health-workout-draft-v1',JSON.stringify(draft));},a.remote);await a.boot();await settings();await act(page,'drafts');});
 await page.evaluate(()=>localStorage.removeItem('cams-health-workout-draft-v1'));
 await view('draft-restore-offer',async()=>{await seedDrafts();await settings();await act(page,'drafts');await page.locator('[data-shell-open-draft]').first().click();});
 await view('draft-recovery-remove',async()=>{await seedDrafts();await settings();await act(page,'drafts');await page.locator('[data-shell-open-draft]').first().click();await page.locator('[data-discard-draft]').click();});
 await view('draft-restored-form',async()=>{await seedDrafts();await settings();await act(page,'drafts');await page.locator('[data-shell-open-draft]').first().click();await page.locator('[data-restore-draft]').click();});
 await view('targets-profile',async()=>{await settings();await act(page,'targets');});
 await view('connect-read-only',async()=>{await settings();await act(page,'connect');});
 await view('connect-invalid-token',async()=>{a.setAuthFailure(true);await settings();await act(page,'connect');await page.locator('#connect-form [name=token]').fill('audit-not-a-real-token');await page.locator('#connect-form button[type=submit]').click();await sleep(200);});
 a.setAuthFailure(false);
 await view('sync-diagnostics',async()=>{await settings();await act(page,'sync-info');});
 await view('installation-help',async()=>{await settings();await page.locator('[data-life=install-app]').click();});
 await view('app-update-confirmation',async()=>{await settings();await page.evaluate(()=>{const b=document.createElement('button');b.dataset.life='app-update';document.body.append(b);b.click();b.remove();});});
 await view('quick-log',()=>act(page,'quick'));
 await view('legacy-food-new',()=>act(page,'food-log'));
 await view('legacy-food-inline-auth',async()=>{await act(page,'food-log');await page.locator('.inline-connect').evaluate(e=>e.open=true);});
 await view('legacy-food-save-error',async()=>{await act(page,'food-log');await page.locator('[name=name]').fill('An intentionally unsaved audit food');await page.locator('[name=quantity]').fill('180 g');await page.locator('form button[type=submit]').click();});
 await view('legacy-food-discard-confirmation',async()=>{await act(page,'food-log');await page.locator('[name=name]').fill('A local unsaved audit draft');await act(page,'close-sheet');});
 await view('legacy-food-detail',async()=>{await selectMain('food',true);await page.locator('[data-food]').first().click();});
 await view('legacy-food-repeat',async()=>{await selectMain('food',true);await page.locator('[data-food]').first().click();await act(page,'food-repeat');});
 await view('legacy-food-edit',async()=>{await selectMain('food',true);await page.locator('[data-food]').first().click();await act(page,'food-edit');});
 await view('legacy-food-delete',async()=>{await selectMain('food',true);await page.locator('[data-food]').first().click();await act(page,'food-edit');await act(page,'food-delete');});
 await view('legacy-recipe-portion',async()=>{await selectMain('food',true);await page.locator('[data-recipe]').first().click();});
 await view('body-check-in',()=>act(page,'body-log'));
 await view('body-check-in-all-fields',async()=>{await act(page,'body-log');await page.locator('.measurement-fields').evaluate(e=>e.open=true);});
 await view('workout-log-custom',()=>act(page,'workout-log'));
 await view('workout-log-prescribed',async()=>{await act(page,'workout-log');await page.locator('#session-select').selectOption(a.remote.training.sessions.find(s=>s.exercises.length).id);});
 await view('workout-log-rest',async()=>{await act(page,'workout-log');await page.locator('#session-select').selectOption('rest');});
 await view('workout-log-custom-long-exercises',async()=>{await act(page,'workout-log');await page.locator('#session-select').selectOption('custom');await page.locator('[name=name]').fill('An unusually long named strength and conditioning workout to test wrapping');await page.locator('.measurement-fields').evaluate(e=>e.open=true);for(let i=0;i<4;i++){await act(page,'add-exercise');await page.locator('[name=exerciseName]').last().fill('Unbrokenlongmovementnameforlayoutauditandperformancehistory');}});
 await a.check('Four consecutive Add exercise buttons work with a normal pointer and the sticky footer stays visible',async()=>{await fresh();await act(page,'workout-log');await page.locator('#session-select').selectOption('custom');await page.locator('.measurement-fields').evaluate(e=>e.open=true);const add=page.locator('#sheet [data-act=add-exercise]');for(let i=0;i<4;i++){await add.scrollIntoViewIfNeeded();await add.click();await page.locator('[name=exerciseName]').last().fill('Pointer audit movement '+(i+1));}const count=await page.locator('[name=exerciseName]').count();if(count!==4)throw Error('Expected four actual exercise rows');const clipped=await page.locator('#sheet').evaluate(sheet=>{const bounds=sheet.getBoundingClientRect();return [...sheet.querySelectorAll('.sticky-actions button')].filter(button=>{const r=button.getBoundingClientRect();return r.top<bounds.top-1||r.bottom>bounds.bottom+1;}).map(button=>button.textContent.trim());});if(clipped.length)throw Error('Sticky action clipped: '+clipped.join(', '));return {rows:count,stickyActionsFullyVisible:true};});
 await view('recorded-workout-summary',async()=>{await selectMain('workouts',true);await page.locator('[data-record]').first().click();});
 await view('recorded-workout-edit',async()=>{await selectMain('workouts',true);await page.locator('[data-record]').first().click();await act(page,'workout-edit');});
 await view('recorded-workout-delete',async()=>{await selectMain('workouts',true);await page.locator('[data-record]').first().click();await act(page,'workout-edit');await act(page,'workout-delete');});
 await view('legacy-health-history',()=>act(page,'history'),{meta:{legacyDirectAction:true}});
 await view('daily-brief',()=>act(page,'brief'),{meta:{legacyDirectAction:true}});
 await view('daily-brief-copy-fallback',async()=>{await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Synthetic clipboard denial'))}}));await act(page,'brief');await act(page,'copy-brief');});
 await view('rest-timer-idle',()=>act(page,'timer'),{meta:{legacyDirectAction:true}});
 await view('rest-timer-active',async()=>{await act(page,'timer');await page.locator('[data-seconds="120"]').click();});
 await view('rest-timer-paused',async()=>{await act(page,'timer');await page.locator('[data-seconds="120"]').click();await act(page,'timer-pause');});
 await a.check('Export health data is a local JSON download',async()=>{await fresh();await settings();const event=page.waitForEvent('download');await act(page,'export');const download=await event;if(!download.suggestedFilename().endsWith('.json'))throw Error('Unexpected export format');});
 await a.check('Body CSV export remains local',async()=>{await fresh();await selectMain('body',true);const event=page.waitForEvent('download');await act(page,'body-export');const download=await event;if(!download.suggestedFilename().endsWith('.csv'))throw Error('Unexpected body export format');});
 await a.check('Offline cached home and diagnostics remain readable',async()=>{await fresh();await context.setOffline(true);await page.evaluate(()=>dispatchEvent(new Event('offline')));await a.screen('offline-home',{profiles:PROFILES,modes:['page'],capture:true});await act(page,'sync-info');await a.screen('offline-diagnostics',{profiles:PROFILES,modes:['popup','full'],capture:true});await context.setOffline(false);});
 await a.check('Update page and offline error',async()=>{await context.setOffline(false);await page.goto('http://localhost:5173/update.html');await a.screen('update-page',{profiles:PROFILES,modes:['page'],capture:true});await context.setOffline(true);await page.locator('#check').click();await a.screen('update-offline-error',{profiles:PROFILES,modes:['page'],capture:true});await context.setOffline(false);});
 await a.check('Empty data states',async()=>{a.setRemote(makeFixture('empty'));await fresh();await a.screen('empty-home',{profiles:PROFILES,modes:['page'],capture:true});await act(page,'history');await a.screen('empty-history',{profiles:PROFILES,modes:['popup','full'],capture:true});for(const kind of ['food','body','workouts']){await closeSheet(page,{discard:true});await selectMain(kind);await a.screen('tracker-'+kind+'-empty',{profiles:PROFILES,modes:['popup','full'],capture:true,meta:{fixture:'empty'}});}});
 a.setRemote(makeFixture('rich'));await page.evaluate(()=>localStorage.setItem('cams-health-units','metric'));await fresh();
 const sizes=['small','standard','large'];let combo=0;
 if(!process.env.AUDIT_SHELL_SKIP_COMBOS)for(const order of permutations(['food','body','workouts']))for(const food of sizes)for(const body of sizes)for(const workouts of sizes)for(const density of ['compact','detailed']){
  const prefs={order,sizes:{food,body,workouts},density,palette:'opal',clarity:35};await applyHome(prefs);
  await a.screen('home-combination-'+String(++combo).padStart(3,'0'),{profiles:homeProfiles,modes:['page'],capture:false,meta:prefs,settle:0});
 }
 await a.check('All home arrangements retain exactly three trackers',async()=>{if(await page.locator('.widget-grid>.health-widget').count()!==3)throw Error('Unexpected tracker count');});
 for(const [id,prefs] of [['home-small-compact',{order:['food','body','workouts'],sizes:{food:'small',body:'small',workouts:'small'},density:'compact',palette:'opal',clarity:35}],['home-large-detailed',{order:['food','body','workouts'],sizes:{food:'large',body:'large',workouts:'large'},density:'detailed',palette:'opal',clarity:35}],['home-mixed-reordered',{order:['body','workouts','food'],sizes:{food:'small',body:'standard',workouts:'large'},density:'detailed',palette:'ice',clarity:50}]]){await applyHome(prefs);await a.screen(id,{profiles:PROFILES,modes:['page'],capture:true,meta:prefs});}
 for(const palette of ['silver','ice','champagne','opal'])for(const clarity of [0,100]){
  const prefs={order:['food','body','workouts'],sizes:{food:'standard',body:'standard',workouts:'standard'},density:'detailed',palette,clarity};await applyHome(prefs);
  await a.screen('home-'+palette+'-clarity-'+clarity,{profiles:PROFILES,modes:['page'],capture:true,meta:prefs});
 }
 await page.evaluate(()=>window.auditShell?.dispose());
 completed=true;
}finally{await context.setOffline(false).catch(()=>{});await a.finish();if(completed&&process.env.AUDIT_METRICS_ONLY!=='1'&&!process.env.AUDIT_SHELL_METRICS_ONLY)await buildContacts();if(a.checks.some(c=>!c.pass)||a.errors.length)process.exitCode=1;}
