import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLifeHealth, healthInsights, prepareHealthProposal, healthActionSchema, healthSystemPrompt, parseLocalCheckIn} from '../dist/health-intelligence.js';

const DATE = '2026-10-05';
const NOW = new Date('2026-10-05T12:00:00Z');
const options = {now:NOW,idFactory:(type,index) => `${type}-fixture-${index}`};
const day = values => ({food:[],workouts:[],steps:null,waterMl:null,weightKg:null,notes:'preserve me',...values});
const fresh = () => ({schemaVersion:1,updatedAt:'2026-10-01T12:00:00Z',profile:{name:'Fixture',timezone:'Europe/Amsterdam',targets:{kcal:1900,protein:150,carbs:210,fat:50,steps:10000},trainingStatus:'awaiting clearance',trainingNote:'Retain the recorded restriction'},training:{rotation:['a','rest'],sessions:[{id:'a',name:'Session A',exercises:[]},{id:'rest',name:'Rest',exercises:[]}]},recipes:{existing:{name:'Existing recipe'}},days:{[DATE]:day(), '2026-09-01':day({weightKg:70,notes:'Historic actual reading'})}});

test('legacy schema validates without wellbeing or skeletal muscle and is not mutated', () => {
  const data = fresh(), snapshot = structuredClone(data);
  assert.equal(validateLifeHealth(data), data);
  assert.deepEqual(data, snapshot);
});

test('new optional fields retain unknown null values', () => {
  const data = fresh();
  data.days[DATE].wellbeing = {mood:null,energy:null,sleepHours:null,feelings:null};
  data.days[DATE].body = {skeletalMuscleKg:null,bodyFatPct:null,method:'Not specified'};
  assert.equal(validateLifeHealth(data), data);
});

test('wellbeing validates scores, types, sleep and bounded text', () => {
  for (const [key,value] of [['mood',0],['mood',6],['mood',2.5],['energy','4'],['energy',NaN],['sleepHours',-1],['sleepHours',25],['feelings',{}],['feelings','a'.repeat(2001)]]) {
    const data = fresh(); data.days[DATE].wellbeing = {[key]:value};
    assert.throws(() => validateLifeHealth(data), /2026-10-05/);
  }
  const data = fresh(); data.days[DATE].wellbeing = [];
  assert.throws(() => validateLifeHealth(data), /wellbeing must be an object/);
});

test('skeletal muscle is distinct from fat-free mass and has sanity bounds', () => {
  for (const value of [0,-1,301,Infinity,'30']) {
    const data = fresh(); data.days[DATE].body = {skeletalMuscleKg:value};
    assert.throws(() => validateLifeHealth(data), /skeletal muscle/);
  }
  const data = fresh(); data.days[DATE] = day({weightKg:65,body:{skeletalMuscleKg:66}});
  assert.throws(() => validateLifeHealth(data), /cannot exceed/);
  data.days[DATE].body.skeletalMuscleKg = 30;
  assert.equal(validateLifeHealth(data), data);
});

test('proposals add only supplied facts, preserve history and do not mutate input', () => {
  const data = fresh(), snapshot = structuredClone(data);
  const proposal = prepareHealthProposal(data, DATE, [
    {type:'add_food',name:'Labelled yoghurt',quantity:'200 g',kcal:140,protein:20},
    {type:'set_metrics',steps:4200,weightKg:65.5},
    {type:'set_body',bodyFatPct:12.5,skeletalMuscleKg:29.6,method:'BIA watch'},
    {type:'set_wellbeing',mood:4,energy:3,sleepHours:7.5,feelings:'A little tired'}
  ], options);
  assert.deepEqual(data,snapshot);
  assert.deepEqual(proposal.candidate.days['2026-09-01'],snapshot.days['2026-09-01']);
  assert.deepEqual(proposal.candidate.profile,snapshot.profile);
  assert.deepEqual(proposal.candidate.training,snapshot.training);
  assert.deepEqual(proposal.candidate.recipes,snapshot.recipes);
  assert.equal(proposal.candidate.days[DATE].waterMl,null);
  assert.equal(proposal.candidate.days[DATE].food[0].carbs,null);
  assert.equal(proposal.candidate.days[DATE].food[0].fat,null);
  assert.equal(proposal.candidate.days[DATE].body.recordedAt,NOW.toISOString());
  assert.ok(proposal.changes.every(change => !change.path.includes('recordedAt')));
  assert.equal(proposal.candidate.updatedAt,data.updatedAt);
});

