/** Trace real Print activation, including navigation that would cancel the handoff. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createAudit,act,sourceFingerprint} from './harness.mjs';
const a=await createAudit(process.env.AUDIT_PRINT_DOMAIN||'print-handoff-final');
const prototypeRoot=process.env.AUDIT_ROOT_PROTOTYPE,prototypeAssets=[];
if(prototypeRoot)for(const file of ['studio.js','glass.css']){const bytes=await fs.readFile(path.join(prototypeRoot,file));prototypeAssets.push({file,sha256:createHash('sha256').update(bytes).digest('hex')});await a.context.route('**/'+file+'*',route=>route.fulfill({body:bytes,contentType:file.endsWith('.js')?'text/javascript':'text/css'}));}
const sourceAtStart=await sourceFingerprint(),navigations=[],calls=[];let before,after,failure;
await a.page.exposeFunction('__auditPrintHandoff',()=>calls.push({at:Date.now()}));
await a.context.addInitScript(()=>{window.print=()=>window.__auditPrintHandoff();});
a.page.on('framenavigated',frame=>{if(frame===a.page.mainFrame())navigations.push({url:frame.url(),at:Date.now()});});
try{
 await a.boot();if(!(await a.themeMetadata()).themeMatchesRequest)throw Error('Requested print audit theme did not apply');await act(a.page,'brief');before={url:a.page.url(),history:await a.page.evaluate(()=>history.state)};
 await a.page.locator('#sheet [data-act=print]').click();
 // A bounded observation window also records a double-back to about:blank.
 await a.page.waitForTimeout(1000);
 after={url:a.page.url(),history:await a.page.evaluate(()=>history.state),sheet:await a.page.evaluate(()=>document.querySelector('#sheet')?.open??null)};
 await a.check('Print action invokes browser handoff once and stays in the tracker',()=>{if(calls.length!==1||!after.url.startsWith('http://127.0.0.1:5173/')||after.sheet!==false||a.writes.length)throw Error(JSON.stringify({calls:calls.length,after,mockWrites:a.writes.length}));return{calls:calls.length,staysInApp:true,nativePrintDialogVerified:false};});
}catch(error){failure=error.message;}finally{
 const result={...await a.themeMetadata(),sourceAtStart,sourceAtFinish:await sourceFingerprint(),prototype:!!prototypeRoot,prototypeRoot,prototypeAssets,before,after,calls,navigations,failure:failure||null,passed:!failure,mockWrites:a.writes.length,nativePrintDialogVerified:false,method:'Actual app Print button. window.print is instrumented in every document through an exposed browser binding so navigation cannot erase the counter. Native OS print UI is not opened. Route overrides, when enabled, are explicitly prototype evidence and excluded from final acceptance.'};await fs.writeFile(path.join(a.out,'observations.json'),JSON.stringify(result,null,2)+'\n');await a.finish();console.log(JSON.stringify(result,null,2));if(failure)process.exitCode=1;
}
