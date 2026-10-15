import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLifeHealth} from '../dist/health-intelligence.js';
import {trackerSettings, validateTrackerExtensions, createUndoPatch, applyUndoPatch} from '../dist/tracker-model.js';

const DATE = '2026-10-15', LATER = '2026-10-16';
const NOW = '2026-10-15T10:00:00.000Z';
const day = values => ({food:[],workouts:[],steps:null,waterMl:null,weightKg:null,notes:'',...values});
const food = (id = 'food-1', values) => ({id,name:'Reviewed food',quantity:'100 g',kcal:100,protein:5,carbs:15,fat:2,estimated:false,source:'Package label',note:'',...values});
const fresh = () => ({schemaVersion:1,updatedAt:NOW,profile:{name:'Fixture',targets:{kcal:1900,protein:150},trainingStatus:'paused'},training:{rotation:['a','rest'],sessions:[{id:'a',name:'A',exercises:[{name:'Dumbbell squat',sets:3,reps:'8–12',rest:90},{name:'Dumbbell row',sets:3,reps:'8–12',rest:90}]},{id:'rest',name:'Rest',exercises:[]}]},days:{[DATE]:day({food:[food()]})},legacy:{keep:true}});
const nutrition = {kcal:100,protein:5,carbs:null,fat:2};
function allFeatures() {
  const data = fresh();
  data.tracker = {
    food:{
      library:[{id:'library-1',name:'A labelled food',per100g:nutrition,portions:[{id:'spoon',label:'measured spoon',grams:12}],densityGPerMl:null,source:'Package label',estimated:false}],
      favorites:[{id:'favorite-1',foodId:'library-1',amount:100,unit:'g'}],
      templates:[{id:'template-1',name:'Breakfast',meal:'breakfast',items:[food()]}],
      recipeVersions:[{id:'version-1',recipeId:'recipe-1',name:'Recipe',yieldG:400,servings:2,ingredients:[{name:'Ingredient',grams:100,...nutrition,source:'Package label'}],total:nutrition,per100g:nutrition,createdAt:NOW}],
      plannedMeals:{[LATER]:[{id:'plan-1',name:'Planned breakfast',meal:'breakfast',items:[food()]}]},
      targets:{training:{kcal:2000,protein:150,carbs:null,fat:null},rest:{kcal:1800}},dayTypes:{[DATE]:'rest'},proteinFocus:true
    },
    body:{pinned:['weightKg','waist','skeletalMuscleKg'],goals:{weightKg:{min:65,max:70},waist:{min:null,max:85}},annotations:[{id:'note-1',date:DATE,text:'New routine'}],reminder:{enabled:true,weekdays:[1,4],time:'08:30',timezone:'Europe/Amsterdam'}},
    workouts:{equipment:['dumbbells','bench'],substitutions:{a:{'Dumbbell squat':'Goblet squat'}},supersets:{a:[['Dumbbell squat','Dumbbell row']]},progression:{'Dumbbell squat':{sets:3,reps:12,load:null,rir:2}}},
    futureFeature:{kept:true}
  };
  data.days[DATE].food[0] = food('food-1',{meal:'lunch',portionGrams:100,nutritionConfirmed:true,foodLibraryId:'library-1',recipeVersionId:'version-1'});
  data.days[DATE].workouts.push({id:'workout-1',sessionId:'a',name:'A',status:'partial',durationMin:null,actualExercises:[{name:'Goblet squat',originalName:'Dumbbell squat',muscles:['Quadriceps'],measure:'reps',sets:2,reps:null,load:null,setLog:[{id:'set-1',kind:'warmup',reps:10,load:0,rir:null,rpe:null,completedAt:NOW},{id:'set-2',kind:'working',reps:null,load:10,rir:2,rpe:8,completedAt:NOW}]}]});
  return structuredClone(data);
}

test('optional tracker features validate through the canonical contract without mutation', () => {
  for (const data of [fresh(),allFeatures()]) {
    const baseline = structuredClone(data);
    assert.equal(validateLifeHealth(data),data);
    assert.deepEqual(data,baseline);
  }
});

test('tracker settings reads are detached and never create schema defaults in the source', () => {
  const data = fresh(), copy = structuredClone(data), missing = trackerSettings(data,'food');
  missing.proteinFocus = true;
  assert.deepEqual(data,copy);
  const configured = allFeatures(), setting = trackerSettings(configured,'body');
  setting.goals.weightKg.min = 1;
  assert.equal(configured.tracker.body.goals.weightKg.min,65);
});

