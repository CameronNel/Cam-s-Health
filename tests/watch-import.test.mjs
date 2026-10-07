import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWatchImport,prepareWatchImport,WATCH_IMPORT_FORMAT,WATCH_IMPORT_MAX_BYTES} from '../dist/integrations/watch-import.js';
import {validateLifeHealth} from '../dist/health-intelligence.js';
const DATE='2026-10-06',NOW=new Date('2026-10-06T18:00:00Z');
const day=values=>({food:[],workouts:[],steps:null,waterMl:null,weightKg:null,notes:'Retain notes',...values});
const fresh=()=>({schemaVersion:1,updatedAt:'2026-10-01T12:00:00Z',profile:{name:'Isolated fixture',timezone:'Europe/Amsterdam',targets:{kcal:1900,protein:150,carbs:210,fat:50,steps:10000},trainingStatus:'awaiting clearance'},training:{rotation:['a','rest'],sessions:[{id:'a',name:'Session A',exercises:[]},{id:'rest',name:'Rest',exercises:[]}]},recipes:{retain:{name:'Existing recipe'}},provenance:{retain:true},days:{[DATE]:day(), '2026-09-01':day({weightKg:70})}});
const source=()=>({recordIds:['fixture-uuid'],appPackages:['com.sec.android.app.shealth'],recordedAt:'2026-10-06T12:00:00Z'});
const workout=()=>({id:'fixture-workout',name:'Recorded walk',durationMin:30,startTime:'2026-10-06T08:00:00Z',endTime:'2026-10-06T08:30:00Z',appPackage:'com.sec.android.app.shealth'});
const bundle=(values={steps:6500})=>({format:WATCH_IMPORT_FORMAT,version:1,exportedAt:'2026-10-06T17:00:00Z',timezone:'Europe/Amsterdam',days:[{date:DATE,...values,sources:Object.fromEntries(Object.keys(values).filter(k=>k!=='workouts').map(k=>[k,source()]))}]});