test('a new date creates an actual logged day and applies without baseline mismatch', () => {
  const data = fresh(), newDate = '2026-10-06';
  const proposal = prepareHealthProposal(data,newDate,[{type:'set_metrics',steps:8000},{type:'set_wellbeing',mood:4}],options);
  const current = structuredClone(data);
  proposal.apply(current);
  assert.equal(current.days[newDate].steps,8000);
  assert.equal(current.days[newDate].wellbeing.mood,4);
  assert.deepEqual(current,proposal.candidate);
  assert.equal(current.days[newDate].weightKg,null);
});

test('empty proposals do not create a date or imply a logged zero', () => {
  const data = fresh(), proposal = prepareHealthProposal(data,'2026-10-06',[],options);
  assert.deepEqual(proposal.candidate,data);
  assert.equal(proposal.changes.length,0);
  assert.equal(proposal.apply(data),data);
  assert.equal(data.days['2026-10-06'],undefined);
});

test('daily totals replace values and do not increment previous steps or water', () => {
  const data = fresh(); data.days[DATE].steps = 5000; data.days[DATE].waterMl = 1200;
  const proposal = prepareHealthProposal(data,DATE,[{type:'set_metrics',steps:8000,waterMl:1600}],options);
  assert.equal(proposal.candidate.days[DATE].steps,8000);
  assert.equal(proposal.candidate.days[DATE].waterMl,1600);
});

test('body updates preserve unrelated circumferences and exact device method', () => {
  const data = fresh(); data.days[DATE].body = {method:'BIA watch',bodyFatPct:13,measurementsCm:{waist:78,upperArmLeft:30},notes:'old note'};
  const proposal = prepareHealthProposal(data,DATE,[{type:'set_body',skeletalMuscleKg:30,measurementsCm:{waist:77}}],options);
  assert.equal(proposal.candidate.days[DATE].body.method,'BIA watch');
  assert.equal(proposal.candidate.days[DATE].body.measurementsCm.upperArmLeft,30);
  assert.equal(proposal.candidate.days[DATE].body.measurementsCm.waist,77);
  assert.equal(proposal.candidate.days[DATE].body.notes,'old note');
});

test('unsupported action types, fields and imprecise composition methods are rejected', () => {
  for (const action of [
    {type:'delete_day'}, {type:'set_profile',kcal:1200}, {type:'set_metrics',weightKg:65,body:{method:'BIA watch'}},
    {type:'set_body',method:'Galaxy watch'}, {type:'set_body',weightKg:65}, {type:'set_body',measurementsCm:{arm:30}},
    {type:'set_wellbeing',mood:4,diagnosis:'anything'}, {type:'set_metrics'}
  ]) assert.throws(() => prepareHealthProposal(fresh(),DATE,[action],options));
});

test('numeric actions reject strings, negative metrics, impossible values and fractional steps', () => {
  for (const action of [
    {type:'set_metrics',steps:'10000'}, {type:'set_metrics',steps:1.5}, {type:'set_metrics',waterMl:-5},
    {type:'set_metrics',weightKg:0}, {type:'set_metrics',waterMl:20001}, {type:'set_body',bodyFatPct:100},
    {type:'set_body',measurementsCm:{waist:0}}, {type:'set_wellbeing',energy:6}, {type:'add_food',name:'Meal',kcal:Infinity}
  ]) assert.throws(() => prepareHealthProposal(fresh(),DATE,[action],options));
});

test('date validation rejects rollover, timestamps and malformed dates', () => {
  for (const date of ['2026-02-30','2026-13-01','2026-10-05T12:00:00Z','bad']) {
    assert.throws(() => prepareHealthProposal(fresh(),date,[],options),/valid health date/);
    assert.throws(() => healthInsights(fresh(),date),/valid health date/);
  }
});

test('estimated food requires an explicit source and assumptions', () => {
  assert.throws(() => prepareHealthProposal(fresh(),DATE,[{type:'add_food',name:'Meal',kcal:400,estimated:true}],options),/source and a note/);
  const proposal = prepareHealthProposal(fresh(),DATE,[{type:'add_food',name:'Meal',kcal:400,estimated:true,source:'User supplied estimate',note:'User estimated one serving; macros unknown.'}],options);
  assert.equal(proposal.candidate.days[DATE].food[0].protein,null);
  assert.equal(proposal.candidate.days[DATE].food[0].estimated,true);
});