test('unknown legacy and future fields are preserved; absent and unknown optional values stay unknown', () => {
  const data = fresh(); data.tracker = {food:null,body:null,workouts:null,anotherExtension:{anything:42}};
  const baseline = structuredClone(data);
  assert.equal(validateLifeHealth(data),data);
  assert.deepEqual(data,baseline);
  data.tracker.food = {library:[{id:'one',name:'Unknown nutrition',per100g:{kcal:null,protein:null,carbs:null,fat:null},densityGPerMl:null,portions:[],estimated:true}]};
  assert.equal(validateLifeHealth(data),data);
});

test('invalid food extensions reject malformed arrays, duplicates, dates, nutrition and portions', () => {
  const edits = [
    d => d.tracker.food.library = null,
    d => d.tracker.food.favorites.push({...d.tracker.food.favorites[0]}),
    d => d.tracker.food.library[0].per100g.protein = '20',
    d => d.tracker.food.library[0].densityGPerMl = 0,
    d => d.tracker.food.library[0].portions[0].grams = -1,
    d => d.tracker.food.library[0].url = 'javascript:alert(1)',
    d => d.tracker.food.library[0].barcode = 'ABC123',
    d => d.tracker.food.templates[0].items = [],
    d => d.tracker.food.templates[0].meal = 'second breakfast',
    d => d.tracker.food.plannedMeals['2026-02-30'] = [],
    d => d.tracker.food.dayTypes[DATE] = 'automatic',
    d => d.tracker.food.proteinFocus = 'true',
    d => d.tracker.food.recipeVersions[0].createdAt = '2026-02-30T10:00:00Z',
    d => d.tracker.food.recipeVersions[0].servings = 0,
    d => d.days[DATE].food[0].meal = 'dessert',
    d => d.days[DATE].food[0].nutritionConfirmed = null
  ];
  for (const edit of edits) { const data = allFeatures(); edit(data); assert.throws(() => validateLifeHealth(data)); }
});

test('plans, templates and recipes are never counted as actual food', () => {
  const data = allFeatures(), baseline = structuredClone(data.days);
  validateTrackerExtensions(data);
  assert.deepEqual(data.days,baseline);
  assert.equal(data.days[LATER],undefined);
  assert.equal(data.days[DATE].food.length,1);
});

test('body goals, pins, notes and reminders have precise bounds', () => {
  const edits = [
    d => d.tracker.body.goals.weightKg = {min:null,max:null},
    d => d.tracker.body.goals.weightKg = {min:80,max:70},
    d => d.tracker.body.goals.bodyFatPct = {max:100},
    d => d.tracker.body.goals.waist = {min:0},
    d => d.tracker.body.goals.fakeMetric = {max:10},
    d => d.tracker.body.pinned.push('weightKg'),
    d => d.tracker.body.annotations.push({...d.tracker.body.annotations[0]}),
    d => d.tracker.body.annotations[0].date = '2026-02-30',
    d => d.tracker.body.annotations[0].text = 'a'.repeat(501),
    d => d.tracker.body.reminder.weekdays = [1,1],
    d => d.tracker.body.reminder.weekdays = [7],
    d => d.tracker.body.reminder.time = '24:00',
    d => d.tracker.body.reminder.timezone = 'Not/a-timezone'
  ];
  for (const edit of edits) { const data = allFeatures(); edit(data); assert.throws(() => validateLifeHealth(data)); }
});

test('workout extensions reject invalid rules, repeated exercise groups and unsupported equipment', () => {
  const edits = [
    d => d.tracker.workouts.equipment.push('gym'),
    d => d.tracker.workouts.substitutions.unknown = {},
    d => d.tracker.workouts.substitutions.a['Not in session'] = 'Goblet squat',
    d => d.tracker.workouts.supersets.a = [['Dumbbell squat']],
    d => d.tracker.workouts.supersets.a = [['Dumbbell squat','Dumbbell squat']],
    d => d.tracker.workouts.progression['Dumbbell squat'].sets = 1.5,
    d => d.tracker.workouts.progression['Dumbbell squat'].load = -1,
    d => d.tracker.workouts.progression['Dumbbell squat'].rir = 11
  ];
  for (const edit of edits) { const data = allFeatures(); edit(data); assert.throws(() => validateLifeHealth(data)); }
});

