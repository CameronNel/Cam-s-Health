import {acquireAuditBrowser} from './browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createFixture,gotoView,captureScroll,expandDetails,settle,simulateKeyboard,EVIDENCE} from './fixture.mjs';
import {ALL_CASES,ADDITIONAL_CHECKS} from './inventory.mjs';
import {framedFixture,phoneGeometry} from './phone-frame.mjs';

const args=Object.fromEntries(process.argv.slice(2).map(s=>s.split('='))), width=Number(args.width||424),scale=Number(args.scale||100),geometry=phoneGeometry(width),phoneFrame=!args.height&&args.frame!=='content',height=Number(args.height||(phoneFrame?geometry.height:geometry.appHeight)),group=args.group||'',only=args.only?.split(','),directory=args.output||path.join(EVIDENCE,'baseline');
await mkdir(directory,{recursive:true});
await writeFile(path.join(EVIDENCE,'inventory.json'),JSON.stringify({cases:ALL_CASES,additionalChecks:ADDITIONAL_CHECKS,widths:[424,390,360],textScales:[100,130,200],keyboardHeight:500},null,2)+'\n');
const results=[];
const browserLease=await acquireAuditBrowser(),auditBrowser=browserLease.browser;
try{for(const item of ALL_CASES.filter(c=>(!group||c.group===group)&&(!only||only.includes(c.id)))){
 const fixture=await (phoneFrame?framedFixture:createFixture)({auditBrowser,width,height,textScale:scale,...item.variant});
 try{
  if(item.recovery){if(phoneFrame)await fixture.goto('dashboard',{recovery:true});else await fixture.page.goto(fixture.origin+'/update.html');await fixture.page.locator('#check').click();await settle(fixture.page,100);}
  else{await (phoneFrame?fixture.goto.bind(fixture):view=>gotoView(fixture,view,{wait:!item.boot,...(item.date?{date:item.date}:{})}))(item.view,{wait:!item.boot,...(item.date?{date:item.date}:{})});if(item.waitAfter)await fixture.page.waitForTimeout(item.waitAfter);}
  if(item.afterOffline){await fixture.page.evaluate(()=>window.__auditSetOffline(true));await settle(fixture.page);}
  for(const[op,selector,value]of item.steps||[]){const locator=fixture.page.locator(selector).first();if(op==='click')await locator.click();else if(op==='file')await locator.setInputFiles(value);else if(op==='fill')await locator.fill(value);else if(op==='select')await locator.selectOption(value);else if(op==='details')await expandDetails(fixture.page,selector);else if(op==='submit')await locator.evaluate(f=>f.requestSubmit());await settle(fixture.page,400);}
  if(height===500)await simulateKeyboard(fixture);
  const label=`${item.id}-${width}-${scale}-${height}`,result=await captureScroll(fixture,label,{directory});result.phoneGeometry=phoneFrame?geometry:null;result.render=phoneFrame?'Local synthetic app inside simulated external phone system bars':'App-content viewport; not a full phone render';await writeFile(path.join(directory,label+'.json'),JSON.stringify(result,null,2)+'\n');results.push({id:item.id,ok:true,files:result.files.length,pageErrors:fixture.errors,blocked:fixture.blocked});console.log(JSON.stringify(results.at(-1)));
 }catch(e){results.push({id:item.id,ok:false,error:e.message});console.error(JSON.stringify(results.at(-1)));await fixture.page.screenshot({path:path.join(directory,`${item.id}-FAILED.png`)}).catch(()=>{});}
 finally{await fixture.close();}
}
}finally{await browserLease.release();}
await writeFile(path.join(directory,`run-${group||'all'}-${width}-${scale}-${height}.json`),JSON.stringify(results,null,2)+'\n');
if(results.some(r=>!r.ok||r.pageErrors?.length||r.blocked?.length))process.exitCode=1;
