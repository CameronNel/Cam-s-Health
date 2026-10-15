/** Actual intercepted Setup save, immediate form reopen, then validation feedback. */
import {act,closeSheet} from './harness.mjs';
import {nativeTransaction} from './native-transaction.mjs';

export async function runSetupToastTransition({a,page=a.page,captureSession=null,configure=async()=>{},modalMode='popup'}) {
 const openSetup=async()=>{await act(page,'workouts-tools');await page.locator('[data-ws=config]').press('Enter');await page.locator('#ws-config-form').waitFor();};
 await closeSheet(page,{discard:true});await openSetup();
 const equipment=page.locator('[name=equipment][value=manual]');
 const equipmentWasChecked=await equipment.isChecked();await equipment.focus();await equipment.press('Space');if(await equipment.isChecked()===equipmentWasChecked)throw Error('Actual keyboard Space did not toggle the synthetic Setup equipment choice.');
 const token=page.locator('[name=githubToken]');
 if(await token.count()) {
  const connect=page.locator('.inline-connect');
  if(await connect.count()&&!await connect.evaluate(el=>el.open))await connect.locator('summary').press('Enter');
  await token.fill('synthetic-setup-toast-audit-only');
 }
 const writesBefore=a.writes.length,cdp=captureSession||await a.context.newCDPSession(page);
 try {
  const observed=await nativeTransaction(cdp,async()=>{
   await page.locator('#ws-config-form button[type=submit]').press('Enter');
   await page.waitForFunction(()=>!document.querySelector('#sheet').open&&!history.state?.sheet);
   if(a.writes.length!==writesBefore+1)throw Error('Setup did not make exactly one intercepted successful save.');
   await page.waitForFunction(()=>{const toast=document.querySelector('#toast');return toast?.classList.contains('show')&&/Saved and verified/i.test(toast.textContent)&&Number(getComputedStyle(toast).opacity)>.95;});
   await openSetup();
   if(await page.locator('#sheet').getAttribute('data-mode')!==modalMode)await page.locator('[data-act=expand-sheet]').click();
   await configure();
   const choices=page.locator('[name=group-exercise]');
   if(await choices.count()<2)throw Error('Setup toast fixture needs a session with at least two movements.');
   for(const choice of await choices.all())await choice.uncheck();
   await choices.first().check();
   await page.locator('#ws-config-form button[type=submit]').focus();
   await page.locator('#ws-config-form button[type=submit]').press('Enter');
   await page.locator('#form-error').filter({hasText:/choose at least two/i}).waitFor();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   if(!captureSession){const metrics=await page.evaluate(()=>({width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio,mobile:true,screenWidth:screen.width,screenHeight:screen.height}));await cdp.send('Emulation.setDeviceMetricsOverride',metrics);}
   const value=await page.evaluate(()=>{
    const sheet=document.querySelector('#sheet'),toast=document.querySelector('#toast'),rect=el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};},t=rect(toast),dialog=rect(sheet),active=document.activeElement;
    const actions=[...sheet.querySelectorAll('.form-actions button,.detail-actions button,.ws-actions button')].filter(el=>{const r=el.getBoundingClientRect();return!el.hidden&&getComputedStyle(el).display!=='none'&&r.width>0&&r.height>0&&r.bottom>Math.max(0,dialog.top)&&r.top<Math.min(innerHeight,dialog.bottom);}).map(el=>({label:el.textContent.trim(),rect:rect(el)}));
    const style=getComputedStyle(toast),toastVisible=toast.classList.contains('show')&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>.05&&t.width>0&&t.height>0;
    const overlapped=toastVisible?actions.filter(a=>t.left<a.rect.right&&t.right>a.rect.left&&t.top<a.rect.bottom&&t.bottom>a.rect.top):[],header=sheet.querySelector('.sheet-head').getBoundingClientRect();
    let popoverOpen=false;try{popoverOpen=toast.matches(':popover-open');}catch{}
    return{text:toast.textContent,toastVisible,oldContextFeedback:toastVisible?'repositioned':'dismissed',savedFeedbackObservedBeforeReopen:true,rect:t,dialog,actions,overlappedModalActions:overlapped,clearModalActions:overlapped.length===0,belowModalHeader:!toastVisible||t.top>=header.bottom-1,insideViewport:!toastVisible||t.left>=-1&&t.right<=innerWidth+1&&t.top>=-1&&t.bottom<=innerHeight+1,modalOpen:sheet.open,insideModal:sheet.contains(toast),popoverOpen,role:toast.getAttribute('role'),live:toast.getAttribute('aria-live'),focusRemainsInModal:sheet.contains(active)&&active!==toast&&!active.closest('#toast'),active:{id:active.id,name:active.name||null,label:active.getAttribute('aria-label')||active.textContent.trim().slice(0,120)},validation:sheet.querySelector('#form-error').textContent};
   });
   return{...value,mockedWrites:a.writes.length-writesBefore};
  });
  observed.value.nativeCaptureTransaction={actionToCaptureMs:observed.actionToCaptureMs,stillShownAfterCapture:await page.locator('#toast').evaluate(el=>el.classList.contains('show'))};
  return observed;
 } finally {if(!captureSession)await cdp.detach();}
}

/** Record the returned native PNG before calling this, so failures stay inspectable. */
export function assertSetupToastTransition(value) {
 const feedbackSafe=value.oldContextFeedback==='dismissed'||value.toastVisible&&(value.popoverOpen||value.insideModal)&&value.role==='status'&&value.live==='polite'&&value.nativeCaptureTransaction.stillShownAfterCapture;
 const pass=value.mockedWrites===1&&value.savedFeedbackObservedBeforeReopen&&value.clearModalActions&&value.belowModalHeader&&value.insideViewport&&value.modalOpen&&value.focusRemainsInModal&&feedbackSafe;
 if(!pass)throw Error('Setup save/reopen feedback overlaps controls or breaks modal/focus semantics: '+JSON.stringify(value));
 return{mockedWrites:1,clearModalActions:true,focusRemainsInModal:true,oldContextFeedback:value.oldContextFeedback,savedFeedbackObservedBeforeReopen:true};
}
