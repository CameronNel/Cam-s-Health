import {REPO,round,today,totals,shiftDate,dayFor,nextSession,brief} from './model.js';
import {BODY_FIELDS,METHODS,ensureDay,assertUnchanged,validDate,bodyValue,bodySeries,bodySummary,bodyDays,displayUnit,fromMetric,toMetric,sameDayComposition} from './body.js';
import {GitHubStore} from './sync.js';
import {createPressHandlers,createPinchHandlers} from './gestures.js';
import {createPWA} from './pwa.js';
import {mountWidgetMotion} from './widget-motion.js';
import {mountLiquidScenes} from './liquid-scene.js';
import {findExerciseDemo} from './exercise-catalogue.js';
import {createFoodStudio} from './food-studio.js';
import {foodSettings,targetsForDate,mealGroups} from './food-studio-model.js';
import {createBodyStudio} from './body-studio.js';
import {createWorkoutStudio} from './workout-studio.js';
import {createTrackerShell} from './tracker-shell.js';
import {createUndoPatch,applyUndoPatch} from './tracker-model.js';

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n==null?'–':Number(n).toLocaleString('en-GB',{maximumFractionDigits:1});
const percent=(n,t)=>t>0?Math.max(0,Math.min(100,n/t*100)):0;
const id=()=>crypto.randomUUID();
const dateLabel=(d,options={day:'numeric',month:'short'})=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',options);
const preference=(k,fallback)=>{try{return localStorage.getItem('cams-health-'+k)||fallback;}catch{return fallback;}};
const persist=(k,v)=>{try{localStorage.setItem('cams-health-'+k,v);}catch{}};
const root=$('#app'),sheet=$('#sheet');
const state={date:today(),view:'dashboard',detail:null,theme:preference('theme','dark'),units:preference('units','metric'),metric:'weightKg',range:30,filter:'',timerEnd:Number(preference('timer','0')),timerPaused:0};
if(!['metric','imperial'].includes(state.units))state.units='metric';
const paths={
  home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  food:'M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 3v18M19 3c-5 2-5 9 0 9',
  train:'M3 8v8M6 5v14M6 12h12M18 5v14M21 8v8',
  body:'M12 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM5 11l7-1 7 1M12 10v5M12 15l-4 6M12 15l4 6',
  more:'M5 12h.01M12 12h.01M19 12h.01',
  expand:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',collapse:'M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5',plus:'M12 5v14M5 12h14',close:'M6 6l12 12M6 18 18 6',
  right:'m9 5 7 7-7 7',left:'m15 5-7 7 7 7',arrow:'M4 12h16m-6-6 6 6-6 6',
  check:'m5 12 4 4L19 6',refresh:'M20 7a9 9 0 1 0 1 8M20 2v5h-5',
  sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10',
  moon:'M20 14A8 8 0 0 1 10 4 9 9 0 1 0 10 10Z',
  calendar:'M4 5h16v16H4ZM8 2v6M16 2v6M4 10h16',
  steps:'M9 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4M8 10l-2 5H3M8 10l5 4 3-2M8 10l4-3 4 2M11 14l-1 7M13 14l4 6',
  water:'M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z',
  scale:'M4 5h16v16H4ZM8 9h8M12 9l2-3',
  tape:'M3 6h18v12H3ZM7 6v5M11 6v3M15 6v5M19 6v3',
  github:'M9 19c-5 2-5-2-7-2M15 22v-4a4 4 0 0 0-1-3c4 0 7-2 7-6a5 5 0 0 0-1-3 5 5 0 0 0 0-4s-2 0-4 2a13 13 0 0 0-7 0C7 2 5 2 5 2a5 5 0 0 0 0 4 5 5 0 0 0-1 3c0 4 3 6 7 6a4 4 0 0 0-1 3v4',
  lock:'M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  info:'M12 16v-5M12 7h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
  timer:'M9 2h6M12 5v2M18 5l2 2M12 13l3-3M12 6a8 8 0 1 0 0 16 8 8 0 0 0 0-16',
  history:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v6l4 2',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  copy:'M8 8h12v13H8ZM4 16H2V2h13v2',
  edit:'m4 20 4-1L20 7l-4-4L4 15ZM13 6l4 4',
  search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
  coffee:'M4 7h12v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM16 9h2a3 3 0 0 1 0 6h-2M7 2v2M12 2v2'
};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
const button=(label,act,ico='',cls='btn',extra='')=>`<button type="button" class="${cls}" data-act="${act}" ${extra}>${ico?icon(ico):''}<span>${label}</span></button>`;
const iconButton=(label,act,ico,extra='')=>`<button type="button" class="iconbtn" data-act="${act}" aria-label="${label}" title="${label}" ${extra}>${icon(ico)}</button>`;
const heading=(title,action='')=>`<div class="section-head"><h2>${title}</h2>${action}</div>`;
const tag=(label,type='')=>`<span class="tag ${type}">${label}</span>`;
const empty=(ico,title,description,action='')=>`<div class="empty"><span class="empty-icon">${icon(ico)}</span><h3>${title}</h3><p>${description}</p>${action}</div>`;
const metricValue=(v,k)=>fmt(fromMetric(v,k,state.units));
const unit=k=>displayUnit(k,state.units);
const sessionSets=s=>s?.exercises?.reduce((a,e)=>a+(Number(e.sets)||0),0)||0;
const actualSets=w=>w.actualExercises?.reduce((a,e)=>a+(Number(e.sets)||0),0)||null;
const store=new GitHubStore({onchange:()=>{if(!sheet.open)render();}});
let pendingDraftRoute=null,currentDraftRoute=null,pendingDraftKey=null,currentSheetKey='',sheetCleanups=[],formDraftCleanups=new Map(),cleanRootHolds=()=>{},cleanSheetProgress=()=>{},lastUndo=null;
const featureContext={
 get data(){return store.data;},get date(){return state.date;},get units(){return state.units;},
 sheet,openSheet,closeSheet,setSheetMode,render,toast,esc,fmt,id,dateLabel,icon,button,authFields,saveFooter,wireForm,
 save:(mutator,message)=>store.save(mutator,message),foodForm,bodyForm,workoutForm,selectDate,startTimer,previewWorkout,openExerciseStudio,
 remember:(key,value)=>trackerShell.remember(key,value),recall:(key,fallback)=>trackerShell.recall(key,fallback),onSheetCleanup:fn=>sheetCleanups.push(fn),setDraftRoute:route=>{pendingDraftRoute=route;}
};
const trackerShell=createTrackerShell({sheet,openSheet,render,toast,esc,icon,themeControls:()=>`<section class="tracker-preference-group"><h4>Color theme</h4>${themeChoices()}</section>`,date:()=>state.date,openDraftRoute,extraDrafts:()=>workoutStudio.hasDraft()?`<div class="tracker-draft-recovery"><div><b>${esc(workoutStudio.draftSummary().name)}</b><p>${esc(workoutStudio.draftSummary().date)} · Live session saved locally</p></div>${button('Resume session','workout-resume','train','btn secondary')}</div>`:''});
const foodStudio=createFoodStudio(featureContext),bodyStudio=createBodyStudio(featureContext),workoutStudio=createWorkoutStudio(featureContext);
state.metric=trackerShell.recall('bodyMetric','weightKg');state.range=trackerShell.recall('bodyRange',30);
const verifiedSave=store.save.bind(store);
store.save=async(mutator,message)=>{
 let before,after;
 const saved=await verifiedSave(data=>{before=structuredClone(data);mutator(data);for(const [date,day]of Object.entries(data.days))if(JSON.stringify(day.food)!==JSON.stringify(before.days?.[date]?.food||[]))day.foodLogComplete=false;after=structuredClone(data);},message);
 const patch=createUndoPatch(before,after);lastUndo=patch.changes.length?{patch,message}:null;updateUndoDock();return saved;
};
function updateUndoDock(){const dock=$('#undo-dock');if(!dock)return;dock.hidden=!lastUndo;dock.innerHTML=lastUndo?`<span>Saved & verified</span><button type="button" data-act="undo-save">${icon('history')}Undo last save</button><button type="button" data-act="dismiss-undo" aria-label="Dismiss undo">×</button>`:'';}
async function undoSave(){
 if(!lastUndo)return;const operation=lastUndo;
 await verifiedSave(data=>{const candidate=applyUndoPatch(data,operation.patch);for(const key of Object.keys(data))if(!Object.hasOwn(candidate,key))delete data[key];Object.assign(data,candidate);},'Undo '+operation.message);
 lastUndo=null;updateUndoDock();if(sheet.open)closeSheet(true);render();toast('Last change undone and verified on GitHub.');
}
function rememberDemo(){
 const host=$('[data-exercise-demo]',sheet);if(!host||!demoContext)return;
 trackerShell.remember('demo:'+host.dataset.exerciseDemo,{angle:host.dataset.demoAngleValue,side:host.dataset.demoSideValue,speed:host.dataset.demoSpeedValue,overlay:host.dataset.demoOverlayValue,progress:host.dataset.demoProgressValue});
 trackerShell.remember('exercise:'+ (demoContext.memoryId||demoContext.sessionId||demoContext.title),demoContext.index);
}
function cleanSheetTools(){
 rememberDemo();trackerShell.captureSheet(sheet,currentSheetKey);cleanSheetProgress();cleanSheetProgress=()=>{};
 for(const cleanup of sheetCleanups.splice(0))try{cleanup();}catch{}
 for(const cleanup of formDraftCleanups.values())cleanup();formDraftCleanups.clear();
}
function clearSheetDrafts(){for(const form of $$('form',sheet))if(form.dataset.draftKey)trackerShell.clearDraft(form.dataset.draftKey);}
function attachSheetDrafts(){
 for(const [form,cleanup]of formDraftCleanups)if(!form.isConnected){cleanup();formDraftCleanups.delete(form);}
 for(const form of $$('form:not([data-draft-skip]):not(#ws-set-form)',sheet))if(!formDraftCleanups.has(form))formDraftCleanups.set(form,trackerShell.trackDraft(form,{key:currentSheetKey+':'+(form.id||'form'),title:$('#sheet-title',sheet)?.textContent,date:state.date,route:currentDraftRoute,getRoute:()=>currentDraftRoute?.module==='food'?{...foodStudio.draftRoute(),units:state.units}:currentDraftRoute}));
}
new MutationObserver(()=>{if(sheet.open)attachSheetDrafts();}).observe(sheet,{childList:true,subtree:true});
function openDraftRoute(draft){
 const route=draft.route||{};if(validDate(route.date||draft.date))selectDate(route.date||draft.date);if(['metric','imperial'].includes(route.units)){state.units=route.units;persist('units',state.units);render();}pendingDraftKey=draft.key.replace(/:(?:form|[^:]+-form)$/,'');
 if(route.module==='food'){if(!foodStudio.restoreDraftRoute?.(route))foodStudio.open('hub');return;}
 if(route.module==='body'){if(!bodyStudio.restoreDraftRoute?.(route))bodyStudio.open('home');return;}
 if(route.module==='workouts'){workoutStudio.restoreDraftRoute?.(route);return;}
 if(route.type==='body')return bodyForm(route.date);
 if(route.type==='food'){const entry=dayFor(store.data,state.date).food.find(f=>f.id===route.recordId);if(route.recordId&&!entry)return toast('That record was removed. Open a new food entry to recover your values.');return foodForm(entry||null);}
 if(route.type==='workout'){const entry=dayFor(store.data,route.date).workouts.find(w=>w.id===route.recordId);return workoutForm(entry||null,route.date,route.sessionId);}
 if(route.type==='recipe')return recipeForm(route.recipeId);
 if(route.type==='targets')return targetsForm();
 toast('Open the matching entry form to restore this draft.');
}
function trackerTools(kind){return `<div class="tracker-tool-row">${button(kind==='food'?'Food studio':kind==='body'?'Body studio':'Workout studio',kind+'-tools','spark','btn secondary')}${kind==='body'?button('Quick weigh-in','quick-weigh','scale','btn secondary'):kind==='workouts'&&workoutStudio.hasDraft()?button('Resume session','workout-resume','train','btn'):''}</div>`;}


function logicalFocusSelector(element){for(const attribute of ['id','data-peek','data-act','data-home','data-date','data-bs-change','data-ws-config-session','data-fs-input','name','data-bs','data-ws','data-fs'])if(element?.hasAttribute(attribute))return attribute==='id'?'#'+CSS.escape(element.id):'['+attribute+'="'+CSS.escape(element.getAttribute(attribute))+'"]';return null;}
function applyTheme(){state.theme=state.theme==='light'?'light':'dark';document.documentElement.dataset.theme=state.theme;document.querySelector('meta[name="theme-color"]').content=state.theme==='light'?'#f3f5fa':'#080a0e';document.querySelector('meta[name="color-scheme"]').content=state.theme;}
function themeChoices(){return `<div class="segmented theme-choices" role="group" aria-label="Color theme">${[['light','Light'],['dark','Dark']].map(([value,label])=>`<button type="button" data-act="set-theme" data-theme-choice="${value}" aria-pressed="${state.theme===value}" class="${state.theme===value?'selected':''}">${icon(value==='light'?'sun':'moon')}<span>${label}</span></button>`).join('')}</div>`;}
applyTheme();
// Leave more space for composing when Android's keyboard reduces the viewport.
let restingViewportHeight=window.visualViewport?.height||window.innerHeight,restingViewportWidth=window.innerWidth;
function updateKeyboard(){
  const height=window.visualViewport?.height||window.innerHeight,width=window.innerWidth;
  if(width!==restingViewportWidth){restingViewportWidth=width;restingViewportHeight=height;}
  const editing=document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea');
  const wasOpen=document.body.classList.contains('keyboard-open');
  if(!editing&&!wasOpen)restingViewportHeight=height;
  const reduced=restingViewportHeight-height>140;
  document.body.classList.toggle('keyboard-open',(!!editing||wasOpen)&&reduced);
  if(!editing&&!reduced)restingViewportHeight=height;
}
window.visualViewport?.addEventListener('resize',updateKeyboard);
window.addEventListener('resize',updateKeyboard);
document.addEventListener('focusin',updateKeyboard);
document.addEventListener('focusout',()=>requestAnimationFrame(updateKeyboard));
const toastElement=$('#toast');
if(typeof toastElement.showPopover==='function')toastElement.setAttribute('popover','manual');
function positionToast(){
  let bottom=20;
  for(const dock of $$('#undo-dock,#timer-dock'))if(!dock.hidden&&dock.getClientRects().length&&getComputedStyle(dock).display!=='none')bottom=Math.max(bottom,innerHeight-dock.getBoundingClientRect().top+12);
  if(sheet.open)for(const surface of $$('.save-panel,.form-actions,.detail-footer,.ws-actions,.inline-connect>summary',sheet)){
    const r=surface.getBoundingClientRect();
    if(r.height&&r.top<innerHeight&&r.bottom>0&&getComputedStyle(surface).visibility!=='hidden')bottom=Math.max(bottom,innerHeight-r.top+12);
  }
  const top=sheet.open?Math.max(12,$('.sheet-head',sheet)?.getBoundingClientRect().bottom+12||12):12;
  toastElement.style.setProperty('--toast-top',top+'px');
  toastElement.style.setProperty('--toast-bottom',bottom+'px');
}
function returnToastToPage(){
  if(toastElement.parentNode===document.body)return;
  if(toastElement.matches('[popover]'))toastElement.hidePopover();
  document.body.append(toastElement);
}
function presentToast(){
  const parent=sheet.open?sheet:document.body;
  if(toastElement.parentNode!==parent){if(toastElement.matches('[popover]'))toastElement.hidePopover();parent.append(toastElement);}
  positionToast();
  if(toastElement.matches('[popover]')){toastElement.hidePopover();toastElement.showPopover();}
}
const toastDockObserver=new ResizeObserver(positionToast);
$$('#undo-dock,#timer-dock').forEach(dock=>toastDockObserver.observe(dock));
window.addEventListener('resize',positionToast);
window.visualViewport?.addEventListener('resize',positionToast);
let sheetInsetFrame=0;
function updateSheetInsets(){
  if(!sheet.open)return;
  const bounds=sheet.getBoundingClientRect(),header=$('.sheet-head',sheet)?.getBoundingClientRect();
  const active=sheet.contains(document.activeElement)?document.activeElement:null;
  const panel=active?.closest('form')?.querySelector('.save-panel');
  const footer=panel?.getBoundingClientRect(),bottom=Math.min(innerHeight,bounds.bottom);
  const reserve=footer&&footer.top<bottom&&footer.bottom>bounds.top&&!active?.closest('.save-panel')?Math.max(0,bottom-footer.top)+8:8;
  sheet.style.scrollPaddingTop=Math.max(8,(header?.bottom||bounds.top)-bounds.top+8)+'px';
  sheet.style.scrollPaddingBottom=reserve+'px';
  positionToast();
}
const sheetInsetObserver=new ResizeObserver(updateSheetInsets);
function watchSheetInsets(){
  sheetInsetObserver.disconnect();
  for(const element of $$('.sheet-head,.save-panel,.form-actions,.detail-footer,.ws-actions,.inline-connect>summary',sheet))sheetInsetObserver.observe(element);
  updateSheetInsets();
}
function revealSheetField(){
  cancelAnimationFrame(sheetInsetFrame);
  sheetInsetFrame=requestAnimationFrame(()=>{
    updateSheetInsets();
    const active=document.activeElement;
    if(sheet.open&&sheet.contains(active)&&active.matches('input,textarea,select')){
      const field=active.closest('.field');
      if(field){
        const r=active.getBoundingClientRect(),prefix=Math.max(0,r.top-field.getBoundingClientRect().top);
        const bounds=sheet.getBoundingClientRect(),heading=$('.sheet-head',sheet)?.getBoundingClientRect();
        const footer=active.closest('form')?.querySelector('.save-panel')?.getBoundingClientRect();
        const usable=Math.min(innerHeight,bounds.bottom,footer?.top??Infinity)-Math.max(0,bounds.top,heading?.bottom??0);
        active.style.scrollMarginTop=(r.height+prefix+4<=usable?prefix:0)+'px';
      }
      active.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    }
  });
}
sheet.addEventListener('focusin',revealSheetField);
sheet.addEventListener('scroll',positionToast,{passive:true});
window.addEventListener('resize',revealSheetField);
window.visualViewport?.addEventListener('resize',revealSheetField);

