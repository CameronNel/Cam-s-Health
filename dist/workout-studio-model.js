import {findExerciseDemo,exerciseDemos} from './exercise-catalogue.js';
import {shiftDate} from './model.js';

export const EQUIPMENT=Object.freeze([['dumbbells','Dumbbells'],['cable','Cable station'],['bench','Flat bench'],['incline-bench','Incline bench'],['platform','Stable step / platform'],['pullup-bar','Pull-up bar'],['parallel-bars','Parallel bars'],['pushup-handles','Push-up handles'],['manual','Manual resistance'],['sliders','Sliders']]);
export const exerciseKey=name=>findExerciseDemo(name)?.id||String(name||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const workoutConfig=data=>data.tracker?.workouts||{};
export function equipmentFor(demo){
  const text=String(Array.isArray(demo?.equipment)?demo.equipment.join(' '):demo?.equipment||'').toLowerCase(),out=[];
  if(/dumbbell/.test(text))out.push('dumbbells');if(/pulley|pulleys|cable/.test(text))out.push('cable');
  if(/incline bench/.test(text))out.push('incline-bench');else if(/bench/.test(text))out.push('bench');
  if(/platform|step\b/.test(text))out.push('platform');if(/overhead.*bar|pull-up bar/.test(text))out.push('pullup-bar');
  if(/parallel bars/.test(text))out.push('parallel-bars');if(/push-up blocks|push-up handles/.test(text))out.push('pushup-handles');
  if(/manual/.test(text))out.push('manual');if(/slider|sliding/.test(text))out.push('sliders');
  return out;
}
export function substitutionOptions(name,equipment=[]){const source=findExerciseDemo(name);if(!source)return[];return exerciseDemos.filter(d=>d.id!==source.id&&d.muscles.some(m=>source.muscles.includes(m))&&(!equipment.length||equipmentFor(d).every(e=>equipment.includes(e))));}
export function createSessionDraft(data,sessionId,date,id=()=>crypto.randomUUID(),now=new Date()){
  const session=data.training.sessions.find(s=>s.id===sessionId);if(!session||!session.exercises.length)throw Error('Choose a session with exercises.');
  const config=workoutConfig(data);return {version:1,id:id(),date,sessionId:session.id,name:session.name,startedAt:now.toISOString(),index:0,notes:'',exercises:session.exercises.map(e=>({...structuredClone(e),originalName:e.name,name:config.substitutions?.[session.id]?.[e.name]||e.name,setLog:[]}))};
}
const isNumber=n=>Number.isFinite(n);
export function completedSet(values,{id=()=>crypto.randomUUID(),now=new Date(),timed=false,imperial=false}={}){
  const read=(value,name,max,min=0,integer=false)=>{if(value==null||String(value).trim()==='')return null;const n=Number(value);if(!isNumber(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw Error(`${name} must be ${integer?'a whole number ':''}between ${min} and ${max}.`);return n;};
  const reps=timed?null:read(values.reps,'Reps',1000,1,true),durationSec=timed?read(values.reps,'Seconds',3600,1):null;
  const rawLoad=read(values.load,'Load',imperial?2204.6226:1000),load=rawLoad==null?null:Math.round((imperial?rawLoad/2.20462262185:rawLoad)*10000)/10000;
  if(!['working','warmup'].includes(values.kind||'working'))throw Error('Choose a set type.');
  const set={id:id(),reps,load,kind:values.kind||'working',rir:read(values.rir,'Reps in reserve',10),rpe:read(values.rpe,'Perceived effort',10,1),completedAt:now.toISOString()};
  if(timed)set.durationSec=durationSec;return set;
}
export function summarizeSets(setLog=[]){
  const same=key=>setLog.length&&setLog.every(s=>s[key]!=null&&s[key]===setLog[0][key])?setLog[0][key]:null;
  return {sets:setLog.length||null,reps:same('reps'),load:same('load')};
}
export function sessionRecord(draft,{status,durationMin=null,notes=draft.notes||''}={}){
  if(!['partial','completed'].includes(status))throw Error('Choose partial or explicitly completed.');
  if(durationMin!=null&&(!isNumber(durationMin)||durationMin<0||durationMin>1440))throw Error('Duration must be between 0 and 1440 minutes.');
  const actualExercises=draft.exercises.filter(e=>e.setLog?.length).map(e=>({name:e.name,...summarizeSets(e.setLog),...(e.originalName!==e.name?{originalName:e.originalName}:{}),measure:/sec/i.test(e.reps)?'seconds':'reps',muscles:[...(findExerciseDemo(e.name)?.muscles||[])],setLog:structuredClone(e.setLog)}));
  if(!actualExercises.length)throw Error('Mark at least one performed set before saving.');
  return {id:draft.id,sessionId:draft.sessionId,name:draft.name,status,durationMin,notes:String(notes||'').trim(),actualExercises};
}
export function actualSets(exercise,{workingOnly=true}={}){
  if(Array.isArray(exercise.setLog))return exercise.setLog.filter(s=>!workingOnly||s.kind==='working');
  const count=Number.isInteger(exercise.sets)&&exercise.sets>0?exercise.sets:0;
  const reps=typeof exercise.reps==='number'&&exercise.reps>0?exercise.reps:typeof exercise.reps==='string'&&/^\d+$/.test(exercise.reps.trim())?Number(exercise.reps):null;
  return Array.from({length:count},()=>({kind:'working',reps,load:exercise.load??exercise.loadKg??null,legacy:true}));
}
export function performanceHistory(data,name,before='9999-99-99'){
  const key=exerciseKey(name),out=[];for(const[date,day]of Object.entries(data.days||{})){if(date>before)continue;for(const workout of day.workouts||[])for(const exercise of workout.actualExercises||[])if(exerciseKey(exercise.name)===key)out.push({date,workoutId:workout.id,exercise,sets:actualSets(exercise)});}
  return out.sort((a,b)=>a.date.localeCompare(b.date));
}
export const previousPerformance=(data,name,before)=>performanceHistory(data,name,before).at(-1)||null;
export function personalRecords(data,end='9999-99-99'){
  const result=new Map();for(const[date,day]of Object.entries(data.days||{})){if(date>end)continue;for(const w of day.workouts||[])for(const e of w.actualExercises||[]){const sets=actualSets(e),key=exerciseKey(e.name);if(!sets.length)continue;let r=result.get(key)||{name:e.name,key,maxLoad:null,maxReps:null,maxVolume:null};for(const s of sets){if(isNumber(s.load)&&(r.maxLoad==null||s.load>r.maxLoad.value))r.maxLoad={value:s.load,date};if(e.measure!=='seconds'&&isNumber(s.reps)&&(r.maxReps==null||s.reps>r.maxReps.value))r.maxReps={value:s.reps,date};if(e.measure!=='seconds'&&isNumber(s.reps)&&isNumber(s.load)){const volume=s.reps*s.load;if(r.maxVolume==null||volume>r.maxVolume.value)r.maxVolume={value:volume,date};}}result.set(key,r);}}
  return [...result.values()].filter(r=>r.maxLoad||r.maxReps||r.maxVolume);
}
export function weeklyVolume(data,end){
  const d=new Date(`${end}T12:00:00Z`),offset=(d.getUTCDay()+6)%7,start=shiftDate(end,-offset),byExercise=new Map(),byMuscle=new Map();let sets=0,warmupSets=0,knownVolume=0,unknownVolumeSets=0,unmappedSets=0;
  for(const[date,day]of Object.entries(data.days||{})){if(date<start||date>end)continue;for(const w of day.workouts||[])for(const e of w.actualExercises||[]){const actual=actualSets(e),warmups=actualSets(e,{workingOnly:false}).filter(s=>s.kind==='warmup');warmupSets+=warmups.length;if(!actual.length)continue;sets+=actual.length;const key=exerciseKey(e.name),row=byExercise.get(key)||{name:e.name,sets:0,volume:0,unknown:0};row.sets+=actual.length;
    for(const s of actual){if(e.measure!=='seconds'&&isNumber(s.reps)&&isNumber(s.load)){const v=s.reps*s.load;row.volume+=v;knownVolume+=v;}else{row.unknown++;unknownVolumeSets++;}}
    byExercise.set(key,row);const muscles=e.muscles?.length?e.muscles:findExerciseDemo(e.name)?.muscles||[];if(!muscles.length)unmappedSets+=actual.length;for(const m of new Set(muscles))byMuscle.set(m,(byMuscle.get(m)||0)+actual.length);
  }}return{start,end,sets,warmupSets,knownVolume,unknownVolumeSets,unmappedSets,exercises:[...byExercise.values()].sort((a,b)=>b.sets-a.sets),muscles:[...byMuscle].map(([name,sets])=>({name,sets})).sort((a,b)=>b.sets-a.sets)};
}
export function progressionStatus(exercise,rule){
  if(!rule)return{met:false,reason:'Choose a progression rule.'};const sets=actualSets(exercise);
  if(sets.length<rule.sets)return{met:false,reason:`${sets.length} / ${rule.sets} working sets recorded.`};
  const met=sets.every(s=>isNumber(s.reps)&&s.reps>=rule.reps&&(rule.load==null||(isNumber(s.load)&&s.load>=rule.load))&&(rule.rir==null||(isNumber(s.rir)&&s.rir>=rule.rir)));
  return{met,reason:met?'Your recorded working sets meet this rule.':'Recorded sets do not yet meet every selected threshold.'};
}
export function supersetNext(draft,index,groups=[]){
  const current=draft.exercises[index],group=groups.find(g=>g.includes(current.originalName||current.name));
  if(!group)return{index,rest:true};const members=group.map(name=>draft.exercises.findIndex(e=>(e.originalName||e.name)===name)).filter(i=>i>=0);
  const counts=members.map(i=>({index:i,count:actualSets(draft.exercises[i]).length})),min=Math.min(...counts.map(c=>c.count));
  const next=counts.find(c=>c.count===min&&c.index!==index);return{index:next?.index??index,rest:counts.every(c=>c.count===counts[0].count)};
}

/** Correct existing performed sets while preserving their identity, timestamps and future metadata. */
export function correctWorkoutRecord(record,changes={}, {imperial=false}={}){
  const result=structuredClone(record),name=changes.name??record.name,status=changes.status??record.status,durationMin=changes.durationMin===undefined?record.durationMin??null:changes.durationMin;
  if(typeof name!=='string'||!name.trim()||name.length>500)throw Error('Enter a session name of 1–500 characters.');
  if(!['partial','completed'].includes(status))throw Error('Choose partial or completed.');
  if(durationMin!=null&&(!Number.isFinite(durationMin)||durationMin<0||durationMin>1440))throw Error('Duration must be between 0 and 1440 minutes.');
  result.name=name.trim();result.status=status;result.durationMin=durationMin;if(changes.notes!==undefined)result.notes=String(changes.notes).trim();
  const updates=changes.sets||[],knownKeys=new Set();
  for(const [exerciseIndex,e]of(result.actualExercises||[]).entries()){
    if(!Array.isArray(e.setLog))continue;const timed=e.measure==='seconds';
    e.setLog=e.setLog.flatMap(original=>{
      const key=exerciseIndex+':'+original.id;knownKeys.add(key);const update=updates.find(u=>u.exerciseIndex===exerciseIndex&&u.setId===original.id);if(!update)return[original];if(update.remove)return[];
      const originalInput={reps:(timed?original.durationSec:original.reps)??'',load:original.load==null?'':original.load*(imperial?2.20462262185:1),kind:original.kind,rir:original.rir??'',rpe:original.rpe??''};
      const values={...originalInput,...update.values},parsed=completedSet(values,{id:()=>original.id,now:new Date(original.completedAt),timed,imperial});
      const revised={...original,...parsed,completedAt:original.completedAt};
      // An untouched display value must not round an existing canonical kg reading.
      if(String(values.load)===String(originalInput.load))revised.load=original.load;
      return[revised];
    });Object.assign(e,summarizeSets(e.setLog));
  }
  if(updates.some(u=>!knownKeys.has(u.exerciseIndex+':'+u.setId)))throw Error('A performed set no longer matches this record. Reopen the session before editing.');
  result.actualExercises=(result.actualExercises||[]).filter(e=>!Array.isArray(e.setLog)||e.setLog.length);
  return result;
}

/** Combine unsaved session setup edits in one explicit save, without losing other sessions. */
export function mergeWorkoutSetup(data,baseline,edits=[],fields={}){
  const cfg=structuredClone(baseline);cfg.equipment=[...(fields.equipment??baseline.equipment??[])];cfg.substitutions??={};cfg.supersets??={};cfg.progression??={};
  for(const edit of edits){const session=data.training.sessions.find(s=>s.id===edit.sessionId);if(!session)throw Error('This session changed. Reopen training setup.');cfg.substitutions[session.id]={};
    for(const e of session.exercises){const name=edit.substitutions?.[e.name];if(name)cfg.substitutions[session.id][e.name]=name;}
    const groups=(baseline.supersets?.[session.id]||[]).filter((_,i)=>edit.keepGroupIndices.includes(i)),added=[...new Set(edit.addGroupIndices)].map(i=>session.exercises[i]?.name).filter(Boolean);
    if(added.length===1)throw Error(`${session.name}: choose at least two movements for a superset, or leave the new group empty.`);
    if(added.length>1){if(groups.some(g=>g.some(n=>added.includes(n))))throw Error(`${session.name}: remove the existing overlapping group before adding this superset.`);groups.push(added);}cfg.supersets[session.id]=groups;
  }
  if(fields.keepRules)for(const name of Object.keys(cfg.progression))if(!fields.keepRules.includes(name))delete cfg.progression[name];
  if(fields.ruleName){const read=(value,min,max,integer=false)=>{if(value==null||String(value).trim()==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw Error('Enter valid progression thresholds.');return n;};
    const sets=read(fields.ruleSets,1,100,true),reps=read(fields.ruleReps,1,1000,true);if(sets==null||reps==null)throw Error('A progression rule requires working sets and reps.');
    const load=read(fields.ruleLoad,0,fields.imperial?2204.6226:1000);cfg.progression[fields.ruleName]={sets,reps,load:load==null?null:Math.round((fields.imperial?load/2.20462262185:load)*10000)/10000,rir:read(fields.ruleRir,0,10)};
  }
  return cfg;
}
