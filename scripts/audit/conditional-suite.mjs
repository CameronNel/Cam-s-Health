/** Final conditional repair proofs; keep every earlier source/failed run intact. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {sourceFingerprint} from './harness.mjs';

const repo=fileURLToPath(new URL('../../',import.meta.url));
const out=path.resolve(process.env.CAM_HEALTH_AUDIT_ROOT||path.join(repo,'..','cams-health-layout-audit'));
const expectedSource=process.env.AUDIT_EXPECT_SOURCE;
if(!expectedSource||process.env.AUDIT_ROOT_PROTOTYPE)throw Error('Final suite needs AUDIT_EXPECT_SOURCE and no prototype overrides.');
if(await sourceFingerprint()!==expectedSource)throw Error('Source does not match the final conditional freeze.');
const tasks=[],toastOnly=process.env.AUDIT_TOAST_EPILOGUE_ONLY==='1';
if(!toastOnly)for(const theme of ['dark','light'])tasks.push({domain:'accessibility-repaired-'+theme,theme,script:'accessibility.mjs',expectedCases:141,env:{AUDIT_ACCESSIBILITY_DOMAIN:'accessibility-repaired-'+theme,AUDIT_METRICS_ONLY:'1',AUDIT_FIELD_NATIVE:'0'}});
if(!toastOnly)for(const theme of ['dark','light'])tasks.push({domain:'goal-repaired-'+theme,theme,script:'goal-accessibility.mjs',expectedCases:128,env:{AUDIT_GOAL_DOMAIN:'goal-repaired-'+theme}});
for(const theme of ['dark','light'])for(const kind of ['normal','fallback','setup']){
 const domain=(kind==='normal'?'toast-':'toast-'+kind+'-')+(toastOnly?'epilogue-':'repaired-')+theme;
 tasks.push({domain,theme,script:'toast-accessibility.mjs',expectedCases:kind==='normal'?13:4,env:{AUDIT_TOAST_DOMAIN:domain,AUDIT_TOAST_FORCE_FALLBACK:kind==='fallback'?'1':'0',AUDIT_TOAST_SETUP_ONLY:kind==='setup'?'1':'0'}});
}
if(!toastOnly)for(const theme of ['dark','light'])tasks.push({domain:'print-repaired-'+theme,theme,script:'print-handoff.mjs',expectedCases:0,env:{AUDIT_PRINT_DOMAIN:'print-repaired-'+theme}});
for(const task of tasks)try{await fs.access(path.join(out,task.domain,'cases.json'));throw Error('Refusing to overwrite existing evidence: '+task.domain);}catch(error){if(error.code!=='ENOENT')throw error;}
await fs.mkdir(out,{recursive:true});
const status={expectedSource,startedAt:new Date().toISOString(),method:toastOnly?'One browser at a time. Exactly42 actual toast/fallback/Setup cases across two themes on the final epilogue; native dimensions asserted at capture. No prototype evidence.':'One browser at a time. Full141 accessibility geometry and68 actual fields pertheme; repeated field PNGs omitted, error/header proofs retained. Full128 Goal combinations pertheme. Actual toast13/fallback4/Setup4 and instrumented Print handoff pertheme. No prototype evidence.',declaredTasks:tasks.map(({env,...task})=>task),tasks:[]};
const save=()=>fs.writeFile(path.join(out,toastOnly?'toast-epilogue-run-status.json':'conditional-audit-final-run-status.json'),JSON.stringify(status,null,2)+'\n');
for(const task of tasks){
 const record={domain:task.domain,theme:task.theme,expectedCases:task.expectedCases,status:'running',startedAt:new Date().toISOString()};status.tasks.push(record);await save();console.log('START '+task.domain);
 const log=await fs.open(path.join(out,task.domain+'-run.log'),'w');
 const child=spawn(process.execPath,['scripts/audit/'+task.script],{cwd:repo,env:{...process.env,...task.env,AUDIT_EXPECT_SOURCE:expectedSource,AUDIT_THEME:task.theme},stdio:['ignore',log.fd,log.fd]});
 record.exitCode=await new Promise(resolve=>child.on('close',resolve));await log.close();record.finishedAt=new Date().toISOString();
 try{
  const ledger=JSON.parse(await fs.readFile(path.join(out,task.domain,'cases.json'),'utf8')),observations=JSON.parse(await fs.readFile(path.join(out,task.domain,'observations.json'),'utf8'));
  record.cases=ledger.cases.length;record.rawFailedChecks=ledger.checks.filter(check=>!check.pass).length;record.sourceStable=observations.sourceAtStart===expectedSource&&observations.sourceAtFinish===expectedSource&&!observations.prototype;record.actualThemes=[...new Set(ledger.cases.map(item=>item.theme))];
  record.valid=record.cases===task.expectedCases&&record.sourceStable&&observations.theme===task.theme&&ledger.cases.every(item=>item.sourceHash===expectedSource&&!item.sourceChangedSinceBoot&&!item.prototype&&item.theme===task.theme);
 }catch(error){record.valid=false;record.validationError=error.message;}
 record.status=record.exitCode===0&&record.valid?'passed':'failed';await save();console.log('DONE '+task.domain+' '+record.status);
}
status.finishedAt=new Date().toISOString();status.passed=status.tasks.every(task=>task.status==='passed');await save();if(!status.passed)process.exitCode=1;