test('new food does not infer calories from supplied macros', () => {
  const proposal = prepareHealthProposal(fresh(),DATE,[{type:'add_food',name:'Label missing energy',protein:25,carbs:10,fat:5}],options);
  assert.equal(proposal.candidate.days[DATE].food[0].kcal,null);
  const insight = healthInsights(proposal.candidate,DATE);
  assert.equal(insight.nutrition.kcal,0);
  assert.equal(insight.goals.kcal.incomplete,true);
  assert.equal(insight.goals.kcal.missing,1);
});

test('food and workout IDs are stable per proposal and share the day namespace', () => {
  const data = fresh(), proposal = prepareHealthProposal(data,DATE,[{type:'add_food',name:'Meal'},{type:'add_workout',name:'Walk',status:'completed'}],options);
  const copy = structuredClone(data); proposal.apply(copy); proposal.apply(copy);
  assert.equal(copy.days[DATE].food.length,1);
  assert.equal(copy.days[DATE].workouts.length,1);
  assert.equal(copy.days[DATE].food[0].id,'add_food-fixture-0');
  assert.equal(copy.days[DATE].workouts[0].durationMin,null);
  assert.throws(() => prepareHealthProposal(data,DATE,[{type:'add_food',id:'same',name:'Meal'},{type:'add_workout',id:'same',name:'Walk',status:'completed'}],options),/already in use/);
});

test('unknown sessions and fabricated completion status are rejected', () => {
  assert.throws(() => prepareHealthProposal(fresh(),DATE,[{type:'add_workout',name:'Workout',sessionId:'missing',status:'completed'}],options),/Unknown workout session/);
  assert.throws(() => prepareHealthProposal(fresh(),DATE,[{type:'add_workout',name:'Workout',status:'planned'}],options),/status/);
});

test('stale metric conflicts reject the entire apply without a partial mutation', () => {
  const data = fresh(), proposal = prepareHealthProposal(data,DATE,[{type:'add_food',name:'Meal'},{type:'set_metrics',steps:8000,waterMl:1500}],options);
  const current = structuredClone(data); current.days[DATE].waterMl = 2000;
  const snapshot = structuredClone(current);
  assert.throws(() => proposal.apply(current),/changed elsewhere/);
  assert.deepEqual(current,snapshot);
});

test('disjoint concurrent edits and existing foods are preserved on apply', () => {
  const data = fresh(), proposal = prepareHealthProposal(data,DATE,[{type:'set_metrics',steps:8000},{type:'set_body',bodyFatPct:13,method:'BIA watch'}],options);
  const current = structuredClone(data);
  current.days[DATE].waterMl = 2000;
  current.days[DATE].body = {measurementsCm:{waist:78},recordedAt:'2026-10-05T11:00:00Z'};
  current.days['2026-09-01'].notes = 'Concurrent historical note';
  proposal.apply(current);
  assert.equal(current.days[DATE].waterMl,2000);
  assert.equal(current.days[DATE].body.measurementsCm.waist,78);
  assert.equal(current.days[DATE].body.recordedAt,NOW.toISOString());
  assert.equal(current.days['2026-09-01'].notes,'Concurrent historical note');
});

test('a concurrent entry ID collision is rejected without overwriting', () => {
  const data = fresh(), proposal = prepareHealthProposal(data,DATE,[{type:'add_food',id:'meal',name:'First meal'}],options);
  const current = prepareHealthProposal(data,DATE,[{type:'add_food',id:'meal',name:'Different meal'}],options).candidate;
  const snapshot = structuredClone(current);
  assert.throws(() => proposal.apply(current),/changed elsewhere/);
  assert.deepEqual(current,snapshot);
});

test('repeated field mutations coalesce and a return to baseline is a no-op', () => {
  const data = fresh(); data.days[DATE].steps = 5000;
  const proposal = prepareHealthProposal(data,DATE,[{type:'set_metrics',steps:8000},{type:'set_metrics',steps:5000}],options);
  assert.equal(proposal.changes.length,0);
  assert.deepEqual(proposal.candidate,data);
});