test('companion imports preserve version 1 data and unrelated records without mutating source',()=>{
 const data=fresh(),before=structuredClone(data),proposal=prepareWatchImport(data,bundle({steps:6500,waterMl:1800,weightKg:65.5,bodyFatPct:12.5,sleepHours:7.2,workouts:[workout()]}),{now:NOW});
 assert.deepEqual(data,before);assert.equal(proposal.accepted.length,6);assert.equal(proposal.candidate.schemaVersion,1);
 for(const key of ['profile','training','recipes','provenance'])assert.deepEqual(proposal.candidate[key],before[key]);
 assert.deepEqual(proposal.candidate.days['2026-09-01'],before.days['2026-09-01']);assert.equal(proposal.candidate.days[DATE].notes,'Retain notes');
 assert.equal(proposal.candidate.days[DATE].body.method,'Not specified');assert.equal(proposal.candidate.days[DATE].body.skeletalMuscleKg,undefined);
 assert.equal(proposal.candidate.days[DATE].workouts[0].sessionId,null);assert.equal(proposal.candidate.days[DATE].healthConnect.steps.importedAt,NOW.toISOString());
 assert.equal(validateLifeHealth(proposal.candidate),proposal.candidate);assert.equal(proposal.candidate.updatedAt,data.updatedAt);
});
test('only supplied readings are imported and unknown stays unknown',()=>{
 const p=prepareWatchImport(fresh(),bundle(),{now:NOW});assert.equal(p.candidate.days[DATE].waterMl,null);assert.equal(p.candidate.days[DATE].wellbeing,undefined);assert.equal(p.candidate.days[DATE].food.length,0);
 assert.equal(prepareWatchImport(fresh(),bundle({steps:0}),{now:NOW}).candidate.days[DATE].steps,0);
 assert.throws(()=>prepareWatchImport(fresh(),bundle({steps:null})),/outside/);
});
test('daily totals are never incremented and conflicts are unselected by default',()=>{
 const data=fresh();data.days[DATE].steps=5000;
 const p=prepareWatchImport(data,bundle({steps:6500,waterMl:1000}),{now:NOW});assert.equal(p.changes[0].status,'conflict');assert.equal(p.candidate.days[DATE].steps,5000);assert.equal(p.candidate.days[DATE].waterMl,1000);
 const resolved=prepareWatchImport(data,p.bundle,{now:NOW,selectedKeys:[`${DATE}:steps`]});assert.equal(resolved.candidate.days[DATE].steps,6500);assert.equal(resolved.candidate.days[DATE].waterMl,null);
});
test('identical reimport is a no-op and does not duplicate workouts',()=>{
 const p=prepareWatchImport(fresh(),bundle({steps:6500,workouts:[workout()]}),{now:NOW});const again=prepareWatchImport(p.candidate,p.bundle,{now:NOW});
 assert.equal(again.accepted.length,0);assert.deepEqual(again.candidate,p.candidate);assert.equal(again.candidate.days[DATE].workouts.length,1);
});
test('different existing workout IDs require review for possible duplicate sessions',()=>{
 const data=fresh();data.days[DATE].workouts=[{id:'manual-walk',sessionId:null,name:'Walk',status:'completed',durationMin:30,notes:'Retain this'}];
 const p=prepareWatchImport(data,bundle({workouts:[workout()]}),{now:NOW});assert.equal(p.changes[0].status,'conflict');assert.equal(p.accepted.length,0);assert.deepEqual(p.candidate,data);
});
test('device corrections retain annotations, manual naming, program status and actual sets',()=>{
 const p=prepareWatchImport(fresh(),bundle({workouts:[workout()]}),{now:NOW}),data=p.candidate,w=data.days[DATE].workouts[0];
 w.notes='Actual user notes';w.name='My edited walk';w.status='partial';w.sessionId='a';w.actualExercises=[{name:'Actual exercise',sets:2,reps:'8',load:10}];w.loggedAt='2026-10-06T10:00:00Z';
 const b=bundle({workouts:[{...workout(),name:'Updated device title',durationMin:45,endTime:'2026-10-06T08:45:00Z'}]});
 const review=prepareWatchImport(data,b,{now:NOW});assert.equal(review.accepted.length,0);
 const resolved=prepareWatchImport(data,b,{now:NOW,selectedKeys:[review.changes[0].key]}),saved=resolved.candidate.days[DATE].workouts[0];
 assert.equal(saved.durationMin,45);for(const key of ['notes','name','status','sessionId','actualExercises','loggedAt'])assert.deepEqual(saved[key],w[key]);
 assert.equal(saved.healthConnect.originalName,'Updated device title');
});
test('field CAS prevents overwrite and no earlier accepted change is partially applied',()=>{
 const data=fresh(),p=prepareWatchImport(data,bundle({steps:6500,waterMl:1000}),{now:NOW}),current=structuredClone(data);current.days[DATE].waterMl=300;const before=structuredClone(current);
 assert.throws(()=>p.apply(current),/changed elsewhere/);assert.deepEqual(current,before);
});
test('CAS preserves unrelated concurrent edits and refuses changed device provenance',()=>{
 const data=fresh(),p=prepareWatchImport(data,bundle(),{now:NOW}),current=structuredClone(data);current.days[DATE].waterMl=300;current.days[DATE].notes='Concurrent note';p.apply(current);
 assert.equal(current.days[DATE].waterMl,300);assert.equal(current.days[DATE].notes,'Concurrent note');
 const next=fresh();next.days[DATE].healthConnect={steps:{changed:true}};assert.throws(()=>p.apply(next),/changed elsewhere/);
});
test('body-fat imports preserve circumferences, muscle and notes but require method review',()=>{
 const data=fresh();data.days[DATE].body={bodyFatPct:12.5,method:'BIA watch',skeletalMuscleKg:30,measurementsCm:{waist:78},notes:'Retain measurement context'};
 const p=prepareWatchImport(data,bundle({bodyFatPct:12.5}),{now:NOW});assert.equal(p.changes[0].status,'conflict');assert.deepEqual(p.candidate,data);
 const resolved=prepareWatchImport(data,p.bundle,{now:NOW,selectedKeys:[`${DATE}:bodyFatPct`]});assert.equal(resolved.candidate.days[DATE].body.method,'Not specified');assert.equal(resolved.candidate.days[DATE].body.notes,data.days[DATE].body.notes);assert.equal(resolved.candidate.days[DATE].body.measurementsCm.waist,78);assert.equal(resolved.candidate.days[DATE].body.skeletalMuscleKg,30);
 const concurrent=structuredClone(data);concurrent.days[DATE].body.method='DEXA';assert.throws(()=>resolved.apply(concurrent),/changed elsewhere/);
});
test('an imported weight cannot invalidate a same-day skeletal muscle measurement',()=>{
 const data=fresh();data.days[DATE].body={skeletalMuscleKg:30};assert.throws(()=>prepareWatchImport(data,bundle({weightKg:25})),/cannot exceed/);
});
test('timezone mismatch never shifts existing dates silently',()=>{
 const b=bundle();b.timezone='UTC';assert.throws(()=>prepareWatchImport(fresh(),b),/Export in your profile timezone/);
 const p=prepareWatchImport(fresh(),bundle(),{now:NOW}),current=fresh();current.profile.timezone='UTC';assert.throws(()=>p.apply(current),/timezone changed/);
});
test('strict import rejects unsupported formats, fields, unsafe bounds and duplicates',()=>{
 const bad=[];
 for(const patch of [{format:'samsung-csv'},{version:2},{timezone:'bad'},{exportedAt:'bad'},{unsupported:true}])bad.push({...bundle(),...patch});
 for(const values of [{steps:1.5},{steps:200001},{waterMl:-1},{weightKg:0},{bodyFatPct:100},{sleepHours:25},{skeletalMuscleKg:31}])bad.push(bundle(values));
 const duplicate=bundle();duplicate.days.push(structuredClone(duplicate.days[0]));bad.push(duplicate);
 const orphan=bundle();delete orphan.days[0].steps;bad.push(orphan);
 const missing=bundle();missing.days[0].sources={};bad.push(missing);
 const excess=bundle();excess.days=Array.from({length:32},()=>structuredClone(excess.days[0]));bad.push(excess);
 for(const b of bad)assert.throws(()=>parseWatchImport(b));
 assert.throws(()=>parseWatchImport('no JSON'),/not valid JSON/);assert.throws(()=>parseWatchImport(' '.repeat(WATCH_IMPORT_MAX_BYTES+1)),/2 MB/);
});
test('workouts preserve known duration and reject duplicate IDs or wrong dates',()=>{
 for(const values of [{id:'../bad'},{durationMin:50},{endTime:'2026-10-06T07:00:00Z'},{appPackage:'javascript:bad'},{startTime:'2026-10-05T08:00:00Z',endTime:'2026-10-05T08:30:00Z'}])assert.throws(()=>parseWatchImport(bundle({workouts:[{...workout(),...values}]})));
 assert.throws(()=>parseWatchImport(bundle({workouts:[workout(),workout()]})),/unique/);
});
test('selection is explicit and valid; empty import never creates fake dates',()=>{
 assert.throws(()=>prepareWatchImport(fresh(),bundle(),{selectedKeys:['missing']}),/valid set/);
 assert.throws(()=>prepareWatchImport(fresh(),bundle(),{selectedKeys:[`${DATE}:steps`,`${DATE}:steps`]}),/valid set/);
 const data=fresh(),b=bundle();b.days=[];const p=prepareWatchImport(data,b,{now:NOW});assert.deepEqual(p.candidate,data);assert.equal(p.accepted.length,0);
});
