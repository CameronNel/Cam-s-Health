/* Local appearance, reading position and recoverable drafts. Never a health writer. */
export const SHELL_STORAGE_KEY='cams-health-shell-v1';
export const DRAFT_STORAGE_KEY='cams-health-drafts-v1';
const WIDGETS=['food','body','workouts'];
const NAMES={food:'Food',body:'Body comp',workouts:'Workouts'};
const PALETTES={silver:['Silver','#dfe6ed'],ice:['Ice blue','#bbdff4'],champagne:['Champagne','#e8d4ad'],opal:['Opal','#d8c6ed']};
const MAX_DRAFTS=24,MAX_FIELDS=800;
const unsafeName=/token|password|passwd|secret|credential|api.?key|authorization|cookie|oauth|bearer|private.?key|access.?key/i;
const unsafeValue=/(?:github_pat_|gh[pousr]_|sk-(?:proj-|ant-|live-|test-)?)[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+\/-]{12,}/i;
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bounded=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const safeText=(value,max=200)=>typeof value==='string'&&!unsafeValue.test(value)?value.slice(0,max):'';

export function normalizeShellPreferences(value={}) {
  if(!value||typeof value!=='object'||Array.isArray(value))value={};
  const order=[...new Set((Array.isArray(value.order)?value.order:[]).filter(k=>WIDGETS.includes(k)))];
  return {order:[...order,...WIDGETS.filter(k=>!order.includes(k))],sizes:Object.fromEntries(WIDGETS.map(k=>[k,['small','standard','large'].includes(value.sizes?.[k])?value.sizes[k]:'standard'])),density:value.density==='compact'?'compact':'detailed',palette:Object.hasOwn(PALETTES,value.palette)?value.palette:'opal',clarity:bounded(value.clarity,0,100,35),haptics:value.haptics!==false};
}

function fieldsOf(form){return Array.from(form?.elements||[]);}
function eligibleField(field){
  const type=String(field?.type||'text').toLowerCase(),name=String(field?.name||'');
  return !!name&&!unsafeName.test(name)&&!['password','file','submit','button','reset','image'].includes(type)&&!field?.dataset?.noDraft;
}
export function serializeDraftFields(form) {
  const occurrence=new Map();
  return fieldsOf(form).filter(eligibleField).slice(0,MAX_FIELDS).flatMap(field=>{
    const name=String(field.name),index=occurrence.get(name)||0;occurrence.set(name,index+1);
    const type=String(field.type||'text').toLowerCase();
    const value=type==='select-multiple'?Array.from(field.selectedOptions||[],o=>String(o.value)):String(field.value??'');
    if((Array.isArray(value)?value:[value]).some(v=>unsafeValue.test(v)))return [];
    return [{name,index,type,value:Array.isArray(value)?value.slice(0,100).map(v=>v.slice(0,5000)):value.slice(0,12000),...(['checkbox','radio'].includes(type)?{checked:!!field.checked}:{})}];
  });
}
export function restoreDraftFields(form,stored,{dispatch=true}={}) {
  if(!Array.isArray(stored))return 0;
  const groups=new Map();for(const field of fieldsOf(form).filter(eligibleField)){if(!groups.has(field.name))groups.set(field.name,[]);groups.get(field.name).push(field);}
  let restored=0;
  for(const item of stored.slice(0,MAX_FIELDS)){
    if(!item||unsafeName.test(String(item.name))||(Array.isArray(item.value)?item.value:[item.value]).some(v=>unsafeValue.test(String(v))))continue;
    const field=groups.get(item.name)?.[Number.isInteger(item.index)?item.index:0];if(!field||String(field.type||'text').toLowerCase()!==item.type)continue;
    if(['checkbox','radio'].includes(item.type))field.checked=!!item.checked;
    else if(item.type==='select-multiple'){const values=Array.isArray(item.value)?item.value.map(String):[];for(const option of Array.from(field.options||[]))option.selected=values.includes(String(option.value));}
    else field.value=String(item.value??'');
    restored++;
    if(dispatch&&field.dispatchEvent){const EventClass=field.ownerDocument?.defaultView?.Event||globalThis.Event;if(EventClass){field.dispatchEvent(new EventClass('input',{bubbles:true}));field.dispatchEvent(new EventClass('change',{bubbles:true}));}}
  }
  return restored;
}

