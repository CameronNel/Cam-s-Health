import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {today,totals,validate,nextSession,dayFor,shiftDate,brief} from '../dist/model.js';
import {validateHealth} from '../dist/body.js';

// Deterministic unit fixtures must not read a person's changing food diary.
// The actual committed record is validated independently below and by CI.
const rotation=['push-a','pull-a','legs-a','push-b','pull-b','legs-b','rest'];
const seed={
  schemaVersion:1,updatedAt:'2026-09-22T00:00:00Z',
  profile:{name:'Test user',timezone:'Europe/Amsterdam',targets:{kcal:1900,protein:170,carbs:null,fat:null,steps:10000},trainingStatus:'awaiting clearance'},
  training:{rotation,sessions:rotation.map(id=>({id,name:id,exercises:[]}))},
  days:{'2026-09-22':{
    food:[[313,32.3,5.1,17.7],[320,13.6,31.2,14.7],[60,1.2,6.4,3.4],[140,11.2,7.2,10.4]].map(([kcal,protein,carbs,fat],i)=>({id:`fixture-food-${i}`,name:`Fixture food ${i}`,quantity:'1 test portion',kcal,protein,carbs,fat,estimated:true})),
    workouts:[],steps:null,waterMl:null,weightKg:null,notes:''
  }}
};
const session=(id,sessionId,status)=>({id,sessionId,status,name:sessionId||'Custom',durationMin:null});

test('seeded totals and unlogged activity remain distinct',()=>{validate(seed);assert.deepEqual(totals(seed.days['2026-09-22']),{kcal:833,protein:58.3,carbs:49.9,fat:46.2,estimated:4,pending:0,missing:{kcal:0,protein:0,carbs:0,fat:0}});assert.equal(dayFor(seed,'2026-09-23').steps,null);});
test('rotation follows completed sessions, includes rest, and ignores partial/custom/future sessions',()=>{const d=structuredClone(seed);assert.equal(nextSession(d,'2026-09-22').id,'push-a');d.days['2026-09-22'].workouts=[session('done-legs','legs-a','completed'),session('partial-push','push-b','partial'),session('custom',null,'completed')];assert.equal(nextSession(d,'2026-09-22').id,'push-b');d.days['2026-09-23']={food:[],workouts:[session('future-legs','legs-b','completed')]};assert.equal(nextSession(d,'2026-09-22').id,'push-b');assert.equal(nextSession(d,'2026-09-23').id,'rest');d.days['2026-09-23'].workouts.push(session('rest-day','rest','completed'));assert.equal(nextSession(d,'2026-09-23').id,'push-a');});
test('Netherlands date and calendar rollovers',()=>{assert.equal(today('Europe/Amsterdam',new Date('2026-09-22T22:30:00Z')),'2026-09-23');assert.equal(shiftDate('2026-12-31',1),'2027-01-01');});
test('unknown macros are flagged and negative or duplicate entries rejected',()=>{assert.equal(totals({food:[{kcal:null,protein:null,carbs:null,fat:null}]}).pending,1);const d=structuredClone(seed);d.days['2026-09-22'].steps=-1;assert.throws(()=>validate(d),/steps/);d.days['2026-09-22'].steps=null;d.days['2026-09-22'].food.push(d.days['2026-09-22'].food[0]);assert.throws(()=>validate(d),/duplicate/);});
test('brief does not invent steps or training',()=>{assert.match(brief(seed,'2026-09-22'),/Steps: not logged/);assert.match(brief(seed,'2026-09-22'),/Training: not logged/);});
test('the current record validates without freezing food totals or workout history',()=>{const current=JSON.parse(readFileSync(new URL('../dist/data/health.json',import.meta.url)));assert.doesNotThrow(()=>validateHealth(current));});