function toast(text){
  clearTimeout(toast.t);presentToast();toastElement.textContent=text;toastElement.classList.add('show');
  toast.t=setTimeout(()=>{toastElement.classList.remove('show');if(toastElement.matches('[popover]'))toastElement.hidePopover();},5000);
}
const pwa=createPWA({onchange:()=>{if(!sheet.open)render();else if($('#sheet-title',sheet)?.textContent==='Tracker settings')refreshPwaCard();}});
function refreshPwaCard(){const panel=$('.life-card',sheet);if(!panel)return;const active=document.activeElement,hadFocus=panel.contains(active),action=active?.dataset.life||panel.dataset.pendingFocus;panel.outerHTML=pwaCard();if(hadFocus){const next=$('.life-card',sheet),button=action?next.querySelector('[data-life="'+CSS.escape(action)+'"]:not(:disabled)'):null;if(button)button.focus({preventScroll:true});else{next.tabIndex=-1;next.dataset.pendingFocus=action||'';next.focus({preventScroll:true});}}}

function pwaCard(){return `<section class="life-card"><span class="eyebrow">ON YOUR PHONE</span><h2>${pwa.state.standalone?'Your health, at hand.':'Add to your home screen.'}</h2><p class="help">${pwa.state.standalone?'You’re using the installed tracker.':'Give your tracker its own icon and app window.'}</p><button class="btn secondary" data-life="install-app">${pwa.state.standalone?'Installation help':'Add to home screen'}</button><button class="textbtn" data-life="check-updates" ${pwa.state.checkingUpdate?'disabled aria-busy="true"':''}>${pwa.state.checkingUpdate?'Checking for updates…':'Check for updates'}</button>${pwa.state.updateAvailable?'<p class="help">An update is ready. Save unfinished entries before applying it.</p><button class="btn secondary" data-life="app-update">Apply app update</button>':''}${pwa.state.error?`<p class="help" role="status">${esc(pwa.state.error)}</p>`:''}</section>`;}
async function pwaAction(name){
 if(name==='install-app'){if(pwa.state.canInstall)return pwa.install();return openSheet('Install Cam’s Health','<h3>Android · Chrome</h3><p class="help">Open the browser’s ⋮ menu, then choose <b>Install app</b> or <b>Add to Home screen</b>.</p><h3>iPhone · Safari</h3><p class="help">Tap Share, then <b>Add to Home Screen</b>.</p>');}
 if(name==='check-updates'){try{await pwa.checkForUpdates();if($('#sheet-title',sheet)?.textContent!=='Tracker settings')openSheet('Tracker settings',settingsView());toast(pwa.state.updateAvailable?'An update is ready.':'Your tracker is up to date.');}catch(error){toast(error.message);}return;}
 if(name==='app-update')return openSheet('Apply app update?','<p class="help">Save or copy unfinished entries first. Updating reloads the app and clears the GitHub connection held in this tab.</p><div class="form-actions"><button class="btn secondary" data-act="close-sheet">Cancel</button><button class="btn" data-life="apply-update">Update and reload</button></div>');
 if(name==='apply-update')return pwa.activateUpdate();
}