function read(storage,key,fallback){try{const raw=storage?.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function write(storage,key,value){try{storage?.setItem(key,JSON.stringify(value));return !!storage;}catch{return false;}}
export function cleanRoute(route){
  // Reopening a recipe needs its public ingredient rows; a portion needs its
  // exact food snapshot. Keep bounded JSON, never DOM, files or credentials.
  const seen=new WeakSet();let nodes=0;
  const clean=(value,depth=0)=>{
    if(++nodes>12000||depth>12)return undefined;
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number')return Number.isFinite(value)?value:undefined;
    if(typeof value==='string')return unsafeValue.test(value)?undefined:value.slice(0,12000);
    if(!value||typeof value!=='object'||seen.has(value))return undefined;
    const prototype=Object.getPrototypeOf(value);if(!Array.isArray(value)&&prototype!==Object.prototype&&prototype!==null)return undefined;
    seen.add(value);
    const result=Array.isArray(value)?value.slice(0,1000).map(v=>clean(v,depth+1)).filter(v=>v!==undefined):Object.fromEntries(Object.entries(value).slice(0,1000).filter(([key])=>!unsafeName.test(key)&&!['__proto__','constructor','prototype'].includes(key)&&key.length<=100).flatMap(([key,v])=>{const safe=clean(v,depth+1);return safe===undefined?[]:[[key,safe]];}));
    seen.delete(value);return result;
  };
  try{if(!route||typeof route!=='object'||Array.isArray(route))return {};const result=clean(route)||{};return JSON.stringify(result).length<=120000?result:{};}catch{return {};}
}
function normalizeDrafts(raw){
  if(!Array.isArray(raw))return [];
  return raw.filter(d=>d&&typeof d.key==='string'&&!unsafeValue.test(d.key)&&Array.isArray(d.fields)).slice(0,MAX_DRAFTS).map(d=>({...d,key:safeText(d.key,400),title:safeText(d.title)||'Unfinished entry',date:/^\d{4}-\d{2}-\d{2}$/.test(d.date)?d.date:'',route:cleanRoute(d.route),fields:d.fields.filter(f=>f&&typeof f.name==='string'&&!unsafeName.test(f.name)&&!unsafeValue.test(String(f.value))).slice(0,MAX_FIELDS),updatedAt:Number(d.updatedAt)||0}));
}

export function createTrackerShell(ctx={}) {
  let storage;try{storage=ctx.storage??globalThis.localStorage;}catch{}
  const esc=ctx.esc||escapeHTML,view=ctx.window||globalThis.window,doc=ctx.document||view?.document||globalThis.document;
  let prefs=normalizeShellPreferences(read(storage,SHELL_STORAGE_KEY,{}));
  let drafts=normalizeDrafts(read(storage,DRAFT_STORAGE_KEY,[]));
  let memories=read(storage,'cams-health-reading-position-v1',{});if(!memories||typeof memories!=='object'||Array.isArray(memories))memories={};
  const activeDrafts=new Map(),registeredRoutes=new Map(),sheetRestores=new WeakMap();let rootNode=null,disposed=false;
  const flash=message=>ctx.toast?.(message);
  const getDate=()=>typeof ctx.date==='function'?ctx.date():ctx.date||'';
  function remember(key,value){
    key=safeText(String(key),300);if(!key||unsafeName.test(key))return;
    try{const json=JSON.stringify(value);if(json.length>6000||unsafeValue.test(json)||unsafeName.test(json))return;memories[key]=JSON.parse(json);const entries=Object.entries(memories);if(entries.length>80)memories=Object.fromEntries(entries.slice(-80));write(storage,'cams-health-reading-position-v1',memories);}catch{}
  }
  const recall=(key,fallback=null)=>Object.hasOwn(memories,key)?memories[key]:fallback;
  function persistPrefs(){write(storage,SHELL_STORAGE_KEY,prefs);apply(rootNode);ctx.onPreferences?.(structuredClone(prefs));}
  function apply(root=rootNode){
    if(root)rootNode=root;
    const documentRoot=doc?.documentElement;if(documentRoot){documentRoot.dataset.trackerPalette=prefs.palette;documentRoot.dataset.trackerDensity=prefs.density;documentRoot.style.setProperty('--tracker-glass-opacity',String(.025+prefs.clarity*.00155));documentRoot.style.setProperty('--tracker-glass-blur',`${18+prefs.clarity*.2}px`);documentRoot.style.setProperty('--tracker-glass-contrast',String(1+prefs.clarity*.006));}
    const grid=root?.querySelector?.('.widget-grid');if(!grid)return;
    for(const kind of prefs.order){const widget=grid.querySelector(`.${kind==='workouts'?'workout':kind}-widget`);if(widget){widget.dataset.widgetSize=prefs.sizes[kind];widget.dataset.widgetKind=kind;grid.append(widget);}}
  }
  function preferencesView(){
    return `<div class="tracker-appearance"><div class="tracker-section-intro"><span class="eyebrow">MAKE IT YOURS</span><h3>Your everyday view.</h3><p>Keep the same three trackers. Tune how they feel.</p></div><section class="tracker-preference-group"><h4>Accent</h4><div class="tracker-palettes" role="group" aria-label="Accent palette">${Object.entries(PALETTES).map(([k,[name,color]])=>`<button type="button" data-shell-palette="${k}" aria-pressed="${prefs.palette===k}"><i style="--swatch:${color}" aria-hidden="true"></i><span>${name}</span></button>`).join('')}</div></section><section class="tracker-preference-group"><div class="tracker-preference-heading"><h4>Home detail</h4><span>Popups always keep the full picture.</span></div><div class="tracker-choice" role="group" aria-label="Home detail">${[['compact','Compact','Essential readings'],['detailed','Detailed','Readings and context']].map(([k,l,d])=>`<button type="button" data-shell-density="${k}" aria-pressed="${prefs.density===k}"><b>${l}</b><small>${d}</small></button>`).join('')}</div></section><section class="tracker-preference-group"><div class="tracker-preference-heading"><h4>Glass clarity</h4><output data-shell-clarity-output>${Math.round(prefs.clarity)}%</output></div><p class="tracker-setting-help">A clearer surface at the left. Stronger contrast at the right.</p><input class="tracker-clarity" type="range" min="0" max="100" step="1" value="${prefs.clarity}" data-shell-clarity aria-label="Glass contrast"><div class="tracker-range-labels"><span>Clear</span><span>High contrast</span></div></section><section class="tracker-preference-group"><div class="tracker-preference-heading"><h4>Widget arrangement</h4><span>Choose size and order.</span></div><div class="tracker-widget-arrangement">${prefs.order.map((kind,index)=>`<div class="tracker-widget-preference"><div class="tracker-widget-preference-top"><b>${NAMES[kind]}</b><div class="tracker-reorder"><button type="button" data-shell-move="${kind}" data-direction="-1" aria-label="Move ${NAMES[kind]} up" ${index===0?'disabled':''}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 20V4m-6 6 6-6 6 6"/></svg></button><button type="button" data-shell-move="${kind}" data-direction="1" aria-label="Move ${NAMES[kind]} down" ${index===prefs.order.length-1?'disabled':''}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 4v16m-6-6 6 6 6-6"/></svg></button></div></div><div class="tracker-size-choice" role="group" aria-label="${NAMES[kind]} widget size">${[['small','Small'],['standard','Standard'],['large','Large']].map(([k,label])=>`<button type="button" data-shell-size="${kind}" data-size="${k}" aria-pressed="${prefs.sizes[kind]===k}">${label}</button>`).join('')}</div></div>`).join('')}</div></section><section class="tracker-preference-group tracker-haptic-row"><div><h4>Gentle haptics</h4><p class="tracker-setting-help">One light pulse when a long press opens a preview, where supported.</p></div><button type="button" class="tracker-toggle" data-shell-haptics role="switch" aria-label="Gentle haptics" aria-checked="${prefs.haptics}"><span></span></button></section><p class="tracker-local-note">Appearance stays on this device. Your health records are unchanged.</p><button type="button" class="btn secondary full" data-shell-reset>Reset appearance</button></div>`;
  }
  function openPreferences(){ctx.openSheet?.('Look & feel',preferencesView(),()=>bindPreferences(ctx.sheet||doc?.querySelector('#sheet')));}
  function bindPreferences(container){
    const pane=container?.querySelector('.tracker-appearance');if(!pane)return;
    const redraw=source=>{const parent=pane.parentElement,scroll=container.scrollTop,attributes=source?Array.from(source.attributes).filter(a=>a.name.startsWith('data-')):[];parent.innerHTML=preferencesView();bindPreferences(container);container.scrollTop=scroll;const next=Array.from(parent.querySelectorAll('button')).find(button=>attributes.length&&attributes.every(a=>button.getAttribute(a.name)===a.value));if(next&&!next.disabled)next.focus({preventScroll:true});};
    pane.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button||!pane.contains(button))return;
      if(button.dataset.shellPalette)prefs.palette=button.dataset.shellPalette;
      else if(button.dataset.shellDensity)prefs.density=button.dataset.shellDensity;
      else if(button.dataset.shellSize)prefs.sizes[button.dataset.shellSize]=button.dataset.size;
      else if(button.dataset.shellMove){const from=prefs.order.indexOf(button.dataset.shellMove),to=from+Number(button.dataset.direction);if(to>=0&&to<3)[prefs.order[from],prefs.order[to]]=[prefs.order[to],prefs.order[from]];}
      else if(button.hasAttribute('data-shell-haptics'))prefs.haptics=!prefs.haptics;
      else if(button.hasAttribute('data-shell-reset'))prefs=normalizeShellPreferences();else return;
      prefs=normalizeShellPreferences(prefs);persistPrefs();redraw(button);
    });
    pane.querySelector('[data-shell-clarity]')?.addEventListener('input',event=>{prefs.clarity=Number(event.target.value);const output=pane.querySelector('[data-shell-clarity-output]');if(output)output.textContent=`${prefs.clarity}%`;persistPrefs();});
  }
  function enhanceHolds(container){
    const cleanups=[];
    for(const element of Array.from(container?.querySelectorAll?.('[data-peek],[data-workout],[data-exercise-session],[data-record]')||[])){
      let origin=null,timer=0;const schedule=view?.setTimeout?.bind(view)||setTimeout,unschedule=view?.clearTimeout?.bind(view)||clearTimeout;
      const clear=()=>{if(timer)unschedule(timer);timer=0;origin=null;element.classList.remove('tracker-holding');};
      const down=event=>{clear();if(event.button!==0||event.isPrimary===false)return;origin={x:event.clientX,y:event.clientY};element.classList.add('tracker-hold-target','tracker-holding');timer=schedule(()=>{timer=0;origin=null;element.classList.remove('tracker-holding');},450);};
      const move=event=>{if(origin&&Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>10)clear();};
      const events={pointerdown:down,pointermove:move,pointerup:clear,pointercancel:clear,pointerleave:clear};for(const [type,fn]of Object.entries(events))element.addEventListener(type,fn,{passive:true});
      cleanups.push(()=>{clear();for(const [type,fn]of Object.entries(events))element.removeEventListener(type,fn);element.classList.remove('tracker-hold-target');});
    }
    return ()=>cleanups.forEach(fn=>fn());
  }
  function pulseHold(){if(prefs.haptics&&!doc?.hidden)try{view?.navigator?.vibrate?.(8);}catch{}}
  function captureSheet(sheet,key){
    if(!sheet||!key||sheet.querySelector('form'))return;
    const sequence=sheet.querySelector('.demo-sequence'),selected=sequence?.querySelector('[aria-pressed=true]');
    remember(`sheet:${key}`,{scroll:Math.max(0,sheet.scrollTop||0),contentScroll:sheet.querySelector('.sheet-content')?.scrollTop||0,sequenceScroll:sequence?.scrollLeft||0,exerciseIndex:selected?Number(selected.dataset.index):null,metric:sheet.querySelector('#metric-select')?.value||null,range:sheet.querySelector('[data-range][aria-pressed=true]')?.dataset.range||null});
  }
  function restoreSheet(sheet,key){
    const saved=recall(`sheet:${key}`);if(!saved||!sheet||sheet.querySelector('form'))return null;
    const restoreId={};sheetRestores.set(sheet,restoreId);
    const restore=()=>{if(!sheet.isConnected||sheetRestores.get(sheet)!==restoreId)return;sheet.scrollTop=Number(saved.scroll)||0;const content=sheet.querySelector('.sheet-content');if(content)content.scrollTop=Number(saved.contentScroll)||0;const sequence=sheet.querySelector('.demo-sequence');if(sequence)sequence.scrollLeft=Number(saved.sequenceScroll)||0;};
    restore();view?.requestAnimationFrame?.(restore);return saved;
  }
  function persistDrafts(){drafts=drafts.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,MAX_DRAFTS);return write(storage,DRAFT_STORAGE_KEY,drafts);}
  function clearDraft(key){
    drafts=drafts.filter(d=>d.key!==key);for(const tracker of activeDrafts.values())if(tracker.key===key)tracker.markSaved();persistDrafts();
  }
  function getDrafts(){return structuredClone(drafts).sort((a,b)=>b.updatedAt-a.updatedAt);}
  async function hydrateDraft(form,key){
    const draft=drafts.find(d=>d.key===key);if(!draft)return 0;
    await ctx.prepareDraft?.(form,structuredClone(draft));
    // Older session forms use repeated names. Recreate their row count before
    // restoring by occurrence, so set and exercise values keep their ordering.
    const exerciseCount=draft.fields.filter(f=>f.name==='exerciseName').length;
    const add=form.querySelector?.('[data-act="add-exercise"]');let guard=0;
    while(add&&form.querySelectorAll('[name="exerciseName"]').length<exerciseCount&&guard++<100)add.click();
    const count=restoreDraftFields(form,draft.fields);form.querySelectorAll?.('.measurement-fields').forEach(details=>{if(details.querySelector('input')?.value)details.open=true;});
    return count;
  }
  function trackDraft(form,options={}){
    if(!form||form.id==='connect-form'||!serializeDraftFields(form).length)return ()=>{};
    const key=safeText(options.key||`${form.id||options.title||'entry'}:${options.date||getDate()}`,400);if(!key||unsafeValue.test(key))return ()=>{};
    const title=safeText(options.title)||'Unfinished entry',date=options.date||getDate(),initialRoute=cleanRoute(options.route);
    if(options.open)registeredRoutes.set(key,options.open);
    const initial=JSON.stringify(serializeDraftFields(form));let baseline=initial,changed=false,restoring=false,finished=false,timer=0;
    const flush=()=>{
      if(disposed||finished||restoring||!changed)return;
      const fields=serializeDraftFields(form);if(JSON.stringify(fields)===baseline){drafts=drafts.filter(d=>d.key!==key);persistDrafts();return;}
      let route=initialRoute;try{const latest=options.getRoute?.();if(latest&&typeof latest==='object')route=cleanRoute(latest);}catch{}
      const draft={key,title,date,route,fields,updatedAt:Date.now()};drafts=[draft,...drafts.filter(d=>d.key!==key)];persistDrafts();
    };
    const update=event=>{if(restoring||event?.target&&!eligibleField(event.target))return;changed=true;if(timer)clearTimeout(timer);timer=setTimeout(flush,180);};
    const draft=drafts.find(d=>d.key===key);let banner=null;
    if(draft&&form.ownerDocument){
      banner=form.ownerDocument.createElement('div');banner.className='tracker-draft-recovery';banner.setAttribute('role','status');banner.innerHTML=`<div><b>Pick up where you left off</b><p>An unfinished entry for ${esc(draft.date||'this form')} is saved on this device.</p></div><div><button type="button" data-restore-draft>Restore draft</button><button type="button" data-discard-draft>Remove</button></div>`;form.prepend(banner);
      banner.querySelector('[data-restore-draft]').addEventListener('click',async()=>{restoring=true;try{const count=await hydrateDraft(form,key);changed=true;banner.remove();flash(count?'Draft restored. Review it before saving.':'This draft no longer matches the form.');}finally{restoring=false;flush();}});
      banner.querySelector('[data-discard-draft]').addEventListener('click',()=>{clearDraft(key);banner.remove();flash('Local draft removed.');});
    }
    form.dataset.draftKey=key;
    form.addEventListener('input',update);form.addEventListener('change',update);
    const tracker={key,flush,markSaved:()=>{baseline=JSON.stringify(serializeDraftFields(form));changed=false;banner?.remove();}};activeDrafts.set(form,tracker);
    return ()=>{if(finished)return;if(timer)clearTimeout(timer);flush();finished=true;form.removeEventListener('input',update);form.removeEventListener('change',update);activeDrafts.delete(form);};
  }
  function attachForms(container,options={}){
    const forms=Array.from(container?.querySelectorAll?.('form')||[]),cleanups=forms.map((form,index)=>trackDraft(form,{...options,key:forms.length>1?`${options.key||options.title}:${index}`:options.key}));return ()=>cleanups.forEach(fn=>fn());
  }
  function draftsView(){
    let extra='';try{extra=typeof ctx.extraDrafts==='function'?String(ctx.extraDrafts()||''):'';}catch{}
    return `<div class="tracker-drafts"><div class="tracker-section-intro"><span class="eyebrow">READY WHEN YOU ARE</span><h3>Unfinished entries.</h3><p>Saved only in this browser. Open an entry, restore it and review before saving to GitHub.</p></div>${extra}${drafts.length?`<div class="tracker-draft-list">${getDrafts().map(d=>`<div class="tracker-draft-row"><button type="button" data-shell-open-draft="${esc(d.key)}"><b>${esc(d.title)}</b><small>${esc(d.date)} · ${new Date(d.updatedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</small></button><button type="button" class="iconbtn" data-shell-remove-draft="${esc(d.key)}" aria-label="Remove ${esc(d.title)} draft">×</button></div>`).join('')}</div>`:extra?'':'<div class="tracker-no-drafts"><span aria-hidden="true">✓</span><b>All caught up.</b><p>Unfinished food, body and workout entries will wait here.</p></div>'}<p class="tracker-local-note">Drafts are removed after a verified save. Clearing this browser’s storage also clears its drafts.</p></div>`;
  }
  function openDrafts(){ctx.openSheet?.('Your drafts',draftsView(),()=>{
    const container=(ctx.sheet||doc?.querySelector('#sheet'))?.querySelector('.tracker-drafts');container?.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.shellRemoveDraft){clearDraft(button.dataset.shellRemoveDraft);openDrafts();}else if(button.dataset.shellOpenDraft){const draft=drafts.find(d=>d.key===button.dataset.shellOpenDraft);if(draft){const opener=registeredRoutes.get(draft.key);if(opener)opener();else if(ctx.openDraftRoute)ctx.openDraftRoute(structuredClone(draft));else flash('Open the matching entry form to restore this draft.');}}});
  });}
  const flushDrafts=()=>{for(const tracker of activeDrafts.values())tracker.flush();};
  view?.addEventListener?.('pagehide',flushDrafts);view?.addEventListener?.('beforeunload',flushDrafts);
  return {apply,preferencesView,openPreferences,bindPreferences,enhanceHolds,pulseHold,captureSheet,restoreSheet,trackDraft,attachForms,clearDraft,hydrateDraft,draftsView,openDrafts,getDrafts,remember,recall,flushDrafts,getPreferences:()=>structuredClone(prefs),setPreferences:value=>{prefs=normalizeShellPreferences({...prefs,...value});persistPrefs();},dispose(){flushDrafts();disposed=true;view?.removeEventListener?.('pagehide',flushDrafts);view?.removeEventListener?.('beforeunload',flushDrafts);}};
}
