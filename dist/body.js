import {validate, shiftDate, dayFor, round} from './model.js';

export const BODY_FIELDS = [
  ['neck','Neck'], ['shoulders','Shoulders'], ['chest','Chest'],
  ['waist','Waist at navel'], ['hips','Hips'],
  ['upperArmLeft','Left upper arm'], ['upperArmRight','Right upper arm'],
  ['forearmLeft','Left forearm'], ['forearmRight','Right forearm'],
  ['thighLeft','Left thigh'], ['thighRight','Right thigh'],
  ['calfLeft','Left calf'], ['calfRight','Right calf']
];
export const METHODS = ['Not specified','BIA scale','BIA watch','Calipers','DEXA','Visual estimate','Other'];
export const emptyDay = () => ({food:[],workouts:[],steps:null,waterMl:null,weightKg:null,notes:''});
export function ensureDay(data,date) { return data.days[date] ??= emptyDay(); }
export function assertUnchanged(current,baseline) {
  if(JSON.stringify(current)!==JSON.stringify(baseline)) throw Error('This record changed elsewhere. Close this form and reopen it to review the latest values. Nothing was overwritten.');
}
export function validDate(date) {
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  try {return shiftDate(date,0)===date;} catch {return false;}
}
export function validateHealth(data) {
  // Diagnose the exact offending entry, before the original validator rejects the whole file.
  if(data?.days) for(const [date,day] of Object.entries(data.days)) {
    const ids=new Set();
    for(const kind of ['food','workouts']) for(const [index,entry] of (Array.isArray(day[kind])?day[kind]:[]).entries()) {
      if(typeof entry.id!=='string'||!entry.id.trim()||ids.has(entry.id)) throw Error(`${date}: ${kind}[${index}] has a missing or duplicate id. Repair the source record; refreshing cannot repair it.`);
      ids.add(entry.id);
    }
  }
  validate(data);
  const number=(value,name,max,min=0)=>{
    if(value!=null&&(!Number.isFinite(value)||value<=min||value>max))throw Error(`${name} must be greater than ${min} and no more than ${max}.`);
  };
  number(data.profile.heightCm,'Height (cm)',300);
  for(const session of data.training.sessions)for(const exercise of session.exercises){
    if(typeof exercise.name!=='string'||!exercise.name.trim())throw Error(`Session ${session.id}: exercise name is required.`);
    if(!Number.isInteger(exercise.sets)||exercise.sets<1||exercise.sets>100)throw Error(`Session ${session.id}: prescribed sets must be a positive integer.`);
    if(typeof exercise.reps!=='string'&&typeof exercise.reps!=='number')throw Error(`Session ${session.id}: prescribed reps are required.`);
    number(exercise.rest,`Session ${session.id}: rest (seconds)`,3600);
  }
  for(const [date,day] of Object.entries(data.days)) {
    number(day.weightKg,`${date}: weight (kg)`,500);
    for(const w of day.workouts) {
      if(typeof w.name!=='string'||!w.name.trim())throw Error(`${date}: workout name is required.`);
      if(!['partial','completed'].includes(w.status))throw Error(`${date}: invalid workout status.`);
      if(w.actualExercises!=null&&!Array.isArray(w.actualExercises))throw Error(`${date}: actual exercises must be an array.`);
      for(const exercise of w.actualExercises||[]){
        if(typeof exercise.name!=='string'||!exercise.name.trim())throw Error(`${date}: actual exercise name is required.`);
        if(exercise.sets!=null&&(!Number.isInteger(exercise.sets)||exercise.sets<1||exercise.sets>100))throw Error(`${date}: actual sets must be a positive integer.`);
        const load=exercise.load??exercise.loadKg;
        if(load!=null&&(!Number.isFinite(load)||load<0||load>1000))throw Error(`${date}: invalid exercise load.`);
        if(exercise.reps!=null&&!['string','number'].includes(typeof exercise.reps))throw Error(`${date}: invalid exercise reps.`);
      }
    }
    const b=day.body;if(b==null)continue;
    if(typeof b!=='object'||Array.isArray(b))throw Error(`${date}: body must be an object.`);
    number(b.bodyFatPct,`${date}: body fat (%)`,99.9);
    if(b.method!=null&&!METHODS.includes(b.method))throw Error(`${date}: unknown body-fat measurement method.`);
    if(b.notes!=null&&typeof b.notes!=='string')throw Error(`${date}: body notes must be text.`);
    if(b.measurementsCm!=null&&(typeof b.measurementsCm!=='object'||Array.isArray(b.measurementsCm)))throw Error(`${date}: measurements must be an object.`);
    for(const [key,label] of BODY_FIELDS)number(b.measurementsCm?.[key],`${date}: ${label} (cm)`,400);
  }
  return data;
}
export function bodyValue(day,key) {
  return key==='weightKg'?day.weightKg??null:key==='bodyFatPct'?day.body?.bodyFatPct??null:day.body?.measurementsCm?.[key]??null;
}
export function bodySeries(data,key,end,range=30) {
  const start=range==='all'?'0000-00-00':shiftDate(end,1-Number(range));
  return Object.entries(data.days).filter(([date])=>date>=start&&date<=end)
    .map(([date,d])=>({date,value:bodyValue(d,key),method:d.body?.method||'Not specified'}))
    .filter(p=>Number.isFinite(p.value)).sort((a,b)=>a.date.localeCompare(b.date));
}
export function bodySummary(data,key,date) {
  const all=bodySeries(data,key,date,'all'),week=bodySeries(data,key,date,7),last=all.at(-1),first=all[0];
  return {last,first,count:all.length,weekCount:week.length,
    weekMean:week.length?round(week.reduce((s,p)=>s+p.value,0)/week.length):null,
    change:all.length>1?round(last.value-first.value):null};
}
export function bodyDays(data,end) {
  return Object.entries(data.days).filter(([date,d])=>date<=end&&(d.weightKg!=null||d.body?.bodyFatPct!=null||BODY_FIELDS.some(([k])=>d.body?.measurementsCm?.[k]!=null)||d.body?.notes))
    .sort(([a],[b])=>b.localeCompare(a));
}
export function displayUnit(key,units='metric') {return key==='bodyFatPct'?'%':key==='weightKg'?(units==='imperial'?'lb':'kg'):(units==='imperial'?'in':'cm');}
export function fromMetric(value,key,units='metric') {return value==null?null:units==='imperial'?(key==='weightKg'?value*2.20462262185:key==='bodyFatPct'?value:value/2.54):value;}
export function toMetric(value,key,units='metric') {return value==null?null:Math.round((units==='imperial'?(key==='weightKg'?value/2.20462262185:key==='bodyFatPct'?value:value*2.54):value)*10000)/10000;}
export function sameDayComposition(data,date) {
  const d=dayFor(data,date);if(d.weightKg==null||d.body?.bodyFatPct==null)return null;
  return {fat:round(d.weightKg*d.body.bodyFatPct/100),fatFree:round(d.weightKg*(1-d.body.bodyFatPct/100))};
}