test('individual sets retain unknowns and enforce effort, timing and workout-wide unique ids', () => {
  const data = allFeatures(), exercise = data.days[DATE].workouts[0].actualExercises[0];
  assert.equal(validateLifeHealth(data),data);
  for (const [key,value] of [['kind','completed'],['reps',0],['reps',2.5],['load',-1],['rir',11],['rpe',0],['completedAt','yesterday'],['durationSec',3601]]) {
    const bad = allFeatures(); bad.days[DATE].workouts[0].actualExercises[0].setLog[0][key] = value;
    assert.throws(() => validateLifeHealth(bad), /2026-10-15/);
  }
  data.days[DATE].workouts[0].actualExercises.push({...structuredClone(exercise),name:'Dumbbell row'});
  assert.throws(() => validateLifeHealth(data),/set ids must be unique/);
  const timed = allFeatures(), actual = timed.days[DATE].workouts[0].actualExercises[0];
  actual.measure = 'seconds'; actual.setLog = [{id:'timed-1',kind:'working',reps:null,durationSec:45,load:null,rir:null,rpe:null,completedAt:NOW}];
  assert.equal(validateLifeHealth(timed),timed);
  actual.setLog[0].reps = 10;
  assert.throws(() => validateLifeHealth(timed),/durationSec rather than reps/);
});

test('undo reverses only changed fields and preserves unrelated newer record fields', () => {
  const before = fresh(), after = structuredClone(before);
  after.days[DATE].food[0].kcal = 140; after.days[DATE].food[0].protein = 8; after.updatedAt = '2026-10-15T11:00:00Z';
  const patch = createUndoPatch(before,after), current = structuredClone(after);
  current.days[DATE].food[0].note = 'Newer unrelated note'; current.days[LATER] = day({weightKg:70}); current.updatedAt = '2026-10-16T11:00:00Z';
  const snapshot = structuredClone(current), undone = applyUndoPatch(current,patch);
  assert.deepEqual(current,snapshot);
  assert.equal(undone.days[DATE].food[0].kcal,100);
  assert.equal(undone.days[DATE].food[0].protein,5);
  assert.equal(undone.days[DATE].food[0].note,'Newer unrelated note');
  assert.deepEqual(undone.days[LATER],current.days[LATER]);
  assert.equal(undone.updatedAt,current.updatedAt);
  validateLifeHealth(undone);
});

test('undo of an inserted food targets its stable id even when newer entries precede it', () => {
  const before = fresh(), after = structuredClone(before); after.days[DATE].food.push(food('added'));
  const current = structuredClone(after); current.days[DATE].food.unshift(food('newer'));
  const undone = applyUndoPatch(current,createUndoPatch(before,after));
  assert.deepEqual(undone.days[DATE].food.map(f=>f.id),['newer','food-1']);
  validateLifeHealth(undone);
});

test('undo refuses an inserted record that has since changed', () => {
  const before = fresh(), after = structuredClone(before); after.days[DATE].food.push(food('added'));
  const current = structuredClone(after); current.days[DATE].food.find(f=>f.id==='added').kcal = 900;
  const snapshot = structuredClone(current);
  assert.throws(()=>applyUndoPatch(current,createUndoPatch(before,after)), error => {
    assert.match(error.message,/Undo unavailable: This entry changed after your save.*Nothing was overwritten/);
    assert.equal(error.path,`days.${DATE}.food.[added]`);
    assert.doesNotMatch(error.message,/days\.|\[added\]/);
    return true;
  });
  assert.deepEqual(current,snapshot);
});

test('undo preflights every target and rejects a conflicting correction atomically', () => {
  const before = fresh(), after = structuredClone(before); after.days[DATE].food[0].kcal = 150; after.days[DATE].weightKg = 70;
  const current = structuredClone(after); current.days[DATE].food[0].kcal = 200;
  const snapshot = structuredClone(current);
  assert.throws(()=>applyUndoPatch(current,createUndoPatch(before,after)),/Undo unavailable/);
  assert.deepEqual(current,snapshot);
});

test('undo of a deletion restores the original position while retaining later new entries', () => {
  const before = fresh(); before.days[DATE].food.push(food('second'),food('third'));
  const after = structuredClone(before); after.days[DATE].food.splice(1,1);
  const current = structuredClone(after); current.days[DATE].food.unshift(food('newer'));
  const undone = applyUndoPatch(current,createUndoPatch(before,after));
  assert.deepEqual(undone.days[DATE].food.map(f=>f.id),['newer','food-1','second','third']);
  const reused = structuredClone(current); reused.days[DATE].food.push(food('second',{kcal:999}));
  assert.throws(()=>applyUndoPatch(reused,createUndoPatch(before,after)),/Undo unavailable/);
});

test('undo safely removes a newly created empty date, but preserves later independent measurements and workouts', () => {
  const before = fresh(), after = structuredClone(before); after.days[LATER] = day({food:[food('first-on-date')]});
  const patch = createUndoPatch(before,after), clean = applyUndoPatch(after,patch);
  assert.deepEqual(clean,before);
  const current = structuredClone(after); current.days[LATER].weightKg = 72;
  current.days[LATER].workouts.push({id:'newer-workout',sessionId:null,name:'Walk',status:'completed',durationMin:20});
  const undone = applyUndoPatch(current,patch);
  assert.deepEqual(undone.days[LATER].food,[]);
  assert.equal(undone.days[LATER].weightKg,72);
  assert.equal(undone.days[LATER].workouts[0].id,'newer-workout');
  validateLifeHealth(undone);
});