test('a same-value body action does not manufacture a fresh measurement timestamp', () => {
  const data = fresh(); data.days[DATE].body = {bodyFatPct:13,recordedAt:'2026-10-01T12:00:00Z'};
  const proposal = prepareHealthProposal(data,DATE,[{type:'set_body',bodyFatPct:13}],options);
  assert.equal(proposal.changes.length,0);
  assert.deepEqual(proposal.candidate,data);
});

test('empty food days remain unknown in target comparisons, not zero consumption', () => {
  const insight = healthInsights(fresh(),DATE);
  assert.equal(insight.goals.kcal.actual,null);
  assert.equal(insight.goals.kcal.remaining,null);
  assert.equal(insight.goals.kcal.incomplete,true);
  assert.equal(insight.goals.steps.actual,null);
  assert.equal(insight.weightTrend.projection,null);
});

test('known logged nutrition remains a subtotal until the day is explicitly complete', () => {
  const data = prepareHealthProposal(fresh(),DATE,[{type:'add_food',name:'Label',kcal:500,protein:30,carbs:40,fat:20}],options).candidate;
  let insight = healthInsights(data,DATE);
  assert.equal(insight.goals.kcal.actual,500);
  assert.equal(insight.goals.kcal.remaining,1400);
  assert.equal(insight.goals.kcal.incomplete,true);
  data.days[DATE].foodLogComplete = true;
  insight = healthInsights(data,DATE);
  assert.equal(insight.goals.kcal.incomplete,false);
  assert.equal(insight.goals.protein.incomplete,false);
});

test('fat-free mass is derived only from same-date readings and is not muscle mass', () => {
  const data = fresh(); data.days[DATE].weightKg = 80;
  data.days['2026-09-01'].body = {bodyFatPct:20};
  assert.equal(healthInsights(data,DATE).composition,null);
  data.days[DATE].body = {bodyFatPct:20,skeletalMuscleKg:30,method:'BIA watch'};
  const insight = healthInsights(data,DATE);
  assert.deepEqual(insight.composition,{fat:16,fatFree:64});
  assert.equal(insight.muscleTrend.latest.value,30);
});

test('projections require five distinct dates over at least seven days', () => {
  const data = fresh();
  for (const [date,weightKg] of [['2026-09-27',70],['2026-09-29',69.8],['2026-10-01',69.6],['2026-10-03',69.4]]) data.days[date] = day({weightKg});
  assert.equal(healthInsights(data,DATE).weightTrend.projection,null);
  data.days[DATE].weightKg = 69.2;
  const insight = healthInsights(data,DATE);
  assert.equal(insight.weightTrend.count,5);
  assert.equal(insight.weightTrend.enoughReadings,true);
  assert.equal(insight.weightTrend.perWeek,-0.7);
  assert.equal(insight.weightTrend.projection.date,'2026-10-19');
  assert.equal(insight.weightTrend.projection.value,67.8);
  assert.match(insight.weightTrend.projection.label,/not a prediction/);
  data.days[DATE].weightKg = null;
  data.days['2026-10-02'] = day({weightKg:69.5});
  assert.equal(healthInsights(data,DATE).weightTrend.projection,null);
});

test('stale readings and mixed composition methods do not get projections or connected trends', () => {
  const data = fresh();
  for (const [i,date] of ['2026-09-10','2026-09-12','2026-09-14','2026-09-16','2026-09-18'].entries()) data.days[date] = day({weightKg:70-i});
  assert.equal(healthInsights(data,DATE).weightTrend.projection,null);
  assert.equal(healthInsights(data,DATE).weightTrend.stale,true);
  for (const [i,date] of ['2026-09-27','2026-09-29','2026-10-01','2026-10-03','2026-10-05'].entries()) data.days[date] = day({body:{bodyFatPct:15-i,method:i%2?'DEXA':'BIA watch'}});
  const insight = healthInsights(data,DATE);
  assert.equal(insight.bodyFatTrend.sameMethod,false);
  assert.equal(insight.bodyFatTrend.change,null);
  assert.equal(insight.bodyFatTrend.perWeek,null);
  assert.ok(insight.insights.some(item => item.id === 'mixed-methods'));
});