const trackerNames={food:'Food',body:'Body comp',workouts:'Workouts'};
function latestReading(key){
  return Object.entries(store.data.days).filter(([date,d])=>date<=state.date&&d.body?.[key]!=null).sort(([a],[b])=>b.localeCompare(a)).map(([date,d])=>({date,value:d.body[key]}))[0]||null;
}
let cleanWidgetMotion=()=>{},cleanLiquidScenes=()=>{},cleanSheetScenes=()=>{},cleanExerciseDemos=()=>{},sheetMediaVersion=0;
let exerciseViewerModule=null,exerciseViewerPromise=null,exerciseWarmupScheduled=false;
function loadExerciseViewer(){
  if(!exerciseViewerPromise)exerciseViewerPromise=import('./exercise-demo.js').then(module=>{exerciseViewerModule=module;return module;}).catch(error=>{exerciseViewerPromise=null;throw error;});
  return exerciseViewerPromise;
}
function prepareExerciseViewer(){
  if(exerciseWarmupScheduled)return;exerciseWarmupScheduled=true;
  // Fetch/compile public movement assets before interaction, after the overview paints.
  loadExerciseViewer().then(module=>{
    const warm=()=>module.preloadExerciseDemos().then(status=>{document.documentElement.dataset.exerciseReady=status;}).catch(()=>{document.documentElement.dataset.exerciseReady='retry';});
    if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:650});else setTimeout(warm,30);
  }).catch(()=>{exerciseWarmupScheduled=false;});
}
function cleanSheetMedia(){sheetMediaVersion++;cleanSheetScenes();cleanExerciseDemos();cleanSheetScenes=()=>{};cleanExerciseDemos=()=>{};}
function mountSheetMedia(){
  cleanSheetScenes=mountLiquidScenes(sheet);
  if(!$('[data-exercise-demo]',sheet))return;
  const version=sheetMediaVersion;
  const mount=module=>{if(version===sheetMediaVersion&&sheet.open)cleanExerciseDemos=module.mountExerciseDemos(sheet);};
  if(exerciseViewerModule){mount(exerciseViewerModule);return;}
  loadExerciseViewer().then(mount).catch(()=>{
    if(version!==sheetMediaVersion)return;
    const stage=$('[data-exercise-demo]',sheet);if(stage){stage.setAttribute('role','status');stage.removeAttribute('aria-label');stage.innerHTML='<p class="demo-load-error">The illustration could not load. Your movement cues are below. Reload the app when you are ready to retry.</p>';}
  });
}
function opticalBackdrop(){return `<div class="optical-backdrop" aria-hidden="true"><svg viewBox="0 0 440 1100" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="ribbon-body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f3efff" stop-opacity=".02"/><stop offset=".24" stop-color="#b8c7da" stop-opacity=".18"/><stop offset=".5" stop-color="#ededfa" stop-opacity=".06"/><stop offset=".74" stop-color="#d7bdec" stop-opacity=".15"/><stop offset="1" stop-color="#dcfaff" stop-opacity=".02"/></linearGradient><linearGradient id="ribbon-edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".22" stop-color="#d7eef7" stop-opacity=".25"/><stop offset=".45" stop-color="#f8f3ff" stop-opacity=".06"/><stop offset=".65" stop-color="#dcc7f3" stop-opacity=".24"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="silk-soft"><feGaussianBlur stdDeviation=".7"/></filter></defs><g class="silk-flow" fill="none"><path d="M550-80C80 30 570 300 260 410S-60 620 180 760 490 890 340 1170" stroke="url(#ribbon-body)" stroke-width="78"/><path d="M529-99C59 11 549 281 239 391S-81 601 159 741 469 871 319 1151" stroke="url(#ribbon-edge)" stroke-width="1.4" filter="url(#silk-soft)"/><path d="M573-58C103 52 593 322 283 432S-37 642 203 782 513 912 363 1192" stroke="url(#ribbon-edge)" stroke-width="1"/></g></svg><div class="optical-haze"></div></div>`;}
function render(){
  const activeSelector=root.contains(document.activeElement)?logicalFocusSelector(document.activeElement):null;
  cleanWidgetMotion();cleanLiquidScenes();cleanRootHolds();
  if(!store.data){root.innerHTML=`<main class="boot"><div class="wordmark">cam<span>.</span></div><p>${store.error?esc(store.error):'Opening your health overview'}</p>${store.error?button('Try again','refresh','refresh'):'<div class="loader"></div>'}</main>`;return;}
  const d=dayFor(store.data,state.date),t=totals(d),isToday=state.date===today(store.data.profile.timezone),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:store.data.profile.timezone,hour:'numeric',hourCycle:'h23'}).format(new Date())),greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  root.innerHTML=`${opticalBackdrop()}<div class="app-shell"><div class="app-content"><header class="topbar"><a class="health-brand" href="#dashboard" data-home aria-label="Cam’s Health home"><span class="brand-lens" aria-hidden="true">c<span>·</span></span><span>Cam’s Health</span></a><div class="top-actions">${iconButton('Refresh records','refresh','refresh',store.reading||store.busy?'disabled':'')}<button class="profile-lens" data-act="settings" aria-label="Tracker settings">${esc((store.data.profile.name||'C').slice(0,1))}</button></div></header><main id="main" tabindex="-1"><div class="overview-heading"><div><p>${isToday?greeting+', '+esc(store.data.profile.name||'Cam'):'Your health, one day at a time'}</p><h1>${isToday?'Today':dateLabel(state.date,{weekday:'long'})}<span>.</span></h1></div><label class="overview-date">${icon('calendar')}<span>${dateLabel(state.date,{day:'numeric',month:'short'})}</span>${icon('right')}<input type="date" id="view-date" value="${state.date}" aria-label="View date"></label></div>${weekRail()}${store.error?`<div class="notice warning" role="status">${icon('info')}<div><b>Records may be out of date</b><p>${esc(store.error)}</p></div>${button('Details','sync-info','','textbtn')}</div>`:''}<div class="widget-grid">${foodCard(d,t)}${bodyCard()}${workoutCard(d)}</div><div class="overview-footer"><span>${icon('eye')}Hold to peek. Pinch to expand.</span><button class="log-lens" data-act="quick" aria-label="Quick log food, body or workout">${icon('plus')}<span>Log</span></button></div><footer class="sync-footer"><button class="textbtn" data-act="sync-info"><i class="status-dot ${store.error?'amber':''}"></i>${esc(store.status)}</button><span>${store.checkedAt?'Updated '+new Date(store.checkedAt).toLocaleTimeString('en-GB',{timeZone:store.data.profile.timezone,hour:'2-digit',minute:'2-digit'}):'Awaiting live records'}</span></footer></main></div></div>`;
  trackerShell.apply(root);attachHolds();cleanRootHolds=trackerShell.enhanceHolds(root);updateTimer();cleanWidgetMotion=mountWidgetMotion(root);cleanLiquidScenes=mountLiquidScenes(root);if(activeSelector)$(activeSelector,root)?.focus({preventScroll:true});
}
function weekRail(){
  const monday=shiftDate(state.date,-((new Date(state.date+'T12:00:00Z').getUTCDay()+6)%7));
  return `<div class="week-rail" aria-label="Choose a day">${Array.from({length:7},(_,i)=>{const date=shiftDate(monday,i),d=dayFor(store.data,date),logged=d.food.length||d.workouts.length||d.weightKg!=null;return `<button data-date="${date}" class="week-day ${date===state.date?'selected':''}" aria-label="${dateLabel(date,{weekday:'long',day:'numeric',month:'long'})}" aria-pressed="${date===state.date}"><span>${dateLabel(date,{weekday:'short'}).slice(0,1)}</span><b>${Number(date.slice(-2))}</b><i class="${logged?'has-data':''}"></i></button>`;}).join('')}</div>`;
}
function widgetHead(label,ico,act,aria){return `<header class="widget-head"><span class="widget-label"><span class="category-lens">${icon(ico)}</span><span>${label}</span></span>${act?iconButton(aria,act,'plus'):''}</header>`;}
function widgetArrow(){return `<span class="widget-arrow">${icon('arrow')}</span>`;}
function foodCard(d,t){
  const target=targetsForDate(store.data,state.date),has=d.food.length>0,progress=percent(t.kcal,target.kcal),remaining=has&&target.kcal!=null&&!t.missing.kcal?round(target.kcal-t.kcal):null;
  return `<section class="health-widget food-widget ${foodSettings(store.data).proteinFocus?'protein-focus':''}" aria-label="Food tracker">${widgetHead('Food','food','food-log','Log food')}<button class="widget-peek food-peek" data-peek="food" aria-label="View food details; hold to preview"><span class="fuel-overview"><span class="fuel-reading"><span class="widget-eyebrow">Daily fuel</span><span class="calorie-value">${has?fmt(t.kcal):'–'}</span><span class="calorie-unit">kcal${t.missing.kcal?' + ?':''} logged</span><span class="fuel-note">${remaining!=null?`${fmt(Math.abs(remaining))} ${remaining<0?'over target':'left for today'}`:has?'Known calorie subtotal':'Ready for your first meal'}</span></span><span class="optical-orb" role="img" aria-label="${has&&target.kcal?Math.round(progress)+' percent of calorie target':'No calorie progress yet'}"><span class="orb-halo"></span><canvas data-liquid-scene data-progress="${progress/100}" data-empty="${!has||!target.kcal}" aria-hidden="true"></canvas><span class="orb-fallback" aria-hidden="true"></span><span class="orb-reading"><b>${has&&target.kcal?Math.round(progress)+'<small>%</small>':'–'}</b><small>of your goal</small></span></span></span><span class="macro-strip">${[['protein','Protein'],['carbs','Carbs'],['fat','Fat']].map(([k,label])=>`<span class="macro-cell ${k}"><span class="macro-label"><i></i>${label}</span><b>${has?fmt(t[k]):'–'}<small>g${t.missing[k]?' + ?':''}</small></b><span class="macro-fill"><i style="--fill:${percent(t[k],target[k])}%"></i></span></span>`).join('')}</span><span class="widget-bottom"><span>${d.food.length?`${d.food.length} ${d.food.length===1?'entry':'entries'}${t.pending?' · Incomplete nutrition':t.estimated?' · Includes estimates':''}`:'Your meals, at a glance'}</span>${widgetArrow()}</span></button></section>`;
}
function weightSparkline(points){
  if(!points.length)return `<span class="sparkline-empty">A little check-in goes a long way.</span>`;
  const values=points.map(p=>p.value),lo=Math.min(...values),hi=Math.max(...values),start=Date.parse(points[0].date),end=Date.parse(points.at(-1).date);
  const x=p=>end===start?70:5+(Date.parse(p.date)-start)/(end-start)*130,y=v=>hi===lo?25:41-(v-lo)/(hi-lo)*30;
  const line=points.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' '),last=points.at(-1);
  return `<svg class="weight-spark" viewBox="0 0 140 50" role="img" aria-label="${points.length} recorded weight readings in the last 30 days"><defs><linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f4c49c" stop-opacity=".22"/><stop offset="1" stop-color="#f4c49c" stop-opacity="0"/></linearGradient></defs>${points.length>1?`<path class="spark-area" d="${line}L${x(last)} 50L${x(points[0])} 50Z" fill="url(#weight-area)"/><path class="spark-line" d="${line}" pathLength="1"/>`:''}<circle cx="${x(last)}" cy="${y(last.value)}" r="3"/><circle class="spark-halo" cx="${x(last)}" cy="${y(last.value)}" r="6"/></svg>`;
}
function bodyCard(){
  const weight=bodySummary(store.data,'weightKg',state.date).last,fat=bodySummary(store.data,'bodyFatPct',state.date).last,muscle=latestReading('skeletalMuscleKg');
  return `<section class="health-widget body-widget" aria-label="Body composition tracker">${widgetHead('Body comp','body','body-log','Log body measurements')}<button class="widget-peek body-peek" data-peek="body" aria-label="View body composition details; hold to preview"><span class="body-overview"><span class="body-primary"><span class="metric-name">Weight</span><span class="body-weight">${weight?metricValue(weight.value,'weightKg'):'–'}<small>${unit('weightKg')}</small></span><span class="reading-date">${weight?dateLabel(weight.date):'Not recorded'}</span></span><span class="body-secondary"><span class="metric-name">Body fat</span><b>${fat?fmt(fat.value):'–'}<small>%</small></b><span class="reading-date">${fat?dateLabel(fat.date):'Not recorded'}</span></span><span class="body-secondary"><span class="metric-name">Muscle</span><b>${muscle?metricValue(muscle.value,'weightKg'):'–'}<small>${unit('weightKg')}</small></b><span class="reading-date">${muscle?dateLabel(muscle.date):'Not recorded'}</span></span></span><span class="body-trend">${weightSparkline(bodySeries(store.data,'weightKg',state.date,30))}<span>30-day weight trend</span>${widgetArrow()}</span></button></section>`;
}
function workoutCard(d){
  const next=nextSession(store.data,state.date),latest=d.workouts.at(-1),paused=store.data.profile.trainingStatus!=='ready',fullName=latest?.name||next?.name||'Your next session',name=fullName.split('(')[0].trim()||fullName;
  const monday=shiftDate(state.date,-((new Date(state.date+'T12:00:00Z').getUTCDay()+6)%7));
  const week=Array.from({length:7},(_,i)=>{const date=shiftDate(monday,i);return {date,done:date<=state.date&&dayFor(store.data,date).workouts.some(w=>w.status==='completed'&&w.sessionId!=='rest')};}),count=week.filter(d=>d.done).length;
  return `<section class="health-widget workout-widget" aria-label="Workout tracker">${widgetHead('Workouts','train','workout-log','Log a workout')}<button class="widget-peek workout-peek" data-peek="workouts" aria-label="View workout details; hold to preview"><span class="session-overview"><span class="session-copy"><span class="widget-eyebrow">${latest?'Logged today':'Next in rotation'}</span><span class="session-name">${esc(name)}</span><span class="session-description">${latest?`${latest.status==='completed'?'Session complete':'Partial session'}${latest.durationMin!=null?' · '+fmt(latest.durationMin)+' min':''}`:next?.id==='rest'?'Recovery day':next?next.exercises.length+' exercises · '+sessionSets(next)+' prescribed sets':'Your next bit of progress'}</span>${paused?`<span class="training-status">${store.data.profile.trainingStatus==='paused'?'Training paused':'Clearance unconfirmed'}</span>`:''}</span><span class="kinetic-sculpture" aria-hidden="true"><i></i><i></i><i></i><span>${icon(latest?.status==='completed'?'check':'train')}</span></span></span><span class="training-week"><span class="week-caption">${count} ${count===1?'day':'days'} this week</span><span class="training-days">${week.map(({date,done})=>`<span class="training-day ${done?'done':''}" aria-label="${dateLabel(date,{weekday:'long'})}: ${done?'completed workout':'no completed workout recorded'}">${done?icon('check'):'<i></i>'}</span>`).join('')}</span>${widgetArrow()}</span></button></section>`;
}
function foodPreview(d,t){
 const has=d.food.length>0,target=targetsForDate(store.data,state.date),progress=percent(t.kcal,target.kcal),remaining=has&&target.kcal!=null&&!t.missing.kcal?round(target.kcal-t.kcal):null;
 return `<div class="peek-fuel"><div><span class="peek-caption">Calories logged</span><strong class="peek-calories">${has?fmt(t.kcal):'–'}</strong><span class="peek-unit">kcal${t.missing.kcal?' + ?':''}</span><p class="peek-remaining">${remaining!=null?fmt(Math.abs(remaining))+(remaining<0?' over target':' remaining'):has?'Known subtotal':'No food logged for this date'}</p></div><span class="peek-orb" role="img" aria-label="${has&&target.kcal?Math.round(progress)+' percent of calorie target':'No calorie progress yet'}"><canvas data-liquid-scene data-progress="${progress/100}" data-empty="${!has||!target.kcal}" aria-hidden="true"></canvas><span class="orb-fallback" aria-hidden="true"></span><b>${has&&target.kcal?Math.round(progress)+'<small>%</small>':'–'}</b></span></div><div class="macro-strip peek-macros">${[['protein','Protein'],['carbs','Carbs'],['fat','Fat']].map(([key,name])=>`<span class="macro-cell ${key}"><span class="macro-label"><i></i>${name}</span><b>${has?fmt(t[key]):'–'}<small>g${t.missing[key]?' + ?':''}</small></b></span>`).join('')}</div>${t.pending?'<p class="help">Some nutrition is unknown. Values shown are known subtotals.</p>':''}`;
}
function trackerCompact(kind){
  const d=dayFor(store.data,state.date),t=totals(d);
  if(kind==='food')return `${trackerTools(kind)}${foodPreview(d,t)}<section>${heading('Latest entries')}${d.food.length?foodRows(d.food,3):empty('food','A fresh start','Add your first meal for this date.',button('Log food','food-log','plus'))}</section>`;
  if(kind==='body'){
    const points=bodySeries(store.data,'weightKg',state.date,30);
    return `${trackerTools(kind)}<p class="help">Your recorded weight over the last 30 days.</p>${chart(points,'weightKg')}<div class="compact-body-note">${latestReading('skeletalMuscleKg')?`<span>Last reported muscle</span><b>${metricValue(latestReading('skeletalMuscleKg').value,'weightKg')} ${unit('weightKg')}</b><small>${dateLabel(latestReading('skeletalMuscleKg').date)} · Device reading</small>`:'<p class="help">Weight, body fat, muscle readings and tape measurements, in one place.</p>'}</div>${button('Log measurements','body-log','plus','btn full')}`;
  }
  const next=nextSession(store.data,state.date);
  return `${trackerTools(kind)}${trainingNotice()}${recordedWorkouts(d)}${next?`<span class="eyebrow">NEXT IN YOUR ROTATION</span><h3 class="sheet-hero-title">${esc(next.name)}</h3><p class="help">${esc(next.focus)}</p>${exerciseList({...next,exercises:next.exercises.slice(0,3)})}${next.exercises.length>3?`<p class="help">+ ${next.exercises.length-3} more exercises in full view</p>`:''}`:empty('train','Your workout space','Log a session to keep your progress together.')}${button('Log workout','workout-log','plus','btn full')}`;
}
function trackerFull(kind){
  const d=dayFor(store.data,state.date);
  if(kind==='food')return trackerTools(kind)+nutrition(d,totals(d)).replace('Food & activity','Food diary').replace('Meals, movement, and your daily fuel.','Your meals, portions, and daily fuel.');
  if(kind==='body')return trackerTools(kind)+bodyView();
  return trackerTools(kind)+training(d);
}
function openTracker(kind,full=false){
  if(!trackerNames[kind])return;
  const source=$('[data-peek="'+kind+'"]',root)?.closest('.health-widget')?.getBoundingClientRect();
  openSheet(trackerNames[kind],trackerCompact(kind),()=>{}, {compact:()=>trackerCompact(kind),full:()=>trackerFull(kind),tracker:kind});
  if(full)setSheetMode(true);else animateLens(source);
}
function dateControls(week=false){
  const monday=shiftDate(state.date,-((new Date(state.date+'T12:00:00Z').getUTCDay()+6)%7));
  return `<div class="date-controls"><div class="date-select">${iconButton('Previous day','prev','left')}<label class="date-input">${icon('calendar')}<span>${dateLabel(state.date,{day:'numeric',month:'long',year:'numeric'})}</span><input type="date" id="view-date" value="${state.date}" aria-label="View date"></label>${iconButton('Next day','next','right')}</div>${button('Today','today','','textbtn')}</div>${week?`<div class="week-strip">${Array.from({length:7},(_,i)=>{const date=shiftDate(monday,i),d=dayFor(store.data,date),logged=d.food.length||d.workouts.length||d.weightKg!=null;return `<button data-date="${date}" class="day ${date===state.date?'selected':''} ${date===today(store.data.profile.timezone)?'is-today':''}" aria-label="${dateLabel(date,{weekday:'long',day:'numeric',month:'long'})}" ${date===state.date?'aria-pressed="true"':'aria-pressed="false"'}><span>${dateLabel(date,{weekday:'short'})}</span><b>${Number(date.slice(-2))}</b><i class="${logged?'has-data':''}"></i></button>`;}).join('')}</div>`:''}`;
}
function intro(eyebrow,title,description,action=''){return `<div class="page-intro"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`;}
function nutritionHero(d,t){
  const target=targetsForDate(store.data,state.date),has=d.food.length>0,remain=target.kcal==null||t.missing.kcal?null:round(target.kcal-t.kcal),progress=percent(t.kcal,target.kcal);
  return `<section class="nutrition-card card"><div class="card-kicker"><span class="eyebrow">YOUR DAILY FUEL</span>${button(t.pending?'Incomplete macros':t.estimated?'Includes estimates':'Daily summary','brief','arrow','textbtn small')}</div><div class="energy-layout"><div class="energy-number"><span class="caption">Calories logged</span><div><strong>${has?fmt(t.kcal):'–'}</strong><span>kcal${t.missing.kcal?' + ?':''}</span></div><p>${has&&remain!=null?`<b>${fmt(Math.abs(remain))} kcal ${remain<0?'over target':'remaining'}</b><span>of ${fmt(target.kcal)} kcal</span>`:has?'Known subtotal. Some calories are missing.':'No food logged for this date.'}</p></div><div class="energy-ring" role="img" aria-label="${has?Math.round(progress)+' percent of calorie target logged':'No food logged'}"><svg viewBox="0 0 120 120"><circle class="ring-track" cx="60" cy="60" r="51"/><circle class="ring-fill" cx="60" cy="60" r="51" pathLength="100" stroke-dasharray="${progress} 100"/></svg><div>${icon('spark')}<b>${has&&target.kcal?Math.round(progress)+'%':'–'}</b><small>OF TARGET</small></div></div></div><div class="macro-grid">${[['protein','Protein'],['carbs','Carbs'],['fat','Fat']].map(([k,name])=>`<div class="macro ${k}"><span><i></i>${name}</span><strong>${has?fmt(t[k]):'–'}<small>g${t.missing[k]?' + ?':''}</small></strong><div class="macro-meta">${target[k]!=null?'/ '+fmt(target[k])+' g target':t.missing[k]?'Known subtotal':'Logged today'}</div>${target[k]>0?`<div class="track"><i style="width:${percent(t[k],target[k])}%"></i></div>`:'<div class="track subtle"></div>'}</div>`).join('')}</div></section>`;
}
function foodIcon(f){return /coffee|latte/i.test(f.name)?'coffee':/protein|shake/i.test(f.name)?'water':'food';}
function foodRows(foods,limit=null){return `<div class="food-list">${(limit?foods.slice(0,limit):foods).map(f=>`<button class="food-row" data-food="${esc(f.id)}" data-name="${esc(f.name.toLowerCase())}"><span class="item-icon ${foodIcon(f)}">${icon(foodIcon(f))}</span><span class="row-description"><b>${esc(f.name)}</b><small>${esc(f.quantity)}${f.reviewRequired?' <i class="review-dot" title="Nutrition needs review"></i>':''}</small></span><span class="row-value"><b>${f.estimated&&f.kcal!=null?'≈ ':''}${fmt(f.kcal)}</b><small>kcal</small></span>${icon('right','chevron')}</button>`).join('')}</div>`;}

function workoutTile(s,featured=false){return `<article class="workout-tile ${featured?'featured':''}"><button class="workout-open" data-workout="${esc(s.id)}"><div class="workout-label"><span class="eyebrow">${featured?'NEXT IN YOUR ROTATION':'YOUR PROGRAM'}</span>${icon('arrow')}</div><h3>${esc(s.name)}</h3><p>${esc(s.focus)}</p><div class="workout-chips">${tag(s.id==='rest'?'Recovery':s.exercises.length+' exercises')}${s.id!=='rest'?tag(sessionSets(s)+' prescribed sets'):''}</div></button><button class="preview" data-preview="${esc(s.id)}" aria-label="Preview ${esc(s.name)}">${icon('eye')}</button></article>`;}
function recordedWorkouts(d,date=state.date){return d.workouts.length?`<div class="record-list">${d.workouts.map(w=>`<button class="record-row" data-record="${esc(w.id)}" data-record-date="${date}"><span class="item-icon lilac">${icon(w.status==='completed'?'check':'train')}</span><span class="row-description"><b>${esc(w.name)}</b><small>${w.status==='completed'?'Completed':'Partial'}${actualSets(w)?' · '+actualSets(w)+' reported sets':''}${w.durationMin!=null?' · '+fmt(w.durationMin)+' min':''}</small></span>${icon('right')}</button>`).join('')}</div>`:'';}
function trainingNotice(){return store.data.profile.trainingStatus==='ready'?'':`<div class="notice soft">${icon('info')}<div><b>${store.data.profile.trainingStatus==='paused'?'Training paused':'Exercise clearance unconfirmed'}</b><p>Your stored plan is available to view. This app does not confirm that you are cleared to train.</p></div></div>`;}

