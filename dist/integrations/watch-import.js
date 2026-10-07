import {validateLifeHealth} from '../health-intelligence.js';
import {ensureDay, validDate, assertUnchanged} from '../body.js';

export const WATCH_IMPORT_FORMAT = 'cams-life-health-connect';
export const WATCH_IMPORT_VERSION = 1;
export const WATCH_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const fields = {
  steps: {label:'Steps', unit:'steps', max:200000, integer:true},
  waterMl: {label:'Water', unit:'ml', max:20000},
  weightKg: {label:'Weight', unit:'kg', max:500, positive:true},
  bodyFatPct: {label:'Body fat', unit:'%', max:99.9, positive:true},
  sleepHours: {label:'Sleep', unit:'hours', max:24}
};
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const object = o => o !== null && typeof o === 'object' && !Array.isArray(o) && [Object.prototype,null].includes(Object.getPrototypeOf(o));
const clone = o => structuredClone(o);
const iso = (v,name) => {if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!validDate(v.slice(0,10))||!Number.isFinite(Date.parse(v)))throw Error(`${name} must be an ISO timestamp.`);};
const text = (v,name,max=200) => {if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${name} must be non-empty text of at most ${max} characters.`);};
function keys(o,allowed,name){if(!object(o))throw Error(`${name} must be an object.`);for(const k of Object.keys(o))if(!allowed.includes(k))throw Error(`Unsupported ${name} field: ${k}.`);}
function number(v,name,config){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>config.max||(config.positive&&v===0)||(config.integer&&!Number.isInteger(v)))throw Error(`${name} is outside its supported range.`);}
function origin(value,name){
  keys(value,['recordIds','appPackages','recordedAt'],name);
  iso(value.recordedAt,`${name} timestamp`);
  for(const k of ['recordIds','appPackages']){
    if(!Array.isArray(value[k])||!value[k].length||value[k].length>5000)throw Error(`${name} ${k} must be a non-empty list.`);
    for(const v of value[k])text(v,`${name} ${k}`,200);
    if(new Set(value[k]).size!==value[k].length)throw Error(`${name} ${k} contains duplicates.`);
  }
  for(const app of value.appPackages)if(!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(app))throw Error(`${name} has an invalid source package.`);
}
function valueAt(day,kind){return kind==='bodyFatPct'?day?.body?.bodyFatPct??null:kind==='sleepHours'?day?.wellbeing?.sleepHours??null:day?.[kind]??null;}
function workoutFrom(source){
  return {id:`health-connect-${source.id}`,sessionId:null,name:source.name,status:'completed',durationMin:source.durationMin,
    notes:'Recorded exercise imported from Health Connect. Program session and exercise performance are not inferred.',
    source:'Health Connect',healthConnect:{recordId:source.id,appPackage:source.appPackage,startTime:source.startTime,endTime:source.endTime,originalName:source.name}};
}

/** Parse only the documented companion format. Raw Samsung CSV/ZIP is not guessed. */
export function parseWatchImport(input){
  let bundle=input;
  if(typeof input==='string'){
    if(new TextEncoder().encode(input).length>WATCH_IMPORT_MAX_BYTES)throw Error('This import exceeds the 2 MB limit. Export a shorter date range.');
    try{bundle=JSON.parse(input);}catch{throw Error('Choose a Cam’s Life Health Connect JSON export. This file is not valid JSON.');}
  }
  if(typeof input!=='string'){
    try{if(new TextEncoder().encode(JSON.stringify(input)).length>WATCH_IMPORT_MAX_BYTES)throw Error('This import exceeds the 2 MB limit. Export a shorter date range.');}
    catch(error){if(error.message.includes('2 MB'))throw error;throw Error('Choose a serializable Health Connect import.');}
  }
  keys(bundle,['format','version','exportedAt','timezone','days'],'import');
  if(bundle.format!==WATCH_IMPORT_FORMAT||bundle.version!==WATCH_IMPORT_VERSION)throw Error('Choose a Cam’s Life Health Connect export, version 1. Raw Samsung downloads are not supported.');
  iso(bundle.exportedAt,'Export timestamp');text(bundle.timezone,'Export timezone',100);
  try{new Intl.DateTimeFormat('en',{timeZone:bundle.timezone}).format();}catch{throw Error('The export timezone is not supported.');}
  if(!Array.isArray(bundle.days)||bundle.days.length>31)throw Error('Export at most 31 calendar dates at a time.');
  const dates=new Set(),recordIds=new Set();
  for(const day of bundle.days){
    keys(day,['date',...Object.keys(fields),'sources','workouts'],'day');
    if(!validDate(day.date)||dates.has(day.date))throw Error('The export has an invalid or duplicate date.');dates.add(day.date);
    keys(day.sources??{},Object.keys(fields),'sources');
    for(const [kind,config] of Object.entries(fields)){
      if(own(day,kind)){number(day[kind],`${day.date}: ${config.label}`,config);origin(day.sources?.[kind],`${day.date}: ${config.label} source`);}
      else if(own(day.sources??{},kind))throw Error(`${day.date}: source supplied without a ${config.label} reading.`);
    }
    if(own(day,'workouts')){
      if(!Array.isArray(day.workouts)||day.workouts.length>200)throw Error(`${day.date}: workouts must be a list of at most 200 sessions.`);
      for(const w of day.workouts){
        keys(w,['id','name','durationMin','startTime','endTime','appPackage'],'workout');
        text(w.id,'Health Connect workout id',150);if(!/^[A-Za-z0-9_-]+$/.test(w.id)||recordIds.has(w.id))throw Error('Workout IDs must be unique and contain only letters, numbers, underscores or hyphens.');recordIds.add(w.id);
        text(w.name,'Workout name',300);number(w.durationMin,'Workout duration',{max:1440});iso(w.startTime,'Workout start');iso(w.endTime,'Workout end');
        if(Date.parse(w.endTime)<=Date.parse(w.startTime))throw Error('A workout must end after it starts.');
        const duration=(Date.parse(w.endTime)-Date.parse(w.startTime))/60000;
        if(Math.abs(duration-w.durationMin)>0.1)throw Error('Workout duration does not match its recorded interval.');
        text(w.appPackage,'Workout source');if(!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(w.appPackage))throw Error('Invalid workout source package.');
        const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:bundle.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(w.startTime)).map(part=>[part.type,part.value]));
        const date=`${parts.year}-${parts.month}-${parts.day}`;
        if(date!==day.date)throw Error('A workout date does not match the export timezone.');
      }
    }
  }
  return clone(bundle);
}

/** Review first. Existing different values are conflicts, never selected by default. */
export function prepareWatchImport(data,input,{selectedKeys,now=new Date()}={}){
  validateLifeHealth(data);const bundle=parseWatchImport(input);
  if(bundle.timezone!==data.profile.timezone)throw Error(`Export in your profile timezone (${data.profile.timezone}). No dates have been shifted.`);
  const changes=[];
  for(const imported of [...bundle.days].sort((a,b)=>a.date.localeCompare(b.date))){
    const day=data.days[imported.date];
    for(const [kind,config] of Object.entries(fields))if(own(imported,kind)){
      const before=valueAt(day,kind),after=imported[kind];
      const methodConflict=kind==='bodyFatPct'&&before!=null&&day.body?.method&&!['Not specified','Other'].includes(day.body.method);
      const status=before===after&&!methodConflict?'same':before==null?'new':'conflict';
      changes.push({key:`${imported.date}:${kind}`,date:imported.date,kind,label:config.label,unit:config.unit,before,value:after,status,
        source:clone(imported.sources[kind]),method:kind==='bodyFatPct'?'Not specified':null,
        baselineMethod:kind==='bodyFatPct'?day?.body?.method:undefined,baselineSource:clone(day?.healthConnect?.[kind])});
    }
    for(const importedWorkout of imported.workouts??[]){
      const incoming=workoutFrom(importedWorkout),before=day?.workouts.find(w=>w.id===incoming.id)??null;
      // Keep user annotations, exercise performance, status and any explicit program association.
      // Only a source title that has not been edited locally follows a changed device title.
      const value=before?{...clone(before),name:before.name===before.healthConnect?.originalName?incoming.name:before.name,
        durationMin:incoming.durationMin,healthConnect:{...clone(before.healthConnect),...incoming.healthConnect}}:incoming;
      const same=before&&JSON.stringify(before)===JSON.stringify(value);
      changes.push({key:`${imported.date}:workout:${value.id}`,date:imported.date,kind:'workout',label:value.name,unit:'minutes',before:clone(before),value,
        status:same?'same':before||day?.workouts.length?'conflict':'new',baselineWorkoutIds:(day?.workouts??[]).map(w=>w.id),source:{recordIds:[importedWorkout.id],appPackages:[importedWorkout.appPackage],recordedAt:importedWorkout.endTime}});
    }
  }
  const selection=selectedKeys===undefined?changes.filter(c=>c.status==='new').map(c=>c.key):selectedKeys;
  if(!Array.isArray(selection)||new Set(selection).size!==selection.length||selection.some(key=>!changes.some(c=>c.key===key&&c.status!=='same')))throw Error('Review a valid set of import readings before saving.');
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Choose a valid import timestamp.');
  const selected=new Set(selection),accepted=changes.filter(c=>selected.has(c.key)),importedAt=now.toISOString();
  function apply(current){
    validateLifeHealth(current);
    if(current.profile.timezone!==bundle.timezone)throw Error('Your profile timezone changed. Reopen this import before saving.');
    // Complete every conflict check before mutating any record.
    for(const c of accepted){
      const day=current.days[c.date];
      if(c.kind==='workout')assertUnchanged(day?.workouts.find(w=>w.id===c.value.id)??null,c.before);
      else assertUnchanged(valueAt(day,c.kind),c.before);
      if(c.kind==='bodyFatPct')assertUnchanged(day?.body?.method,c.baselineMethod);
      if(c.kind!=='workout')assertUnchanged(day?.healthConnect?.[c.kind],c.baselineSource);
      // A newly discovered unrelated workout may be the same event under a manual ID.
      if(c.kind==='workout')assertUnchanged((day?.workouts??[]).map(w=>w.id),c.baselineWorkoutIds);
    }
    const candidate=clone(current);
    for(const c of accepted){
      const day=ensureDay(candidate,c.date);
      if(c.kind==='workout'){
        const index=day.workouts.findIndex(w=>w.id===c.value.id);if(index<0)day.workouts.push(clone(c.value));else day.workouts[index]=clone(c.value);
      }else{
        if(c.kind==='bodyFatPct'){
          day.body={...day.body,bodyFatPct:c.value,method:'Not specified',recordedAt:importedAt};
        }else if(c.kind==='sleepHours')day.wellbeing={...day.wellbeing,sleepHours:c.value};
        else day[c.kind]=c.value;
        day.healthConnect={...day.healthConnect,[c.kind]:{...clone(c.source),importedAt,value:c.value}};
      }
    }
    validateLifeHealth(candidate);
    for(const c of accepted)current.days[c.date]=candidate.days[c.date];
    return current;
  }
  const candidate=clone(data);apply(candidate);
  return {bundle,changes,selectedKeys:selection,accepted,candidate,apply};
}