test('weekly means use observations and do not fill missing days with zero', () => {
  const data = fresh(); data.days[DATE] = day({steps:8000,wellbeing:{sleepHours:8,mood:4}});
  data.days['2026-10-03'] = day({steps:10000,wellbeing:{sleepHours:6,mood:2}});
  const insight = healthInsights(data,DATE);
  assert.deepEqual(insight.week.steps,{value:9000,count:2});
  assert.deepEqual(insight.week.sleepHours,{value:7,count:2});
  assert.deepEqual(insight.week.mood,{value:3,count:2});
  assert.deepEqual(insight.week.energy,{value:null,count:0});
});

test('structured schema uses strict objects and per-field metric actions to prevent null placeholder overwrites', () => {
  assert.equal(healthActionSchema.additionalProperties,false);
  assert.deepEqual(healthActionSchema.required,['summary','actions','questions']);
  const actions = healthActionSchema.properties.actions.items.anyOf;
  const metrics = actions.filter(action => action.properties.type.enum[0] === 'set_metrics');
  assert.equal(metrics.length,3);
  for (const schema of metrics) {
    assert.equal(schema.additionalProperties,false);
    assert.equal(schema.required.length,2);
    assert.deepEqual(new Set(schema.required),new Set(Object.keys(schema.properties)));
  }
  assert.match(healthSystemPrompt,/Never infer body fat/);
  assert.match(healthSystemPrompt,/Null means the user explicitly/);
  assert.match(healthSystemPrompt,/Never claim an action has already been saved/);
});

test('local parser prepares explicit daily totals, readings and wellbeing with no API', () => {
  const parsed = parseLocalCheckIn('I weigh 65.5 kg. Steps: 10k. Water: 2 L. I slept 7.5 hours. Mood: 4/5. Energy: 3/5.');
  assert.equal(parsed.questions.length,0);
  const proposal = prepareHealthProposal(fresh(),DATE,parsed.actions,options);
  assert.equal(proposal.candidate.days[DATE].weightKg,65.5);
  assert.equal(proposal.candidate.days[DATE].steps,10000);
  assert.equal(proposal.candidate.days[DATE].waterMl,2000);
  assert.deepEqual(proposal.candidate.days[DATE].wellbeing,{sleepHours:7.5,mood:4,energy:3});
  assert.match(parsed.reply,/parsed locally/);
  assert.match(parsed.reply,/daily totals/);
});

test('local parser preserves decimal comma and explicitly converts pounds and litres', () => {
  const parsed = parseLocalCheckIn('Weight: 144 lb. Water: 1,5 L. Daily steps: 10,000.');
  const proposal = prepareHealthProposal(fresh(),DATE,parsed.actions,options);
  assert.ok(Math.abs(proposal.candidate.days[DATE].weightKg-65.3173)<0.0001);
  assert.equal(proposal.candidate.days[DATE].waterMl,1500);
  assert.equal(proposal.candidate.days[DATE].steps,10000);
});

test('local parser recognizes watch composition without labelling fat-free mass as muscle', () => {
  const parsed = parseLocalCheckIn('My watch says body fat 12.5% and skeletal muscle 29.6 kg.');
  const proposal = prepareHealthProposal(fresh(),DATE,parsed.actions,options);
  assert.equal(proposal.candidate.days[DATE].body.bodyFatPct,12.5);
  assert.equal(proposal.candidate.days[DATE].body.skeletalMuscleKg,29.6);
  assert.equal(proposal.candidate.days[DATE].body.method,'BIA watch');
  assert.equal(parseLocalCheckIn('My fat-free mass is 55 kg.').actions.length,0);
});

test('local parser logs explicit food label values and preserves unknown macros', () => {
  const parsed = parseLocalCheckIn('I ate chicken and rice, 350 kcal, protein 30g, carbs 40g, fat 8g.');
  assert.equal(parsed.actions.length,1);
  assert.deepEqual(Object.fromEntries(NUTRIENT_KEYS.map(key => [key,parsed.actions[0][key]])),{kcal:350,protein:30,carbs:40,fat:8});
  assert.equal(parsed.actions[0].name,'chicken and rice');
  const missing = parseLocalCheckIn('I ate 2 eggs.');
  assert.equal(missing.actions[0].kcal,null);
  assert.equal(missing.actions[0].protein,null);
  assert.ok(missing.questions.some(value => value.includes('incomplete')));
});
const NUTRIENT_KEYS = ['kcal','protein','carbs','fat'];