function nutrition(d,t){return `${intro('NUTRITION', 'Food & activity', 'Meals, movement, and your daily fuel.',button('Log food','food-log','plus'))}${dateControls()}<div class="dashboard-grid"><div class="primary-column">${nutritionHero(d,t)}<section>${heading('Your food diary',tag(d.food.length+' entries'))}<label class="search-field">${icon('search')}<input id="food-search" type="search" placeholder="Find something you logged" aria-label="Search today’s food"></label><div class="card">${d.food.length?mealGroups(d).map(g=>`<section class="diary-meal"><h3>${esc(g.meal==='unassigned'?'Other entries':g.meal.replace(/^./,c=>c.toUpperCase()))}</h3>${foodRows(g.items)}</section>`).join(''):empty('food','A fresh page','Food you log will appear here.',button('Add food','food-log','plus'))}<p id="search-empty" class="help padded" hidden>No matching entries.</p></div></section></div><div class="secondary-column"><section>${heading('Quick repeat')}<p class="help">Review a previous portion before saving it again.</p><div class="card repeat-list">${recentFood().length?recentFood().map(f=>`<button class="record-row" data-repeat="${esc(f.id)}" data-origin="${f.date}"><span class="item-icon">${icon(foodIcon(f))}</span><span class="row-description"><b>${esc(f.name)}</b><small>${esc(f.quantity)} · ${fmt(f.kcal)} kcal</small></span>${icon('plus')}</button>`).join(''):empty('history','Build your shortcuts','Your recent foods become repeatable here.')}</div></section><section>${heading('Saved recipes')}<div class="card">${(store.data.recipes||[]).map(r=>`<button class="record-row" data-recipe="${esc(r.id)}"><span class="item-icon peach">${icon('food')}</span><span class="row-description"><b>${esc(r.name)}</b><small>${fmt(r.yieldG)} g batch · choose your portion</small></span>${icon('plus')}</button>`).join('')||empty('food','Your recipe kitchen','Build a recipe from ingredients and save each version.',button('Create a recipe','food-recipes','food','btn secondary'))}</div></section>${t.pending?`<div class="notice soft">${icon('info')}<div><b>Some nutrition is missing</b><p>${t.pending} ${t.pending===1?'entry has':'entries have'} unknown values. The + ? marker means the total is incomplete, not zero.</p></div></div>`:''}</div></div>`;}
function recentFood(){const seen=new Set();return Object.entries(store.data.days).filter(([d])=>d<=state.date).sort(([a],[b])=>b.localeCompare(a)).flatMap(([date,d])=>d.food.map(f=>({...f,date}))).filter(f=>{const key=f.name+'|'+f.quantity;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,5);}
function training(d){return `${intro('TRAINING', 'Your training', 'Your next session and the work you logged.',button('Log session','workout-log','plus'))}${dateControls()}${trainingNotice()}<div class="section-head"><h2>Today’s work</h2>${button('Rest timer','timer','timer','textbtn')}</div>${d.workouts.length?recordedWorkouts(d):`<div class="card">${empty('train','No session logged','Prescribed workouts are not automatically marked as done.',button('Log a session','workout-log','plus'))}</div>`}<section>${heading('Your rotation',tag('PUSH / PULL / LEGS'))}<p class="help">Hold to preview. Tap for the details. Only completed program sessions advance the rotation.</p><div class="workout-grid">${store.data.training.rotation.map(sid=>store.data.training.sessions.find(s=>s.id===sid)).filter(Boolean).map(s=>workoutTile(s,nextSession(store.data,state.date)?.id===s.id)).join('')}</div></section><section>${heading('Recent sessions')}<div class="card">${Object.entries(store.data.days).filter(([date])=>date<=state.date).sort(([a],[b])=>b.localeCompare(a)).filter(([,d])=>d.workouts.length).slice(0,10).map(([date,day])=>`<div class="history-date">${dateLabel(date,{weekday:'short',day:'numeric',month:'short'})}</div>${recordedWorkouts(day,date)}`).join('')||empty('history','No workout records','Completed and partial sessions will appear together.')}</div></section><details class="card disclosure"><summary>Program notes ${icon('plus')}</summary><div class="padded">${(Array.isArray(store.data.training.notes)?store.data.training.notes:[store.data.training.notes]).filter(Boolean).map(n=>`<p class="help">${esc(n)}</p>`).join('')}</div></details>`;}
function exerciseList(s){return `<p class="exercise-hold-hint">${icon('eye')}Hold an exercise to see it in motion.</p><ol class="exercise-list">${s.exercises.map((e,i)=>`<li><span class="exercise-index">${String(i+1).padStart(2,'0')}</span><div>${findExerciseDemo(e.name)?`<button type="button" class="exercise-demo-open" data-exercise-session="${esc(s.id)}" data-exercise-index="${i}" aria-label="Watch ${esc(e.name)} demonstration; hold to preview"><b>${esc(e.name)}</b><span>${esc(e.sets)} sets × ${esc(e.reps)}${/sec/i.test(e.reps)?'':' reps'}</span><small>${icon('eye')}View movement</small></button>`:`<b>${esc(e.name)}</b><span>${esc(e.sets)} sets × ${esc(e.reps)}${/sec/i.test(e.reps)?'':' reps'}</span>`}${e.note?`<details><summary>Technique & progression</summary><p>${esc(e.note)}</p></details>`:''}</div><button class="rest-chip" data-seconds="${Number(e.rest)||60}" aria-label="Start ${Number(e.rest)||60} second rest timer">${icon('timer')}${Number(e.rest)||60}s</button></li>`).join('')}</ol>`;}
function workoutDetails(){const s=store.data.training.sessions.find(s=>s.id===state.detail);if(!s)return empty('train','Workout not found','This session may have changed.',button('Back to training','training','left'));return `${intro('YOUR PROGRAM',esc(s.name),esc(s.focus))}${trainingNotice()}<div class="workout-detail-stats">${tag(s.exercises.length+' exercises')}${tag(sessionSets(s)+' prescribed sets')}${tag('Not a performance log')}</div><div class="card">${s.id==='rest'?empty('moon','Recovery is part of the plan','Log your rest day to advance the rotation.'):exerciseList(s)}</div><div class="detail-footer">${s.exercises.length?button('Start guided session','workout-start','train','btn',`data-session="${esc(s.id)}"`):''}${button(s.id==='rest'?'Log rest day':'Log this session','workout-log','check','btn',`data-session="${esc(s.id)}"`)}${button('Rest timer','timer','timer','btn secondary')}</div>`;}
function chart(points,key,{mixed=false}={}) {
  if(!points.length)return `<div class="chart-empty"><div class="chart-grid-placeholder"></div><span class="empty-icon">${icon('history')}</span><h3>Your trend starts here.</h3><p>Add a measurement to begin. Charts use your recorded values.</p>${button('Add a measurement','body-log','plus','btn secondary')}</div>`;
  const values=points.map(p=>fromMetric(p.value,key,state.units)),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.2,key==='bodyFatPct'?.5:.4),min=Math.max(0,lo-pad),max=hi+pad;
  const start=Date.parse(points[0].date),end=Date.parse(points.at(-1).date),x=p=>end===start?197:48+(Date.parse(p.date)-start)/(end-start)*296,y=v=>172-(v-min)/(max-min)*136;
  const line=points.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${y(values[i]).toFixed(2)}`).join(' ');
  return `<div class="trend-chart"><svg viewBox="0 0 360 220" role="img" aria-label="${esc(key)} readings from ${points[0].date} to ${points.at(-1).date}; ${points.length} recorded values"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".17"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>${[0,.5,1].map(t=>{const yy=36+t*136;return `<path class="chart-gridline" d="M48 ${yy}H346"/><text x="40" y="${yy+4}" text-anchor="end">${fmt(max-t*(max-min))}</text>`;}).join('')}${points.length>1&&!mixed?`<path d="${line}L${x(points.at(-1))},173 L${x(points[0])},173Z" fill="url(#chart-fill)"/><path class="chart-line" d="${line}"/>`:''}${points.map((p,i)=>`<circle class="chart-point" cx="${x(p)}" cy="${y(values[i])}" r="3.8"><title>${p.date}: ${fmt(values[i])} ${unit(key)}${key==='bodyFatPct'?' · '+p.method:''}</title></circle>`).join('')}<text x="48" y="208">${dateLabel(points[0].date)}</text><text x="346" y="208" text-anchor="end">${dateLabel(points.at(-1).date)}</text></svg></div>`;
}
function bodyView(){
  const weight=bodySummary(store.data,'weightKg',state.date),fat=bodySummary(store.data,'bodyFatPct',state.date),waist=bodySummary(store.data,'waist',state.date),rows=bodyDays(store.data,state.date),points=bodySeries(store.data,state.metric,state.date,state.range),summary=bodySummary(store.data,state.metric,state.date),mixed=state.metric==='bodyFatPct'&&new Set(points.map(p=>p.method)).size>1,comp=sameDayComposition(store.data,state.date);
  const metricName=state.metric==='weightKg'?'Body weight':state.metric==='bodyFatPct'?'Body fat':BODY_FIELDS.find(([k])=>k===state.metric)?.[1];
  return `${intro('BODY / COMPOSITION','Body & composition','Your actual check-ins, kept together over time.',button('Check in','body-log','plus'))}${dateControls()}<div class="body-summary-grid">${[['weightKg','Body weight',weight,'scale'],['bodyFatPct','Body fat',fat,'body'],['waist','Waist',waist,'tape']].map(([key,label,s,ico])=>`<button class="body-stat card ${key==='weightKg'?'primary-stat':''}" data-metric="${key}"><div class="caption">${icon(ico)}${label}${icon('arrow','tiny')}</div><strong>${metricValue(s.last?.value??null,key)}<small>${unit(key)}</small></strong><div class="stat-baseline">${s.last?'Last reading · '+dateLabel(s.last.date):'No reading yet'}</div>${s.change!=null&&(key!=='bodyFatPct'||s.first.method===s.last.method)?`<span class="delta">${s.change>0?'+':''}${metricValue(s.change,key)} ${key==='bodyFatPct'?'percentage points':unit(key)} <span>since ${dateLabel(s.first.date)}</span></span>`:'<span class="delta muted">'+(key==='bodyFatPct'&&s.count>1?'Methods differ; compare with care':'Your baseline builds from real readings')+'</span>'}</button>`).join('')}</div><div class="body-layout"><div class="primary-column"><section class="card trend-card"><div class="card-kicker"><div><span class="eyebrow">PROGRESS OVER TIME</span><h2>${esc(metricName)}</h2></div><label class="select-wrap"><select id="metric-select" aria-label="Choose chart metric">${[['weightKg','Body weight'],['bodyFatPct','Body fat'],...BODY_FIELDS].map(([k,l])=>`<option value="${k}" ${k===state.metric?'selected':''}>${l}</option>`).join('')}</select></label></div><div class="chart-toolbar"><span class="chart-reading">${metricValue(points.at(-1)?.value??null,state.metric)}<small>${unit(state.metric)}</small></span><div class="segmented" role="group" aria-label="Chart date range">${[7,30,90,'all'].map(r=>`<button data-range="${r}" aria-pressed="${String(state.range)===String(r)}" class="${String(state.range)===String(r)?'selected':''}">${r==='all'?'All':r+'D'}</button>`).join('')}</div></div>${chart(points,state.metric,{mixed})}<div class="chart-foot"><span>${points.length} ${points.length===1?'reading':'readings'} in this range</span><span>${state.metric==='weightKg'&&summary.weekCount?`7-day mean: ${metricValue(summary.weekMean,'weightKg')} ${unit('weightKg')} · ${summary.weekCount} readings`:'Missing days are not filled in'}</span></div>${mixed?'<p class="inline-warning">Body-fat methods differ in this range. Points are shown without a connecting trend line.</p>':''}${points.length?`<details class="chart-data"><summary>View recorded values ${icon('plus')}</summary><div class="table-scroll"><table><thead><tr><th>Date</th><th>${esc(metricName)} (${unit(state.metric)})</th>${state.metric==='bodyFatPct'?'<th>Method</th>':''}</tr></thead><tbody>${[...points].reverse().map(p=>`<tr><td>${p.date}</td><td>${metricValue(p.value,state.metric)}</td>${state.metric==='bodyFatPct'?`<td>${esc(p.method)}</td>`:''}</tr>`).join('')}</tbody></table></div></details>`:''}</section><section>${heading('Tape measurements',button('Update','body-log','plus','textbtn'))}<div class="card measurement-grid">${BODY_FIELDS.map(([k,l])=>{const last=bodySummary(store.data,k,state.date).last;return `<button data-metric="${k}" class="measurement"><span>${l}</span><b>${metricValue(last?.value??null,k)}<small>${unit(k)}</small></b><small>${last?dateLabel(last.date):'Not recorded'}</small></button>`;}).join('')}</div></section></div><div class="secondary-column"><section class="card checkin-card"><span class="eyebrow">A MOMENT TO CHECK IN</span><div class="checkin-art">${icon('body')}<span class="orbit orbit-one"></span><span class="orbit orbit-two"></span></div><h3>Your body has<br>more than one metric.</h3><p>Log only what you measured. Leave the rest blank, and add the method behind each body-fat reading.</p>${button('Log measurements','body-log','plus','btn full')}</section>${comp?`<section class="card composition"><span class="eyebrow">SAME-DAY ESTIMATE</span><h3>Body composition</h3><div><span>Fat mass</span><b>${metricValue(comp.fat,'weightKg')} ${unit('weightKg')}</b></div><div><span>Fat-free mass</span><b>${metricValue(comp.fatFree,'weightKg')} ${unit('weightKg')}</b></div><p class="help">Calculated from the weight and body-fat percentage entered for ${dateLabel(state.date)}. Fat-free mass is not the same as muscle mass.</p></section>`:''}<div class="notice soft">${icon('lock')}<div><b>Your storage, clearly labelled</b><p>This repository is public. Measurements you save to GitHub can be viewed by others. No progress photos are uploaded.</p></div></div></div></div><section>${heading('Measurement history',button('Export CSV','body-export','download','textbtn'))}<div class="card">${rows.length?rows.slice(0,30).map(([date,d])=>`<button class="record-row" data-body-date="${date}"><span class="date-square"><small>${dateLabel(date,{month:'short'})}</small><b>${Number(date.slice(-2))}</b></span><span class="row-description"><b>${d.weightKg!=null?metricValue(d.weightKg,'weightKg')+' '+unit('weightKg'):'Body check-in'}${d.body?.bodyFatPct!=null?' · '+fmt(d.body.bodyFatPct)+'% body fat':''}</b><small>${BODY_FIELDS.filter(([k])=>d.body?.measurementsCm?.[k]!=null).length} tape measurements${d.body?.method?' · '+esc(d.body.method):''}</small></span>${icon('edit')}</button>`).join(''):empty('history','No measurements recorded','Your first check-in becomes your baseline.',button('Create a baseline','body-log','plus','btn secondary'))}</div></section>`;
}
function historyView(){
 const dates=Array.from({length:7},(_,i)=>shiftDate(state.date,i-6)),all=Object.entries(store.data.days).filter(([date])=>date<=state.date).sort(([a],[b])=>b.localeCompare(a)),max=Math.max(store.data.profile.targets.kcal||1,...dates.map(date=>totals(dayFor(store.data,date)).kcal));
 return `${intro('YOUR HISTORY','Your history','Every recorded day, with the gaps left honest.')}${dateControls()}<section class="card weekly-card"><div class="card-kicker"><h2>Last seven days</h2>${tag('LOGGED CALORIES')}</div><div class="bar-chart">${dates.map(date=>{const d=dayFor(store.data,date),t=totals(d);return `<button class="bar-column" data-date="${date}" aria-label="${date}: ${d.food.length?fmt(t.kcal)+' logged calories':'food not logged'}"><span>${d.food.length?fmt(t.kcal):'–'}</span><div class="bar-space"><i class="${date===state.date?'current':''}" style="height:${d.food.length?Math.max(2,t.kcal/max*100):0}%"></i></div><small>${dateLabel(date,{weekday:'short'})}</small></button>`;}).join('')}</div><p class="help">Bars show logged food only. A partial food log is not a full day’s intake.</p></section><section>${heading('Your daily records')}<div class="card">${all.map(([date,d])=>{const t=totals(d);return `<button class="record-row" data-date="${date}"><span class="date-square"><small>${dateLabel(date,{month:'short'})}</small><b>${Number(date.slice(-2))}</b></span><span class="row-description"><b>${dateLabel(date,{weekday:'long'})}</b><small>${d.food.length?d.food.length+' food entries':'Food not logged'} · ${d.workouts.length} sessions</small></span><span class="row-value"><b>${d.food.length?fmt(t.kcal):'–'}</b><small>kcal${t.missing.kcal?' + ?':''}</small></span>${icon('right')}</button>`;}).join('')||empty('history','No records yet','Your logs will appear here.')}</div></section>`;
}
function settingsView(){return `<div class="settings-layout"><section class="card preference-card"><span class="eyebrow">YOUR TRACKER</span><h3>Simple by design.</h3><p class="help">Food, body composition and workouts. Made for your day.</p><div class="preference-row theme-preference"><div><b>Color theme</b><p>A different light. The same clear view.</p></div>${themeChoices()}</div><div class="preference-row"><div><b>Measurement units</b><p>Saved in kilograms and centimetres.</p></div><div class="segmented" role="group" aria-label="Display units">${[['metric','kg / cm'],['imperial','lb / in']].map(([v,l])=>`<button data-units="${v}" aria-pressed="${state.units===v}" class="${state.units===v?'selected':''}">${l}</button>`).join('')}</div></div></section><section class="card settings-links">${[['Look & feel','appearance','spark','Glass clarity, colour and widget arrangement'],['Unfinished entries','drafts','history','Recover local drafts and resume your session'],['Targets & profile','targets','edit','Your daily targets and height'],[store.connected?'Manage connection':'Connect browser editing','connect','github',store.connected?'Connected as '+esc(store.account):'Save directly to your health record'],['Export health records','export','download','Download your food, body and workout data'],['Sync status','sync-info','refresh','Check your latest records']].map(([l,a,i,sub])=>`<button class="record-row" data-act="${a}"><span class="item-icon">${icon(i)}</span><span class="row-description"><b>${l}</b><small>${sub}</small></span>${icon('right')}</button>`).join('')}</section>${pwaCard()}</div>`;}


const TOKEN_URL='https://github.com/settings/personal-access-tokens/new?name=Cam%27s%20Health&description=Browser%20editing%20for%20Cam-s-Health&target_name=CameronNel&expires_in=30&contents=write';
let returnFocus=null,returnFocusSelector=null,dirty=false,closingFromHistory=false,sheetDetail=null;
function sheetBusy(){return !!$('form[aria-busy=true]',sheet);}
function openSheet(title,content,setup=()=>{},detail=null) {
  if(sheetBusy()){pendingDraftRoute=null;toast('Finishing your save. Please wait a moment.');return;}
  const focused=sheet.contains(document.activeElement)?document.activeElement:null,focusedSelector=logicalFocusSelector(focused),keepControl=$('#sheet-title',sheet)?.textContent===title&&focusedSelector?{selector:focusedSelector,index:$$(focusedSelector,sheet).indexOf(focused)}:null;
  clearTimeout(toast.t);toastElement.classList.remove('show');if(toastElement.matches('[popover]'))toastElement.hidePopover();
  cleanSheetTools();cleanSheetMedia();
  const route=pendingDraftRoute?{...pendingDraftRoute,units:state.units}:null;pendingDraftRoute=null;currentDraftRoute=route;currentSheetKey=pendingDraftKey||detail?.memoryKey||JSON.stringify(route?{module:route.module,type:route.type,mode:route.mode,id:route.id||route.recordId||route.recipeId||route.annotationId||route.food?.id||route.bundle?.id||'',key:route.key||route.metric||'',units:route.units,date:route.forDate||route.date||state.date}: {title,date:state.date,tracker:detail?.tracker||''});pendingDraftKey=null;
  if(!sheet.open){cleanLiquidScenes();returnFocus=document.activeElement;returnFocusSelector=logicalFocusSelector(returnFocus);history.pushState({...history.state,sheet:true,fullscreen:false},'');}
  const keepFull=sheet.open&&sheet.dataset.mode==='full';
  dirty=false;sheetDetail=detail;sheet.dataset.mode=keepFull?'full':'popup';sheet.dataset.tracker=detail?.tracker||'';
  if(keepFull&&detail)content=detail.full();
  returnToastToPage();
  sheet.innerHTML=`<div class="sheet-grip"></div><header class="sheet-head"><div><span class="micro-label">A CLOSER LOOK</span><h2 id="sheet-title">${title}</h2></div><div class="sheet-head-actions">${iconButton('Expand to full screen','expand-sheet','expand')}${iconButton('Close dialog','close-sheet','close')}</div></header><div class="pinch-guide">Pinch out for the full picture ${icon('expand')}</div><div class="sheet-content">${content}</div><div class="discard-confirm" hidden><b>Discard unsaved changes?</b><p>These edits have not been saved to GitHub.</p><div class="form-actions">${button('Keep editing','keep-editing','','btn secondary')}${button('Discard','discard','','btn danger')}</div></div>`;
  sheet.setAttribute('aria-labelledby','sheet-title');document.body.classList.add('sheet-open');
  if(!sheet.open)sheet.showModal();watchSheetInsets();if(toastElement.classList.contains('show'))presentToast();if(keepFull){const b=$('[data-act=expand-sheet]',sheet);b.innerHTML=icon('collapse');b.setAttribute('aria-label','Return to popup');$('.pinch-guide',sheet).innerHTML='Pinch in to return to your preview '+icon('collapse');}sheet.scrollTop=0;setup();attachSheetHolds();cleanSheetProgress=trackerShell.enhanceHolds(sheet);attachSheetDrafts();mountSheetMedia();trackerShell.restoreSheet(sheet,currentSheetKey);if(!sheet.contains(document.activeElement)){const same=keepControl?$$(keepControl.selector,sheet)[keepControl.index]:null;if(same)same.focus({preventScroll:true});else{const titleNode=$('#sheet-title',sheet);titleNode.tabIndex=-1;titleNode.focus({preventScroll:true});}}
}
function animateLens(from){
  if(!from||!sheet.open||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const to=sheet.getBoundingClientRect(),x=from.x+from.width/2-to.x-to.width/2,y=from.y+from.height/2-to.y-to.height/2;
  sheet.getAnimations().forEach(a=>a.cancel());
  sheet.animate([{transform:`translate(${x}px,${y}px) scale(${from.width/to.width},${from.height/to.height})`,opacity:.35,borderRadius:'34px'},{transform:'none',opacity:1,borderRadius:sheet.dataset.mode==='full'?'0px':'34px'}],{duration:480,easing:'cubic-bezier(.16,1,.3,1)'});
}
function setSheetMode(full,fromHistory=false){
  if(!sheet.open||full===(sheet.dataset.mode==='full'))return;
  const from=sheet.getBoundingClientRect(),focused=document.activeElement,expand=$('[data-act=expand-sheet]',sheet);
  sheet.dataset.mode=full?'full':'popup';
  if(sheetDetail&&!sheetDetail.preserveContent)replaceSheetContent((full?sheetDetail.full:sheetDetail.compact)());
  expand.innerHTML=icon(full?'collapse':'expand');expand.setAttribute('aria-label',full?'Return to popup':'Expand to full screen');expand.title=expand.getAttribute('aria-label');
  $('.pinch-guide',sheet).innerHTML=full?'Pinch in to return to your preview '+icon('collapse'):'Pinch out for the full picture '+icon('expand');
  sheet.scrollTop=0;
  updateSheetInsets();
  if(focused?.isConnected&&focused.matches('input,textarea,select'))focused.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
  if(!fromHistory){if(full)history.pushState({...history.state,sheet:true,fullscreen:true},'');else history.back();}
  if(focused===expand||!focused?.isConnected)expand.focus({preventScroll:true});animateLens(from);
}
const pinch=createPinchHandlers({expand:()=>setSheetMode(true),collapse:()=>setSheetMode(false),isExpanded:()=>sheet.dataset.mode==='full'});
sheet.addEventListener('touchstart',pinch.start,{passive:false});
sheet.addEventListener('touchmove',pinch.move,{passive:false});
sheet.addEventListener('touchend',pinch.end);
sheet.addEventListener('touchcancel',pinch.cancel);

function closeSheet(force=false) {
  if(!sheet.open)return;
  if(sheetBusy()){toast('Finishing your save. Please wait a moment.');return;}
  if(dirty&&!force){$('.discard-confirm',sheet).hidden=false;$('.discard-confirm button',sheet).focus();return;}
  dirty=false;sheet.close();
  if(history.state?.sheet&&!closingFromHistory)history.go(history.state.fullscreen?-2:-1);
}
sheet.addEventListener('cancel',event=>{event.preventDefault();closeSheet();});
sheet.addEventListener('keydown',event=>{
 if(event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey||!sheet.open)return;
 const items=$$('button,a[href],input,select,textarea,summary,[tabindex]',sheet).filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
 if(!items.length){event.preventDefault();return;}
 const first=items[0],last=items.at(-1),active=document.activeElement;
 if(event.shiftKey&&(active===first||!sheet.contains(active))){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&(active===last||!sheet.contains(active))){event.preventDefault();first.focus();}
});

sheet.addEventListener('input',e=>{if(e.target.closest('form')&&e.target.name!=='githubToken')dirty=true;});
let backdropPress=false;
sheet.addEventListener('pointerdown',e=>{
 const r=sheet.getBoundingClientRect();backdropPress=e.target===sheet&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);
 if(e.target.closest('.sheet-head button')&&document.body.classList.contains('keyboard-open'))e.preventDefault();
});
sheet.addEventListener('pointercancel',()=>{backdropPress=false;});
sheet.addEventListener('click',e=>{const beganOutside=backdropPress;backdropPress=false;if(e.target===sheet&&beganOutside){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSheet();}});
sheet.addEventListener('close',()=>{sheetInsetObserver.disconnect();cancelAnimationFrame(sheetInsetFrame);sheet.style.removeProperty('scroll-padding-top');sheet.style.removeProperty('scroll-padding-bottom');cleanSheetTools();cleanSheetMedia();disposeSheetHolds.forEach(fn=>fn());disposeSheetHolds=[];document.body.classList.remove('sheet-open');returnToastToPage();if(toastElement.classList.contains('show'))presentToast();sheet.innerHTML='';sheetDetail=null;demoContext=null;pinch.cancel();render();const focusTarget=returnFocus?.isConnected?returnFocus:returnFocusSelector?$(returnFocusSelector,root):null;if(focusTarget)focusTarget.focus({preventScroll:true});else $('#main')?.focus({preventScroll:true});});
function authFields(){return store.connected?`<p class="auth-status">${icon('lock')}Save to GitHub as ${esc(store.account)}. Verified after writing.</p>`:`<details class="inline-connect"><summary>${icon('github')}Connect GitHub to save here ${icon('plus')}</summary><p>Chat’s GitHub connection is separate from this browser. Create a fine-grained token for <b>only Cam-s-Health</b> with <b>Contents: Read and write</b>.</p><a class="btn secondary full" href="${TOKEN_URL}" target="_blank" rel="noopener noreferrer">Create token on GitHub ${icon('arrow')}</a><label class="field">GitHub token<input name="githubToken" type="password" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="Paste token in this form, never in chat"></label><small>Held in memory for this tab only. Never written into your repository or browser storage.</small></details>`;}
function numberField(name,label,value,{min=0,max=100000,step='any',help='',placeholder='Not measured',wide=false}={}){return `<label class="field ${wide?'wide':''}">${label}<input name="${name}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${value==null?'':esc(value)}" placeholder="${esc(placeholder)}">${help?`<small>${help}</small>`:''}</label>`;}
function saveFooter(label='Save to GitHub'){return `${authFields()}<div class="save-panel sticky-actions"><p class="form-error" role="alert" tabindex="0" id="form-error"></p><div class="form-actions">${button('Cancel','close-sheet','','btn secondary')}<button class="btn" type="submit">${icon('check')}<span>${label}</span></button></div></div>`;}
function wireForm(handler) {
  $('form',sheet).addEventListener('submit',async event=>{
    event.preventDefault();const form=event.target,fd=new FormData(form),controls=$$('input,select,textarea,button',form),error=$('#form-error',form);error.textContent='';
    if(!store.connected&&!fd.get('githubToken')?.trim()){const details=$('.inline-connect',form);if(details)details.open=true;error.textContent='Connect GitHub to save.';$('[name=githubToken]',form)?.focus();return;}
    const disabledStates=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);form.setAttribute('aria-busy','true');
    try {
      if(!store.connected)await store.connect(fd.get('githubToken'));
      const token=$('[name=githubToken]',form);if(token)token.value='';
      await handler(fd);form.removeAttribute('aria-busy');if(form.isConnected&&sheet.contains(form)){if(form.dataset.draftKey)trackerShell.clearDraft(form.dataset.draftKey);dirty=false;closeSheet(true);}toast('Saved and verified on GitHub.');
    }catch(e){error.textContent=e.message;if(form.isConnected)error.focus({preventScroll:true});}
    finally {controls.forEach((c,index)=>c.disabled=disabledStates[index]);form.removeAttribute('aria-busy');}
  });
}
function bodyForm(date=state.date){
 pendingDraftRoute={type:'body',date};
  const baseline=structuredClone(dayFor(store.data,date)),b=baseline.body||{},display={};
  const value=(key,raw)=>{const n=fromMetric(raw,key==='skeletalMuscleKg'?'weightKg':key,state.units);return display[key]=n==null?'':String(Math.round(n*100)/100);};
  const previous=k=>{const last=bodySummary(store.data,k,shiftDate(date,-1)).last;return last?`Previous: ${metricValue(last.value,k)} ${unit(k)} · ${dateLabel(last.date)}`:'';};
  openSheet('Body check-in',`<form id="body-form"><div class="form-date">${icon('calendar')}<b>${dateLabel(date,{weekday:'long',day:'numeric',month:'long'})}</b>${tag(state.units==='metric'?'kg / cm':'lb / in')}</div><p class="help">Enter readings for this date only. Blank means unknown, not zero. Existing values for this date can be corrected or cleared.</p><div class="form-grid">${numberField('weightKg',`Body weight (${unit('weightKg')})`,value('weightKg',baseline.weightKg),{min:.01,max:fromMetric(500,'weightKg',state.units),help:previous('weightKg')})}${numberField('bodyFatPct','Body fat (%)',value('bodyFatPct',b.bodyFatPct),{min:.01,max:99.9,help:previous('bodyFatPct')})}${numberField('skeletalMuscleKg',`Reported muscle (${unit('weightKg')})`,value('skeletalMuscleKg',b.skeletalMuscleKg),{min:.01,max:fromMetric(300,'weightKg',state.units),help:'Optional device reading. Not calculated from body fat.'})}<label class="field wide">Body-fat measurement method<select name="method">${METHODS.map(m=>`<option ${m===(b.method||METHODS[0])?'selected':''}>${m}</option>`).join('')}</select></label></div><details class="measurement-fields" ${BODY_FIELDS.some(([k])=>b.measurementsCm?.[k]!=null)?'open':''}><summary>${icon('tape')}<b class="tape-title">Tape measurements</b><span>13 optional fields</span>${icon('plus')}</summary><p class="help">Use the same landmarks and relaxed or flexed state each time. Record that context in your notes.</p><div class="form-grid">${BODY_FIELDS.map(([k,l])=>numberField(k,l+' ('+unit(k)+')',value(k,b.measurementsCm?.[k]),{min:.01,max:fromMetric(400,k,state.units),help:previous(k)})).join('')}</div></details><label class="field">Measurement notes<textarea name="notes" rows="3" maxlength="5000" placeholder="e.g. Morning, before breakfast; arms flexed">${esc(b.notes)}</textarea></label><div class="notice soft compact-notice">${icon('info')}<p>This repository is public. Saved measurements are publicly accessible.</p></div>${saveFooter('Save check-in')}</form>`,()=>wireForm(async fd=>{
    const read=(key,old)=>String(fd.get(key)??'')===display[key]?old??null:fd.get(key)===''?null:toMetric(Number(fd.get(key)),key==='skeletalMuscleKg'?'weightKg':key,state.units);
    const weight=read('weightKg',baseline.weightKg),body={...b,bodyFatPct:read('bodyFatPct',b.bodyFatPct),skeletalMuscleKg:read('skeletalMuscleKg',b.skeletalMuscleKg),method:fd.get('method'),measurementsCm:{...b.measurementsCm},notes:fd.get('notes').trim(),recordedAt:new Date().toISOString()};
    for(const [k] of BODY_FIELDS)body.measurementsCm[k]=read(k,b.measurementsCm?.[k]);
    if(weight==null&&body.bodyFatPct==null&&body.skeletalMuscleKg==null&&!Object.values(body.measurementsCm).some(v=>v!=null)&&!body.notes&&!baseline.body&&baseline.weightKg==null)throw Error('Enter at least one measurement or note.');
    await store.save(data=>{const day=ensureDay(data,date);assertUnchanged(day.weightKg,baseline.weightKg);assertUnchanged(day.body,baseline.body);day.weightKg=weight;day.body=body;},`Update body check-in for ${date}`);
  }));
}
function foodDetails(foodId){const f=dayFor(store.data,state.date).food.find(f=>f.id===foodId);if(!f)return;openSheet('Food details',`<div class="food-detail-top"><span class="item-icon large">${icon(foodIcon(f))}</span><h3>${esc(f.name)}</h3><p>${esc(f.quantity)}</p><strong>${fmt(f.kcal)}<small> kcal</small></strong>${tag(f.estimated?'Estimated nutrition':'Recorded nutrition')}</div><div class="detail-macros">${[['protein','Protein'],['carbs','Carbs'],['fat','Fat']].map(([k,l])=>`<div><span>${l}</span><b>${fmt(f[k])} <small>g</small></b></div>`).join('')}</div>${f.reviewRequired?'<div class="notice warning"><p>The recorded calories and macros need review. Original estimates are retained.</p></div>':''}${f.note?`<h4>Notes</h4><p class="help preserve">${esc(f.note)}</p>`:''}${f.source?`<details class="disclosure"><summary>Nutrition source ${icon('plus')}</summary><p class="help">${esc(f.source)}</p></details>`:''}<div class="form-actions">${button('Edit','food-edit','edit','btn',`data-id="${esc(f.id)}"`)}${button('Log again','food-repeat','plus','btn secondary',`data-id="${esc(f.id)}"`)}</div>`);}
function foodForm(existing=null,template=null){
 pendingDraftRoute={type:'food',date:state.date,recordId:existing?.id||''};
  const date=state.date,original=existing?structuredClone(existing):null,f=existing||template||{},entryId=existing?.id||id();
  openSheet(existing?'Edit food':'Log food',`<form><div class="form-date">${icon('calendar')} ${dateLabel(date,{weekday:'short',day:'numeric',month:'long'})}${template?tag('REPEAT PORTION'):''}</div><label class="field">Food or drink<input name="name" required maxlength="160" value="${esc(f.name)}" placeholder="What did you have?"></label><label class="field">Portion<input name="quantity" required maxlength="160" value="${esc(f.quantity)}" placeholder="e.g. 200 g cooked, or 1 scoop (30 g)"></label><div class="form-grid">${[['kcal','Calories (kcal)'],['protein','Protein (g)'],['carbs','Carbs (g)'],['fat','Fat (g)']].map(([k,l])=>numberField(k,l,f[k],{placeholder:'Unknown'})).join('')}</div><label class="checkbox-label"><input type="checkbox" name="estimated" ${f.estimated!==false?'checked':''}>Nutrition is an estimate</label><label class="field">Notes / label details<textarea name="note" maxlength="5000" rows="3">${esc(f.note)}</textarea></label><p class="help">Repeating a food copies its saved portion and nutrition. Review both when changing the serving size.</p>${existing?button('Delete this entry','food-delete','close','textbtn danger-text',`data-id="${esc(existing.id)}"`):''}${saveFooter()}</form>`,()=>wireForm(async fd=>{
    const entry={...f,id:entryId,name:fd.get('name').trim(),quantity:fd.get('quantity').trim(),estimated:fd.has('estimated'),note:fd.get('note').trim(),source:f.source||'Manually entered in Cam’s Health',loggedAt:original?.loggedAt||new Date().toISOString()};delete entry.date;
    for(const k of ['kcal','protein','carbs','fat'])entry[k]=fd.get(k)===''?null:Number(fd.get(k));
    if(!entry.name||!entry.quantity)throw Error('Enter a food name and portion.');
    entry.reviewRequired=entry.kcal!=null&&[entry.protein,entry.carbs,entry.fat].every(v=>v!=null)&&Math.abs(entry.kcal-(4*entry.protein+4*entry.carbs+9*entry.fat))>Math.max(25,entry.kcal*.1);
    await store.save(data=>upsert(ensureDay(data,date).food,entry,original),`${original?'Correct':'Log'} food for ${date}`);
  }));
}
function upsert(entries,entry,baseline){const index=entries.findIndex(e=>e.id===entry.id);if(index>=0&&JSON.stringify(entries[index])===JSON.stringify(entry))return;if(baseline){if(index<0)throw Error('This entry was removed elsewhere.');assertUnchanged(entries[index],baseline);entries[index]=entry;}else if(index<0)entries.push(entry);else throw Error('An entry with this ID already exists. Refresh and review it before retrying.');}
function recipeForm(recipeId){pendingDraftRoute={type:'recipe',date:state.date,recipeId};const recipe=store.data.recipes.find(r=>r.id===recipeId),date=state.date,entryId=id();if(!recipe)return;const per=recipe.per100g||recipe.per100Grams;if(!per)return toast('This recipe is missing its portion nutrition.');openSheet('Recipe portion',`<form><span class="eyebrow">SAVED RECIPE</span><h3>${esc(recipe.name)}</h3><p class="help">${fmt(recipe.yieldG)} g cooked batch. Nutrition scales from the saved per-100 g estimate.</p><label class="field">Your portion (grams)<input name="grams" id="recipe-grams" type="number" inputmode="decimal" required min="1" max="10000" step="any" placeholder="e.g. 200"></label><div id="recipe-preview" class="recipe-preview">Enter your portion to preview its nutrition.</div><p class="help preserve">${esc(recipe.note||recipe.notes)}</p>${saveFooter('Log portion')}</form>`,()=>{
    $('#recipe-grams',sheet).addEventListener('input',e=>{const g=Number(e.target.value);$('#recipe-preview',sheet).innerHTML=g>0?`<b>${per.kcal==null?'Unknown':fmt(round(per.kcal*g/100))} kcal</b><span>${per.protein==null?'Unknown':fmt(round(per.protein*g/100))} g protein · portion estimate</span>`:'Enter your portion to preview its nutrition.';});
    wireForm(async fd=>{const g=Number(fd.get('grams')),entry={id:entryId,recipeId,portionGrams:g,name:recipe.name,quantity:`${g} g cooked portion`,estimated:true,source:'Saved recipe '+recipeId,note:recipe.note||'',loggedAt:new Date().toISOString()};for(const k of ['kcal','protein','carbs','fat'])entry[k]=per[k]==null?null:round(per[k]*g/100);await store.save(data=>upsert(ensureDay(data,date).food,entry,null),`Log recipe portion for ${date}`);});
  });}
function performedSetDetails(workout){return (workout.actualExercises||[]).filter(e=>Array.isArray(e.setLog)).map(e=>`<section class="performed-set-detail"><h4>${esc(e.name)}</h4><div class="table-scroll"><table><thead><tr><th>Set</th><th>${e.measure==='seconds'?'Seconds':'Reps'}</th><th>${state.units==='imperial'?'lb':'kg'}</th><th>Effort</th></tr></thead><tbody>${e.setLog.map((set,index)=>`<tr><td>${index+1} · ${set.kind==='warmup'?'Warm-up':'Working'}</td><td>${fmt(set.reps)}</td><td>${fmt(fromMetric(set.load,'weightKg',state.units))}</td><td>${set.rir!=null?set.rir+' RIR':set.rpe!=null?set.rpe+' RPE':'–'}</td></tr>`).join('')}</tbody></table></div></section>`).join('');}
function recordDetails(recordId,date=state.date){const w=dayFor(store.data,date).workouts.find(w=>w.id===recordId);if(!w)return;openSheet('Your session',`<span class="eyebrow">${dateLabel(date,{weekday:'long',day:'numeric',month:'long'})}</span><h3 class="sheet-hero-title">${esc(w.name)}</h3><div class="workout-detail-stats">${tag(w.status==='completed'?'Completed':'Partial')}${tag(w.durationMin==null?'Duration not logged':fmt(w.durationMin)+' minutes')}${actualSets(w)?tag(actualSets(w)+' reported sets'):''}</div>${performedSetDetails(w)}${w.actualExercises?.length?`<div class="table-scroll recorded-exercise-summary"><table><thead><tr><th>Actual exercise</th><th>Sets</th><th>Reps</th><th>kg</th></tr></thead><tbody>${w.actualExercises.map(e=>`<tr><td>${esc(e.name)}</td><td>${fmt(e.sets)}</td><td>${esc(e.reps??'–')}</td><td>${fmt(e.load??e.loadKg)}</td></tr>`).join('')}</tbody></table></div>`:''}<p class="help preserve">${esc(w.notes||'No performance notes recorded.')}</p><div class="form-actions">${button('Edit session','workout-edit','edit','btn',`data-id="${esc(w.id)}" data-for-date="${date}"`)}${w.sessionId?button('See prescription','open-workout','arrow','btn secondary',`data-id="${esc(w.sessionId)}"`):''}</div>`);}
function exerciseRow(e={}){return `<div class="exercise-input"><label class="field exercise-name">Exercise<input name="exerciseName" value="${esc(e.name)}" maxlength="160" placeholder="e.g. Lateral raise"></label>${numberField('exerciseSets','Sets',e.sets,{max:100,step:1,placeholder:'–'})}<label class="field">Reps<input name="exerciseReps" value="${esc(e.reps)}" maxlength="50" placeholder="12, 11, 10"></label>${numberField('exerciseLoad','Load (kg)',e.load??e.loadKg,{max:1000,placeholder:'–'})}<button type="button" class="iconbtn remove-exercise" aria-label="Remove exercise">${icon('close')}</button></div>`;}
function workoutForm(existing=null,date=state.date,sessionId=null){
 pendingDraftRoute={type:'workout',date,recordId:existing?.id||'',sessionId:sessionId||''};
 const original=existing?structuredClone(existing):null,w=existing||{},entryId=w.id||id(),selected=original?(w.sessionId||'custom'):(sessionId||'custom');
 openSheet(existing?'Edit session':'Log a session',`<form><div class="form-date">${icon('calendar')}${dateLabel(date,{weekday:'long',day:'numeric',month:'long'})}</div><label class="field">Session<select name="sessionId" id="session-select"><option value="custom" ${selected==='custom'?'selected':''}>Custom session</option>${store.data.training.sessions.map(s=>`<option value="${esc(s.id)}" ${selected===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label class="field" id="custom-name">Session name<input name="name" maxlength="160" value="${esc(w.sessionId==null?w.name:'')}" placeholder="e.g. Back + Shoulders"></label><div class="form-grid">${numberField('durationMin','Duration (minutes)',w.durationMin,{min:1,max:1440,step:1,placeholder:'Unknown'})}<label class="field">Completion status<select name="status" required><option value="" ${!w.status&&selected!=='rest'?'selected':''}>Choose</option><option value="completed" ${w.status==='completed'||selected==='rest'?'selected':''}>Completed</option><option value="partial" ${w.status==='partial'?'selected':''}>Partial</option></select><small>Only completed prescribed sessions advance the rotation; partial sessions keep your place.</small></label></div><details class="measurement-fields" ${w.actualExercises?.length?'open':''}><summary>${icon('train')}Actual exercises <span>Optional</span>${icon('plus')}</summary><p class="help">Only enter work you actually did. Reps can be a list (12, 11, 10). Loads are recorded in kilograms.</p><div id="exercise-inputs">${(w.actualExercises||[]).map(exerciseRow).join('')}</div>${button('Add exercise','add-exercise','plus','btn secondary')}</details><label class="field">Session notes<textarea name="notes" rows="3" maxlength="5000" placeholder="How it felt, substitutions, any pain">${esc(w.notes)}</textarea></label>${existing?button('Delete this session','workout-delete','close','textbtn danger-text',`data-id="${esc(w.id)}" data-for-date="${date}"`):''}${saveFooter('Save session')}</form>`,()=>{
 const select=$('#session-select',sheet),toggle=()=>{$('#custom-name',sheet).hidden=select.value!=='custom';};toggle();select.addEventListener('change',toggle);
 wireForm(async fd=>{const sid=fd.get('sessionId'),s=store.data.training.sessions.find(s=>s.id===sid),exercises=$$('.exercise-input',sheet).map(row=>({name:$('[name=exerciseName]',row).value.trim(),sets:$('[name=exerciseSets]',row).value===''?null:Number($('[name=exerciseSets]',row).value),reps:$('[name=exerciseReps]',row).value.trim()||null,load:$('[name=exerciseLoad]',row).value===''?null:Number($('[name=exerciseLoad]',row).value)})).filter(e=>e.name||e.sets!=null||e.reps||e.load!=null);for(let i=0;i<exercises.length;i++){const prior=w.actualExercises?.[i];if(!prior)continue;const same=['name','sets','reps','load'].every(key=>String(exercises[i][key]??'')===String((key==='load'?prior.load??prior.loadKg:prior[key])??''));if(prior.setLog&&!same)throw Error('Use the set editor to correct this detailed performance.');if(same)exercises[i]=structuredClone(prior);}if(w.actualExercises?.some(e=>e.setLog)&&exercises.length!==w.actualExercises.length)throw Error('Use the set editor to correct this detailed performance.');if(exercises.some(e=>!e.name))throw Error('Name each actual exercise, or remove the empty row.');const entry={...w,id:entryId,sessionId:sid==='custom'?null:sid,name:s?.name||fd.get('name').trim(),status:fd.get('status'),durationMin:fd.get('durationMin')===''?null:Number(fd.get('durationMin')),notes:fd.get('notes').trim(),actualExercises:exercises,loggedAt:w.loggedAt||new Date().toISOString()};if(!entry.name)throw Error('Give this custom session a name.');await store.save(data=>upsert(ensureDay(data,date).workouts,entry,original),`Log training for ${date}`);});
 });
}
function metricForm(type){const d=dayFor(store.data,state.date),date=state.date,config={steps:['steps','Daily steps','Total steps for this date',200000],water:['waterMl','Water intake','Total water (ml)',20000],notes:['notes','Day notes','Your notes',0]}[type];const [key,title,label,max]=config,baseline=d[key];openSheet(title,`<form><div class="form-date">${icon('calendar')}${dateLabel(date,{weekday:'long',day:'numeric',month:'long'})}</div>${type==='notes'?`<label class="field">${label}<textarea name="value" rows="5" maxlength="5000">${esc(baseline)}</textarea></label>`:numberField('value',label,baseline,{max,step:1,placeholder:'Not logged'})}<p class="help">${type==='notes'?'Saved with this date.':'This replaces the daily total. It does not add to the previous number. Leave blank to clear it.'}</p>${saveFooter()}</form>`,()=>wireForm(async fd=>{const value=type==='notes'?fd.get('value'):fd.get('value')===''?null:Number(fd.get('value'));await store.save(data=>{const d=ensureDay(data,date);assertUnchanged(d[key],baseline);d[key]=value;},`Update ${type} for ${date}`);}));}
function deleteForm(kind,entry,date){openSheet('Delete this record?',`<form><h3>${esc(entry.name)}</h3><p class="help">This removes the ${kind==='food'?'food entry':'session'} for ${dateLabel(date)}. Its older versions remain in GitHub’s commit history. Other records are preserved.</p>${saveFooter('Confirm delete')}</form>`,()=>wireForm(async()=>{await store.save(data=>{const list=ensureDay(data,date)[kind],current=list.find(e=>e.id===entry.id);if(current)assertUnchanged(current,entry);ensureDay(data,date)[kind]=list.filter(e=>e.id!==entry.id);},`Delete ${kind} record for ${date}`);}));}
function connectForm(){
 openSheet('Connect GitHub',`<div class="connect-intro"><span class="item-icon large">${icon('github')}</span><h3>${store.connected?'This tab is authorized.':'Your repo. Your control.'}</h3><p>Read-only access is automatic. To save directly from your phone, authorize this browser separately from ChatGPT.</p></div>${store.connected?`<div class="notice soft">${icon('check')}<p>Signed in as <b>${esc(store.account)}</b>. Token held in memory only. Contents write access is checked on your first save.</p></div>${button('Disconnect this tab','disconnect','lock','btn secondary full')}`:`<form id="connect-form"><div class="connection-steps"><div><b>01</b><p>Create a fine-grained token. Select <strong>only Cam-s-Health</strong> under repository access.</p></div><div><b>02</b><p>Grant <strong>Contents: Read and write</strong>. No other write permissions are needed for tracking.</p></div><div><b>03</b><p>Paste the token below. Do not send it in a chat message.</p></div></div><a class="btn secondary full" href="${TOKEN_URL}" target="_blank" rel="noopener noreferrer">Open GitHub token setup ${icon('arrow')}</a><label class="field">GitHub token<input name="token" type="password" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste securely into this field"></label><p class="help">The token is sent only to api.github.com. It is never stored in browser storage, source code, exports, or health.json. Closing this tab disconnects it.</p><p id="form-error" class="form-error" role="alert"></p><button class="btn full" type="submit">${icon('github')}Authorize this tab</button></form>`}<p class="help privacy-copy">Your GitHub repository is public. Connecting does not make its food or measurement records private.</p>`,()=>{
 const form=$('#connect-form',sheet);if(!form)return;form.addEventListener('submit',async e=>{e.preventDefault();const input=$('[name=token]',form),button=$('[type=submit]',form);button.disabled=true;form.setAttribute('aria-busy','true');try{await store.connect(input.value);input.value='';form.removeAttribute('aria-busy');if(form.isConnected&&sheet.contains(form)){dirty=false;closeSheet(true);}toast('GitHub token accepted. This tab can attempt saves.');}catch(e){$('#form-error',form).textContent=e.message;}finally{button.disabled=false;form.removeAttribute('aria-busy');}});
 });
}
function targetsForm(){pendingDraftRoute={type:'targets',date:state.date};const baseline=structuredClone(store.data.profile),targets=baseline.targets,height=fromMetric(baseline.heightCm,'heightCm',state.units),displayHeight=height==null?'':String(Math.round(height*100)/100);openSheet('Targets & profile',`<form><p class="help">These are your chosen tracking targets, not an estimate of maintenance calories. Blank leaves a target unset.</p><div class="form-grid">${[['kcal','Daily calories (kcal)'],['protein','Protein (g)'],['carbs','Carbs (g)'],['fat','Fat (g)']].map(([k,l])=>numberField(k,l,targets[k],{min:k==='kcal'?1:0,placeholder:'No target',step:k==='steps'?1:'any'})).join('')}${numberField('heightCm','Height ('+unit('heightCm')+')',displayHeight,{min:.1,max:fromMetric(300,'heightCm',state.units)})}</div><label class="field">Training status<select name="trainingStatus">${[['awaiting clearance','Not cleared'],['paused','Paused'],['ready','Ready']].map(([v,l])=>`<option value="${v}" ${baseline.trainingStatus===v?'selected':''}>${l}</option>`).join('')}</select><small>Only select ready when you have confirmed you can resume training. Logged sessions do not establish medical clearance.</small></label>${saveFooter('Save preferences')}</form>`,()=>wireForm(async fd=>{const target={...baseline.targets};for(const k of ['kcal','protein','carbs','fat'])target[k]=fd.get(k)===''?null:Number(fd.get(k));const h=String(fd.get('heightCm'))===displayHeight?baseline.heightCm??null:fd.get('heightCm')===''?null:toMetric(Number(fd.get('heightCm')),'heightCm',state.units);await store.save(data=>{assertUnchanged(data.profile.targets,baseline.targets);assertUnchanged(data.profile.heightCm,baseline.heightCm);assertUnchanged(data.profile.trainingStatus,baseline.trainingStatus);data.profile.targets=target;data.profile.heightCm=h;data.profile.trainingStatus=fd.get('trainingStatus');if(data.profile.trainingStatus!==baseline.trainingStatus)data.profile.trainingNote='Training status explicitly updated by the user in app settings.';},'Update targets and profile');}));}
function quickLog(){openSheet('What are we logging?',`<p class="help">For ${dateLabel(state.date,{weekday:'long',day:'numeric',month:'long'})}.</p><div class="quick-grid">${[['Food or drink','food-log','food','Calories & macros'],['Body check-in','body-log','body','Weight, fat & measurements'],['Workout','workout-log','train','Your actual session']].map(([l,a,i,s])=>`<button class="quick-choice" data-act="${a}"><span class="item-icon">${icon(i)}</span><b>${l}</b><small>${s}</small></button>`).join('')}</div>`);}
function syncInfo(){openSheet('Sync diagnostics',`<div class="notice ${store.error?'warning':'soft'}">${icon(store.error?'info':'check')}<div><b>${esc(store.status)}</b><p>${store.error?esc(store.error):'The last accepted file passed the entry-ID and body-measurement validators.'}</p></div></div><dl class="diagnostics"><dt>Repository</dt><dd>${REPO}</dd><dt>Record</dt><dd>dist/data/health.json · main</dd><dt>Data timestamp</dt><dd>${esc(store.data?.updatedAt||'Unknown')}</dd><dt>Last successful read</dt><dd>${esc(store.checkedAt||'Not verified')}</dd><dt>Browser authorization</dt><dd>${store.connected?'Token accepted; writes verified on save':'Read only. Chat uses a separate connection.'}</dd><dt>Last verified browser save</dt><dd>${store.lastCommit?esc(store.lastCommit.slice(0,12)):'No save in this tab'}</dd></dl><p class="help">Public reads try GitHub raw content first and the API second. Invalid records are rejected with a precise error. Cached data is explicitly marked as not live.</p><div class="form-actions">${button('Refresh','refresh-sheet','refresh')}${button('Connection','connect','github','btn secondary')}</div>`);}
function briefSheet(){openSheet('Your daily brief',`<pre class="brief-text">${esc(brief(store.data,state.date))}</pre><div class="form-actions">${button('Copy brief','copy-brief','copy')}${button('Print','print','download','btn secondary')}</div>`);}
async function copyText(text){try{await navigator.clipboard.writeText(text);toast('Copied.');}catch{openSheet('Copy your brief',`<textarea readonly class="copy-area" aria-label="Copyable daily brief">${esc(text)}</textarea>`);$('.copy-area',sheet).select();}}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportBody(){const columns=['Date','Weight kg','Body fat %','Method',...BODY_FIELDS.map(([,l])=>l+' cm')],rows=bodyDays(store.data,state.date).reverse().map(([date,d])=>[date,d.weightKg??'',d.body?.bodyFatPct??'',d.body?.method??'',...BODY_FIELDS.map(([k])=>d.body?.measurementsCm?.[k]??'')]);const csv=[columns,...rows].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');download(`cams-body-${state.date}.csv`,'\uFEFF'+csv,'text/csv;charset=utf-8');toast('Body history exported.');}
function startTimer(seconds){state.timerEnd=Date.now()+seconds*1000;state.timerPaused=0;persist('timer',String(state.timerEnd));updateTimer();toast(`${seconds}s rest timer started.`);}
function remaining(){return state.timerEnd?Math.max(0,Math.ceil((state.timerEnd-Date.now())/1000)):state.timerPaused;}
function timerClock(n){return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
function timerSheet(){openSheet('Rest timer',`<div class="timer-face"><span class="eyebrow">BETWEEN SETS</span><strong id="timer-display">${timerClock(remaining())}</strong><p>A timer, not a workout duration log.</p></div><div class="timer-presets">${[60,90,120,180].map(s=>`<button data-seconds="${s}" class="btn secondary">${s}s</button>`).join('')}</div><div class="form-actions">${button('Pause / resume','timer-pause','timer','btn secondary')}${button('+30 seconds','timer-add','plus','btn secondary')}${button('Reset','timer-reset','close','textbtn')}</div><p class="help">The timer uses the clock when you switch tabs. Your browser may delay the alert while the app is in the background.</p>`);updateTimer();}
function updateTimer(){const dock=$('#timer-dock'),left=remaining(),active=state.timerEnd||state.timerPaused;dock.hidden=!active;if(active){dock.innerHTML=`<button data-act="timer">${icon('timer')}<b>${timerClock(left)}</b><span>${state.timerEnd?'Rest timer':'Paused'}</span></button>${iconButton('Stop rest timer','timer-reset','close')}`;const display=$('#timer-display');if(display)display.textContent=timerClock(left);}if(state.timerEnd&&left===0){state.timerEnd=0;persist('timer','0');dock.hidden=true;const display=$('#timer-display');if(display)display.textContent='0:00';toast('Rest timer finished.');if(document.visibilityState==='visible')navigator.vibrate?.(150);}}
setInterval(updateTimer,500);
function readRoute(){const date=new URL(location.href).searchParams.get('date');if(validDate(date))state.date=date;state.view='dashboard';state.detail=null;}
function navigate(view,detail=null){
  if(detail){state.detail=detail;openSheet('Workout',workoutDetails());setSheetMode(true);return;}
  if(view==='settings')return openSheet('Tracker settings',settingsView());
  if(view==='history')return openSheet('Health history',historyView());
  if(['nutrition','body','training'].includes(view))return openTracker({nutrition:'food',body:'body',training:'workouts'}[view],true);
  closeSheet(true);render();window.scrollTo({top:0,behavior:'smooth'});
}
function replaceSheetContent(content){cleanSheetTools();cleanSheetMedia();$('.sheet-content',sheet).innerHTML=content;attachSheetHolds();cleanSheetProgress=trackerShell.enhanceHolds(sheet);attachSheetDrafts();mountSheetMedia();}
function selectDate(date){if(sheetBusy())return toast('Finishing your save. Please wait a moment.');if(!validDate(date))return;state.date=date;const url=new URL(location.href);url.searchParams.set('date',date);url.hash='dashboard';history.replaceState(history.state||{sheet:false},'',url);render();if(sheet.open&&sheetDetail){replaceSheetContent((sheet.dataset.mode==='full'?sheetDetail.full:sheetDetail.compact)());}}
window.addEventListener('popstate',()=>{
  if(sheetBusy()){history.pushState({...history.state,sheet:true,fullscreen:sheet.dataset.mode==='full'},'');toast('Finishing your save. Please wait a moment.');return;}
  if(sheet.open&&history.state?.sheet){setSheetMode(!!history.state.fullscreen,true);return;}
  if(sheet.open){if(dirty){history.pushState({...history.state,sheet:true,fullscreen:sheet.dataset.mode==='full'},'');closeSheet();}else{closingFromHistory=true;closeSheet(true);closingFromHistory=false;}return;}
  readRoute();render();
});

window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
let disposeHolds=[];
function bindHold(el,open,preview=open){
  const h=createPressHandlers({open,preview:()=>{trackerShell.pulseHold();preview();}});
  const bindings={pointerdown:h.down,pointermove:h.move,pointerup:h.up,pointercancel:h.cancel,pointerleave:h.cancel,click:h.click,contextmenu:h.context};
  for(const [name,fn] of Object.entries(bindings))el.addEventListener(name,fn);
  return ()=>{h.cancel();for(const [name,fn] of Object.entries(bindings))el.removeEventListener(name,fn);};
}
function attachHolds(){disposeHolds.forEach(fn=>fn());disposeHolds=[];$$('[data-peek]',root).forEach(el=>disposeHolds.push(bindHold(el,()=>openTracker(el.dataset.peek),()=>{
  if(el.dataset.peek!=='workouts')return openTracker(el.dataset.peek);
  const latest=dayFor(store.data,state.date).workouts.at(-1),next=nextSession(store.data,state.date);
  if(latest&&(latest.actualExercises?.length||store.data.training.sessions.find(s=>s.id===latest.sessionId)?.exercises.length))return previewRecordedWorkout(latest.id,state.date);
  if(next?.exercises.length)return previewWorkout(next.id);
  openTracker('workouts');
})));}
let disposeSheetHolds=[];
function attachSheetHolds(){
  disposeSheetHolds.forEach(fn=>fn());disposeSheetHolds=[];
  $$('[data-workout]',sheet).forEach(el=>disposeSheetHolds.push(bindHold(el,()=>navigate('training',el.dataset.workout),()=>previewWorkout(el.dataset.workout))));
  $$('[data-exercise-session]',sheet).forEach(el=>disposeSheetHolds.push(bindHold(el,()=>previewWorkout(el.dataset.exerciseSession,Number(el.dataset.exerciseIndex)))));
  $$('[data-record]',sheet).forEach(el=>disposeSheetHolds.push(bindHold(el,()=>recordDetails(el.dataset.record,el.dataset.recordDate),()=>previewRecordedWorkout(el.dataset.record,el.dataset.recordDate))));
}

let demoContext=null;
function exerciseStudio(context,index){
  const exercise=context.exercises[index],demo=findExerciseDemo(exercise.name),count=context.exercises.length;
  const variant=demo?.variants?.[0]?.id||'',view=trackerShell.recall('demo:'+demo?.id,{angle:'three-quarter',side:'right',speed:'1',overlay:'false',progress:'0'});
  return `<section class="exercise-studio"><button type="button" class="demo-back" data-act="demo-back">${icon('left')}<span>${esc(context.title)}</span></button><div class="demo-heading"><span class="eyebrow">${context.prescribed?'YOUR PROGRAM':'YOUR RECORDED MOVEMENTS'} · ${String(index+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}</span><h3>${esc(exercise.name)}</h3><p>${esc(demo?.focus||'Movement details')}</p></div>${demo?`<div class="demo-stage-wrap"><div class="exercise-stage exercise-demo-stage" data-exercise-demo="${esc(demo.id)}" data-variant="${esc(variant)}" data-demo-angle-value="${esc(view.angle)}" data-demo-side-value="${esc(view.side)}" data-demo-speed-value="${esc(view.speed)}" data-demo-overlay-value="${esc(view.overlay)}" data-demo-progress-value="${esc(view.progress)}" role="img" aria-label="Looping illustration of ${esc(demo.name)}"><span class="demo-loading">Preparing your movement</span></div><span class="demo-stage-label" aria-hidden="true">MOVEMENT STUDY</span><span class="demo-stage-index" aria-hidden="true">${String(index+1).padStart(2,'0')}</span></div><div class="demo-transport"><button type="button" data-demo-toggle aria-label="Pause demonstration">Pause</button><span data-demo-phase>Controlled movement</span><span class="demo-loop-mark">${icon('refresh')}Loop</span></div><details class="demo-options"><summary>Camera & playback ${icon('plus')}</summary><div class="demo-camera-controls" role="group" aria-label="Camera angle">${[['three-quarter','¾ view'],['front','Front'],['side','Side'],['rear','Rear']].map(([v,l])=>`<button type="button" data-demo-angle="${v}">${l}</button>`).join('')}</div><div class="demo-side-controls" data-demo-side-controls role="group" aria-label="Working side"><button type="button" data-demo-side="left">Left side</button><button type="button" data-demo-side="right">Right side</button></div><div class="demo-playback-controls"><label class="demo-scrub-label">Movement timeline<input data-demo-scrub type="range" min="0" max="100" step=".1" value="${esc(view.progress||0)}" aria-label="Movement timeline"></label><label>Speed<select data-demo-speed aria-label="Playback speed">${[['0.5','0.5×'],['1','1× · Real time'],['1.5','1.5×']].map(([v,l])=>`<option value="${v}" ${String(view.speed)===v?'selected':''}>${l}</option>`).join('')}</select></label><button type="button" data-demo-overlay>Movement paths</button></div></details>${demo.variants?.length>1?`<div class="demo-variants" role="group" aria-label="Demonstration variation">${demo.variants.map((v,i)=>`<button type="button" data-demo-variant="${esc(v.id)}" aria-pressed="${i===0}">${esc(v.label)}</button>`).join('')}</div>`:''}`:`<div class="demo-unavailable">${icon('train')}<p>An illustration for this custom movement isn’t available yet.</p></div>`}<div class="demo-pagination">${iconButton('Previous exercise','demo-step','left',`data-step="-1" ${index===0?'disabled':''}`)}<div><b>${String(index+1).padStart(2,'0')}<span> / ${String(count).padStart(2,'0')}</span></b><small>${context.prescribed?`${esc(exercise.sets)} sets · ${esc(exercise.reps)}${/sec/i.test(exercise.reps)?'':' reps'} prescribed`:'Illustration · not a performance record'}</small></div>${iconButton('Next exercise','demo-step','right',`data-step="1" ${index===count-1?'disabled':''}`)}</div>${count>1?`<div class="demo-sequence" role="group" aria-label="Choose an exercise">${context.exercises.map((e,i)=>`<button type="button" data-act="demo-select" data-index="${i}" aria-pressed="${index===i}"><span>${String(i+1).padStart(2,'0')}</span>${esc(e.name)}</button>`).join('')}</div>`:''}${demo?`<section class="demo-cues"><span class="eyebrow">THE MOVEMENT</span><ol>${demo.cues.map((cue,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><p>${esc(cue)}</p></li>`).join('')}</ol><p class="demo-equipment">${icon('train')}${esc(Array.isArray(demo.equipment)?demo.equipment.join(' · '):demo.equipment)}</p></section>`:''}${exercise.note?`<details class="demo-program-note"><summary>Your program notes ${icon('plus')}</summary><p>${esc(exercise.note)}</p></details>`:''}${store.data.profile.trainingStatus==='ready'?'':`<p class="demo-clearance">${esc(store.data.profile.trainingStatus==='paused'?'Training is paused.':'Exercise clearance is unconfirmed.')} Viewing a demonstration does not change your training status.</p>`}</section>`;
}
function openExerciseStudio(context,index=0,resetMode=true){
  if(!context.exercises.length)return;
  rememberDemo();index=Math.max(0,Math.min(context.exercises.length-1,index));demoContext={...context,index};
  const from=$('[data-exercise-session="'+CSS.escape(context.sessionId||'')+'"][data-exercise-index="'+index+'"]',sheet)?.getBoundingClientRect();
  if(resetMode&&sheet.dataset.mode==='full')setSheetMode(false);
  const content=()=>exerciseStudio(context,index);
  openSheet('Movement studio',content(),()=>{}, {compact:content,full:content,tracker:'exercise',preserveContent:true,memoryKey:'exercise:'+(context.memoryId||context.sessionId||context.title)});
  if(resetMode)animateLens(from);
}
function previewWorkout(sid,index=null){
 if(index==null)index=Number(trackerShell.recall('exercise:'+sid,0))||0;
  const s=store.data.training.sessions.find(s=>s.id===sid);if(!s)return;
  if(!s.exercises.length)return openSheet('Recovery',`<h3 class="sheet-hero-title">${esc(s.name)}</h3><p class="help">${esc(s.focus)}</p>${button('Open rest day','open-workout','arrow','btn full',`data-id="${esc(s.id)}"`)}`);
  openExerciseStudio({title:s.name,sessionId:s.id,exercises:s.exercises,prescribed:true,back:()=>navigate('training',sid)},index);
}
function previewRecordedWorkout(recordId,date){
  const w=dayFor(store.data,date).workouts.find(w=>w.id===recordId);if(!w)return;
  const s=store.data.training.sessions.find(s=>s.id===w.sessionId),actual=w.actualExercises?.length?w.actualExercises:null,exercises=actual||s?.exercises||[];
  if(!exercises.length)return recordDetails(recordId,date);
  const memoryId='record:'+date+':'+recordId;openExerciseStudio({title:w.name,memoryId,sessionId:s?.id,exercises,prescribed:!actual,back:()=>recordDetails(recordId,date)},Number(trackerShell.recall('exercise:'+memoryId,0))||0);
}
async function action(act,b){
 if(sheetBusy()&&act!=='expand-sheet')return toast('Finishing your save. Please wait a moment.');
 if(act==='set-theme'){state.theme=b?.dataset.themeChoice==='light'?'light':'dark';persist('theme',state.theme);applyTheme();render();for(const choice of $$('[data-theme-choice]',sheet)){const selected=choice.dataset.themeChoice===state.theme;choice.setAttribute('aria-pressed',String(selected));choice.classList.toggle('selected',selected);}return;}
 if(act==='expand-sheet')return setSheetMode(sheet.dataset.mode!=='full');if(act==='close-sheet')return closeSheet();if(act==='discard'){clearSheetDrafts();dirty=false;return closeSheet(true);}if(act==='keep-editing'){$('.discard-confirm',sheet).hidden=true;return;}
 if(act==='food-tools')return foodStudio.open('hub');if(act==='food-recipes')return foodStudio.open('recipes');if(act==='body-tools')return bodyStudio.open('home');if(act==='workouts-tools')return workoutStudio.open();
 if(act==='quick-weigh')return bodyStudio.quickWeigh();if(act==='workout-start')return workoutStudio.startSession(b?.dataset.session||state.detail);if(act==='workout-resume')return workoutStudio.resume();
 if(act==='appearance')return trackerShell.openPreferences();if(act==='drafts')return trackerShell.openDrafts();if(act==='undo-save')return undoSave();if(act==='dismiss-undo'){lastUndo=null;return updateUndoDock();}
 if(act==='quick')return quickLog();if(act==='body-log')return bodyForm();if(act==='food-log')return foodForm();if(act==='workout-log')return workoutForm(null,state.date,b?.dataset.session||state.detail);
 if(['steps','water','notes'].includes(act))return metricForm(act);

 if(act==='refresh')return store.load();if(act==='refresh-sheet'){closeSheet(true);return store.load();}
 if(act==='today')return selectDate(today(store.data.profile.timezone));if(act==='prev'||act==='next')return selectDate(shiftDate(state.date,act==='prev'?-1:1));
 if(['training','body','history','settings'].includes(act))return navigate(act);if(act==='food-page')return navigate('nutrition');
 if(act==='open-workout')return navigate('training',b.dataset.id);
 if(act==='demo-back')return demoContext?.back();
 if(act==='demo-step'||act==='demo-select'){if(demoContext){const context=demoContext,index=act==='demo-step'?context.index+Number(b.dataset.step):Number(b.dataset.index);openExerciseStudio(context,index,false);}return;}
 if(act==='connect')return connectForm();if(act==='disconnect'){store.disconnect();closeSheet(true);toast('Disconnected. Read-only access remains available.');return;}
 if(act==='sync-info')return syncInfo();if(act==='targets')return targetsForm();if(act==='brief')return briefSheet();if(act==='copy-brief')return copyText(brief(store.data,state.date));
 if(act==='print'){navigate('dashboard');setTimeout(()=>window.print(),150);return;}
 if(act==='export')return download(`cams-health-${state.date}.json`,JSON.stringify(store.data,null,2),'application/json');if(act==='body-export')return exportBody();
 if(act==='food-edit'||act==='food-repeat'||act==='food-delete'){const f=dayFor(store.data,state.date).food.find(f=>f.id===b.dataset.id);if(!f)return;if(act==='food-edit')return foodForm(f);if(act==='food-repeat')return foodForm(null,f);return deleteForm('food',f,state.date);}
 if(act==='workout-edit'||act==='workout-delete'){const date=b.dataset.forDate,w=dayFor(store.data,date).workouts.find(w=>w.id===b.dataset.id);if(!w)return;return act==='workout-edit'?(w.actualExercises?.some(e=>Array.isArray(e.setLog))?workoutStudio.editRecord(w,date):workoutForm(w,date)):deleteForm('workouts',w,date);}
 if(act==='add-exercise'){$('#exercise-inputs',sheet).insertAdjacentHTML('beforeend',exerciseRow());dirty=true;return;}
 if(act==='timer')return timerSheet();if(act==='timer-reset'){state.timerEnd=0;state.timerPaused=0;persist('timer','0');$('#timer-display')?.replaceChildren('0:00');updateTimer();return;}
 if(act==='timer-add')return startTimer(remaining()+30);if(act==='timer-pause'){const left=remaining();if(state.timerEnd){state.timerPaused=left;state.timerEnd=0;persist('timer','0');}else if(left)startTimer(left);updateTimer();}
}
document.addEventListener('click',async e=>{
 if(e.target.closest('[data-fs]')){await foodStudio.handleClick(e);return;}if(bodyStudio.handleClick(e))return;if(e.target.closest('[data-ws]')){await workoutStudio.handleClick(e);return;}
 if(e.target.closest('[data-home]')){e.preventDefault();navigate('dashboard');return;}
 const b=e.target.closest('button');if(!b)return;
 try {
 if(b.dataset.peek||b.dataset.workout||b.dataset.exerciseSession||b.dataset.record||b.hasAttribute('data-demo-toggle')||b.hasAttribute('data-demo-variant'))return;
 if(b.matches('.remove-exercise')){b.closest('.exercise-input').remove();dirty=true;return;}
 if(b.dataset.life){e.preventDefault();return await pwaAction(b.dataset.life);}
 if(b.dataset.act){e.preventDefault();return await action(b.dataset.act,b);}
 if(b.dataset.view)return navigate(b.dataset.view);
 if(b.dataset.date)return selectDate(b.dataset.date,'dashboard');
 if(b.dataset.food)return foodDetails(b.dataset.food);
 if(b.dataset.workout)return navigate('training',b.dataset.workout);
 if(b.dataset.preview)return previewWorkout(b.dataset.preview);
 if(b.dataset.record)return recordDetails(b.dataset.record,b.dataset.recordDate);
 if(b.dataset.repeat){const f=dayFor(store.data,b.dataset.origin).food.find(f=>f.id===b.dataset.repeat);return foodForm(null,f);}
 if(b.dataset.recipe)return recipeForm(b.dataset.recipe);
 if(b.dataset.bodyDate)return bodyForm(b.dataset.bodyDate);
 if(b.dataset.metric){state.metric=b.dataset.metric;trackerShell.remember('bodyMetric',state.metric);openTracker('body',true);return;}
 if(b.dataset.range){state.range=b.dataset.range==='all'?'all':Number(b.dataset.range);trackerShell.remember('bodyRange',state.range);replaceSheetContent(trackerFull('body'));return;}
 if(b.dataset.units){state.units=b.dataset.units;persist('units',state.units);render();if(sheetDetail)replaceSheetContent((sheet.dataset.mode==='full'?sheetDetail.full:sheetDetail.compact)());else if($('#sheet-title',sheet)?.textContent==='Tracker settings')$('.sheet-content',sheet).innerHTML=settingsView();return;}
 if(b.dataset.seconds){e.preventDefault();startTimer(Number(b.dataset.seconds));}
 } catch(error){toast(error.message);}
});
document.addEventListener('change',e=>{if(bodyStudio.handleChange?.(e)||workoutStudio.handleChange?.(e)||foodStudio.handleChange?.(e))return;if(e.target.id==='view-date')selectDate(e.target.value);if(e.target.id==='metric-select'){state.metric=e.target.value;trackerShell.remember('bodyMetric',state.metric);replaceSheetContent(trackerFull('body'));}});
document.addEventListener('input',e=>{if(foodStudio.handleInput?.(e)||bodyStudio.handleInput?.(e)||workoutStudio.handleInput?.(e))return;if(e.target.id==='food-search'){const q=e.target.value.trim().toLowerCase();let count=0;$$('.food-row').forEach(row=>{row.hidden=!row.dataset.name.includes(q);if(!row.hidden)count++;});$('#search-empty').hidden=count>0;}});
function foregroundRefresh(){if(!sheet.open&&document.visibilityState==='visible')store.load();}
window.addEventListener('online',foregroundRefresh);document.addEventListener('visibilitychange',foregroundRefresh);setInterval(foregroundRefresh,300000);
readRoute();history.replaceState({sheet:false},'');render();store.load();
requestAnimationFrame(()=>requestAnimationFrame(prepareExerciseViewer));