test('undo of newly added settings preserves newer preferences in the same section', () => {
  const before = fresh(), after = structuredClone(before); after.tracker = {food:{proteinFocus:true,library:[]}};
  const current = structuredClone(after); current.tracker.food.dayTypes = {[DATE]:'training'}; current.tracker.body = {pinned:['waist']};
  const undone = applyUndoPatch(current,createUndoPatch(before,after));
  assert.deepEqual(undone.tracker,{food:{dayTypes:{[DATE]:'training'}},body:{pinned:['waist']}});
  validateLifeHealth(undone);
});

test('undo restores optional null containers and preserves independent later children', () => {
  const before = fresh(); before.tracker = null; before.days[DATE].body = null;
  const after = structuredClone(before); after.tracker = {food:{proteinFocus:true}}; after.days[DATE].body = {bodyFatPct:15};
  assert.deepEqual(applyUndoPatch(after,createUndoPatch(before,after)),before);
  const current = structuredClone(after); current.tracker.body = {pinned:['waist']}; current.days[DATE].body.measurementsCm = {waist:80};
  const undone = applyUndoPatch(current,createUndoPatch(before,after));
  assert.deepEqual(undone.tracker,{body:{pinned:['waist']}});
  assert.deepEqual(undone.days[DATE].body,{measurementsCm:{waist:80}});
  validateLifeHealth(undone);
});

test('keyed record reorders can be reversed while keeping unrelated newer ids', () => {
  const before = fresh(); before.days[DATE].food.push(food('second'),food('third'));
  const after = structuredClone(before); after.days[DATE].food.reverse();
  const current = structuredClone(after); current.days[DATE].food.splice(1,0,food('newer'));
  const undone = applyUndoPatch(current,createUndoPatch(before,after));
  assert.deepEqual(undone.days[DATE].food.map(f=>f.id),['food-1','newer','second','third']);
  const changedOrder = structuredClone(after); [changedOrder.days[DATE].food[0],changedOrder.days[DATE].food[1]] = [changedOrder.days[DATE].food[1],changedOrder.days[DATE].food[0]];
  assert.throws(()=>applyUndoPatch(changedOrder,createUndoPatch(before,after)),/Undo unavailable/);
});

test('patches are serializable; timestamp-only saves have nothing to undo', () => {
  const before = fresh(), after = structuredClone(before); after.updatedAt = '2026-10-16T10:00:00Z';
  const patch = createUndoPatch(before,after);
  assert.equal(patch.changes.length,0);
  assert.deepEqual(applyUndoPatch(after,JSON.parse(JSON.stringify(patch))),after);
  after.days[DATE].food[0].kcal = 120;
  assert.equal(applyUndoPatch(after,JSON.parse(JSON.stringify(createUndoPatch(before,after)))).days[DATE].food[0].kcal,100);
});

test('set corrections address exercise names and set ids without replacing other recorded performance', () => {
  const before = allFeatures(), exercises = before.days[DATE].workouts[0].actualExercises;
  exercises.push({name:'Dumbbell row',sets:1,reps:10,load:15,setLog:[{id:'row-set',kind:'working',reps:10,load:15,rir:null,rpe:null,completedAt:NOW}]});
  const after = structuredClone(before);
  after.days[DATE].workouts[0].actualExercises[0].setLog[1].load = 12;
  const current = structuredClone(after);
  current.days[DATE].workouts[0].actualExercises[1].setLog[0].reps = 12;
  current.days[DATE].workouts[0].actualExercises.reverse();
  const undone = applyUndoPatch(current,createUndoPatch(before,after));
  const result = undone.days[DATE].workouts[0].actualExercises;
  assert.equal(result.find(e=>e.name==='Goblet squat').setLog[1].load,10);
  assert.equal(result.find(e=>e.name==='Dumbbell row').setLog[0].reps,12);
  assert.equal(result[0].name,'Dumbbell row');
  validateLifeHealth(undone);
});

test('unsafe or whole-root undo paths are rejected', () => {
  const empty = {version:1,containers:[],cleanup:[]};
  for (const path of [[],['__proto__','polluted'],['updatedAt']]) {
    assert.throws(()=>applyUndoPatch(fresh(),{...empty,changes:[{type:'value',path,before:{exists:false},after:{exists:false}}]}));
  }
  assert.equal({}.polluted,undefined);
});