test('local parser handles nutrition before its label without overlapping adjacent nutrients', () => {
  const parsed = parseLocalCheckIn('I ate yoghurt 20g protein 10g carbs 3g fat.');
  assert.equal(parsed.actions[0].protein,20);
  assert.equal(parsed.actions[0].carbs,10);
  assert.equal(parsed.actions[0].fat,3);
  assert.equal(parsed.actions[0].kcal,null);
  assert.equal(parsed.questions.length,1);
});

test('local parser asks about incremental steps and water rather than replacing daily values', () => {
  const parsed = parseLocalCheckIn('I walked 5000 steps. I drank 500 ml. I weigh 65 kg.');
  assert.deepEqual(parsed.actions,[{type:'set_metrics',weightKg:65}]);
  assert.equal(parsed.questions.length,2);
});

test('local parser ignores examples, plans, questions, quoted text and code', () => {
  for (const text of ['For example I weigh 65 kg.','Tomorrow steps: 10000.','Should I weigh 65 kg?','"I weigh 65 kg"','```Weight: 65 kg```']) assert.equal(parseLocalCheckIn(text).actions.length,0);
  const mixed = parseLocalCheckIn('I weigh 65 kg. Should I drink 2 L?');
  assert.deepEqual(mixed.actions,[{type:'set_metrics',weightKg:65}]);
});

test('local parser keeps conflicting readings unknown and rejects out-of-range facts', () => {
  assert.equal(parseLocalCheckIn('I weigh 65 kg and weight 66 kg.').actions.length,0);
  assert.equal(parseLocalCheckIn('Weight: 900 kg.').actions.length,0);
  const parsed = parseLocalCheckIn('I ate rice -200 kcal, protein: 10g.');
  assert.equal(parsed.actions[0].kcal,null);
  assert.equal(parsed.actions[0].protein,10);
  assert.ok(parsed.questions.some(value => value.includes('outside')));
});

test('local parser records feelings without inventing a mood and discloses named-scale mapping', () => {
  const feelings = parseLocalCheckIn('I feel tired.');
  assert.deepEqual(feelings.actions,[{type:'set_wellbeing',feelings:'tired'}]);
  const named = parseLocalCheckIn('Mood: good.');
  assert.deepEqual(named.actions,[{type:'set_wellbeing',mood:4}]);
  assert.match(named.reply,/local 4\/5 scale/);
});

test('local parser labels only user-stated food estimates and does not invent missing nutrition', () => {
  const parsed = parseLocalCheckIn('I ate pasta, estimated 450 kcal.');
  assert.equal(parsed.actions[0].estimated,true);
  assert.equal(parsed.actions[0].kcal,450);
  assert.equal(parsed.actions[0].protein,null);
  assert.match(parsed.actions[0].note,/explicitly stated/);
  assert.doesNotThrow(() => prepareHealthProposal(fresh(),DATE,parsed.actions,options));
});

test('update_food edits the existing entry in place, flags estimates, and conflicts on stale edits', () => {
  const data = fresh();
  data.days[DATE].food = [{id:'food-a',name:'80g chicken breast, overcooked',quantity:'80 g',kcal:null,protein:null,carbs:null,fat:null,estimated:false,source:'Explicit check-in',note:''}];
  const action = {type:'update_food',id:'food-a',kcal:130,protein:26,carbs:0,fat:3,estimated:true,source:'Claude estimate from reference values',note:'Assumes 80 g cooked weight; overcooking lowers moisture, so values per 80 g are an approximation.'};
  const proposal = prepareHealthProposal(data, DATE, [action], options);
  assert.equal(proposal.changes.length, 1);
  assert.equal(proposal.candidate.days[DATE].food.length, 1);
  assert.equal(proposal.candidate.days[DATE].food[0].kcal, 130);
  assert.equal(data.days[DATE].food[0].kcal, null, 'input is not mutated');
  const applied = proposal.apply(structuredClone(data));
  assert.equal(applied.days[DATE].food.length, 1);
  assert.doesNotThrow(() => proposal.apply(structuredClone(proposal.candidate)), 'repeat apply is a no-op');
  const stale = structuredClone(data); stale.days[DATE].food[0].kcal = 99;
  assert.throws(() => proposal.apply(stale), /changed elsewhere/);
  assert.throws(() => prepareHealthProposal(data, DATE, [{...action,id:'missing'}], options), /no food entry/);
  assert.throws(() => prepareHealthProposal(data, DATE, [{...action,note:''}], options), /source and a note/);
});
