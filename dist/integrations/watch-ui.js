import {prepareWatchImport,WATCH_IMPORT_MAX_BYTES} from './watch-import.js';

/** Read-only device export, followed by an explicit, verified health-record save. */
export function createWatchUI({store,openSheet,wireForm,setSheetBusy,saveFooter,button,icon,esc}){
  const format=value=>value==null?'Not logged':Number(value).toLocaleString('en-GB',{maximumFractionDigits:2});
  const setupLink='<a class="btn secondary full" href="/integrations/cams-life-watch.apk" download>Download Android companion</a>';
  function settings(){return `<section class="life-card watch-card"><span class="item-icon">${icon('history')}</span><h2>Watch & Samsung Health</h2><p>Bring your watch readings into Cam’s Life through Health Connect.</p><p class="help">Review steps, water, weight, body fat, sleep and workouts before saving. No paid service is needed.</p>${button('Set up watch transfer','watch-setup','right','btn full')}<p class="help">The companion needs installation and read permissions on your phone.</p></section>`;}
  function setup(){openSheet('Watch & Samsung Health',`<section class="watch-setup"><h3>Your watch, your readings.</h3><p class="help">Your Galaxy Watch first syncs with Samsung Health on your phone. The free Android companion reads Health Connect and exports a file for you to review here.</p><ol><li><b>Share with Health Connect</b><p>In Samsung Health settings, open Health Connect and allow the readings you want to share. Sync your watch with Samsung Health.</p></li><li><b>Install the companion</b><p>For Android 14 or later. Android may ask you to allow installation from your browser. The companion has no internet access or health write permission.</p>${setupLink}</li><li><b>Export your readings</b><p>Open Cam’s Life · Watch, grant read access and export 7 or 30 days. Choose <strong>${esc(store.data.profile.timezone)}</strong> as the timezone, then save the JSON on your phone.</p></li><li><b>Review in Cam’s Life</b><p>Choose the export below. Different existing readings stay unselected until you explicitly accept a replacement.</p></li></ol>${button('Choose watch export','watch-file','download','btn full')}<details class="disclosure"><summary>Supported readings and privacy ${icon('plus')}</summary><p class="help">Steps and water are daily totals. Weight and body fat use the latest reading on each date. Sleep requires recorded asleep stages. Workouts retain their source IDs and actual duration.</p><p class="help">Skeletal muscle, Samsung energy and sleep scores, heart rate and blood oxygen are not included in this transfer. They are never invented. Body-fat method is recorded as Not specified.</p><p class="help">Transfers are reviewed files. Automatic background sync is not enabled. The companion has no account or database. Accepted readings are saved to your existing public GitHub health record; your private inbox stays separate.</p></details></section>`);}
  function choose(){openSheet('Choose watch export',`<form class="watch-picker" novalidate><p class="help">Choose the JSON exported by Cam’s Life · Watch. The file stays in this tab until you review it. Maximum 2 MB and 31 dates.</p><div class="field"><label for="watch-file">Health Connect export</label><label for="watch-file" class="watch-file-button btn secondary full">Choose JSON file</label><input id="watch-file" class="sr-only" aria-describedby="watch-file-error watch-filename" type="file" accept="application/json,.json" required></div><p id="watch-filename" class="help preserve"></p><p id="watch-file-error" class="form-error" role="alert"></p><div class="form-actions">${button('Cancel','close-sheet','','btn secondary')}<button type="submit" class="btn"><span>Review readings</span></button></div></form>`,()=>{
    const form=document.querySelector('#sheet .watch-picker'),input=form.querySelector('#watch-file'),error=form.querySelector('#watch-file-error');
    input.addEventListener('change',()=>{form.querySelector('#watch-filename').textContent=input.files[0]?.name||'';error.textContent='';});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(form.getAttribute('aria-busy')==='true')return;const file=input.files[0];
      if(!file){error.textContent='Choose your Health Connect JSON export first.';error.tabIndex=-1;error.focus();return;}error.textContent='';
      setSheetBusy(form,true,'Reading your export…');
      try{
        if(file.size>WATCH_IMPORT_MAX_BYTES)throw Error('This file exceeds 2 MB. Export a shorter date range.');
        const baseline=structuredClone(store.data),proposal=prepareWatchImport(baseline,await file.text());
        review(proposal,baseline,file.name);
      }catch(e){error.textContent=e.message;error.tabIndex=-1;error.focus();}
      finally{setSheetBusy(form,false);}
    });
  });}
  function review(proposal,baseline,filename){
    const selected=new Set(proposal.selectedKeys),hasFat=proposal.changes.some(c=>c.kind==='bodyFatPct');
    const groups=Map.groupBy(proposal.changes,c=>c.date);
    const rows=[...groups].map(([date,changes])=>`<section class="watch-day"><h3>${esc(date)}</h3>${changes.map(c=>{
      const incoming=c.kind==='workout'?format(c.value.durationMin)+' min':format(c.value)+' '+c.unit;
      const previous=c.kind==='workout'?(c.before?format(c.before.durationMin)+' min':'Other session already logged on this date'):format(c.before)+' '+(c.before==null?'':c.unit);
      return `<label class="watch-reading ${c.status}"><input type="checkbox" name="watchReading" value="${esc(c.key)}" ${selected.has(c.key)?'checked':''} ${c.status==='same'?'disabled':''}><span><b>${esc(c.label)}</b><strong>${esc(incoming)}</strong><small>${c.status==='same'?'Already saved · no change':c.status==='conflict'?'Replacement needs your review · '+esc(previous):'New reading'}</small>${c.kind==='bodyFatPct'?'<small>Method: Not specified</small>':''}<small class="watch-source">${esc(c.source.appPackages.map(p=>p==='com.sec.android.app.shealth'?'Samsung Health':'Health Connect source').join(', '))}</small></span></label>`;
    }).join('')}</section>`).join('');
    openSheet('Review watch readings',`<form class="watch-review"><p class="help preserve">${esc(filename)}</p><p class="help">${proposal.changes.length} ${proposal.changes.length===1?'reading':'readings'} across ${groups.size} ${groups.size===1?'date':'dates'}. Only new readings are selected by default. Select a replacement only after checking it; a workout can duplicate a manual session.</p>${hasFat?'<div class="notice compact-notice"><p>Health Connect does not supply the body-fat measurement method. Accepting body fat sets that date’s method to Not specified.</p></div>':''}<div class="watch-days">${rows||'<p class="help">No supported readings in this export. Your records are unchanged.</p>'}</div><p id="watch-selection" class="help" role="status"></p><div class="notice compact-notice"><p>Accepted readings become part of your public GitHub health record. Unselected readings and unrelated records stay intact.</p></div>${saveFooter('Save selected readings')}</form>`,()=>{
      const form=document.querySelector('#sheet .watch-review'),summary=form.querySelector('#watch-selection'),error=form.querySelector('#form-error'),selectionError='Select at least one new or replacement reading. Your records are unchanged.';
      const update=()=>{const count=form.querySelectorAll('[name=watchReading]:checked').length;summary.textContent=count+' '+(count===1?'reading':'readings')+' selected';if(count&&error.textContent===selectionError)error.textContent='';};update();
      form.addEventListener('change',update);
      form.addEventListener('submit',event=>{if(!form.querySelector('[name=watchReading]:checked')){event.preventDefault();event.stopImmediatePropagation();error.textContent=selectionError;error.scrollIntoView({block:'nearest'});}},true);
      wireForm(async fd=>{
        const reviewed=prepareWatchImport(baseline,proposal.bundle,{selectedKeys:fd.getAll('watchReading')});
        if(!reviewed.accepted.length)throw Error('Select at least one reading.');
        await store.save(reviewed.apply,'Import reviewed Health Connect readings');
      });
    });
  }
  function action(act){if(act==='watch-setup'){setup();return true;}if(act==='watch-file'){choose();return true;}return false;}
  return {settings,action};
}
