import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrackerShell,normalizeShellPreferences,serializeDraftFields,restoreDraftFields,cleanRoute,SHELL_STORAGE_KEY,DRAFT_STORAGE_KEY} from '../dist/tracker-shell.js';

function storageFixture(seed={}){const values=new Map(Object.entries(seed));return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
function field(name,value='',type='text',extra={}){return {name,value,type,...extra};}
function formFixture(elements){const listeners=new Map();return {id:'food-form',elements,dataset:{},addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type),querySelector:()=>null,querySelectorAll:()=>[],change:target=>listeners.get('input')?.({target}),ownerDocument:null};}

test('appearance normalizes damaged data while retaining exactly three unique trackers',()=>{
  assert.deepEqual(normalizeShellPreferences({order:['body','body','inbox','food'],sizes:{food:'huge',body:'large'},density:'dense',palette:'__proto__',clarity:999,haptics:false}),{order:['body','food','workouts'],sizes:{food:'standard',body:'large',workouts:'standard'},density:'detailed',palette:'opal',clarity:100,haptics:false});
  assert.equal(normalizeShellPreferences(null).clarity,35);
});
test('malformed local storage and blocked storage never prevent opening preferences',()=>{
  const storage=storageFixture({[SHELL_STORAGE_KEY]:'not json',[DRAFT_STORAGE_KEY]:'{"wrong":true}'}),shell=createTrackerShell({storage});
  assert.equal(shell.getPreferences().palette,'opal');assert.deepEqual(shell.getDrafts(),[]);
  const blocked=createTrackerShell({storage:{getItem(){throw Error('Denied');},setItem(){throw Error('Quota');}}});
  blocked.setPreferences({palette:'ice',clarity:80});assert.equal(blocked.getPreferences().palette,'ice');assert.match(blocked.preferencesView(),/Glass clarity/);
  blocked.dispose();shell.dispose();
});
test('draft serialization excludes all credentials and files while retaining safe fields of the same form',()=>{
  const form=formFixture([field('name','Lunch'),field('githubToken','github_pat_abcdefghijklmnopqrst'),field('password','private','password'),field('apiKey','value'),field('attachment','photo','file'),field('notes','ghp_abcdefghijklmnopqrst'),field('quantity','200 g'),field('reviewRequired','on','checkbox',{checked:true})]);
  const snapshot=serializeDraftFields(form);assert.deepEqual(snapshot.map(f=>f.name),['name','quantity','reviewRequired']);assert.equal(snapshot.at(-1).checked,true);assert.doesNotMatch(JSON.stringify(snapshot),/github_pat_|ghp_/);
});
test('ordered repeated fields and checkbox or multiple selections restore without shifting exercise rows',()=>{
  const source=formFixture([field('exerciseName','Row'),field('exerciseSets','3','number'),field('exerciseName','Curl'),field('exerciseSets','2','number'),field('estimated','on','checkbox',{checked:true}),field('equipment','','select-multiple',{selectedOptions:[{value:'barbell'},{value:'bench'}]})]);
  const target=formFixture([field('exerciseName'),field('exerciseSets','','number'),field('exerciseName'),field('exerciseSets','','number'),field('estimated','on','checkbox',{checked:false}),field('equipment','','select-multiple',{options:[{value:'barbell',selected:false},{value:'dumbbells',selected:true},{value:'bench',selected:false}]})]);
  assert.equal(restoreDraftFields(target,serializeDraftFields(source),{dispatch:false}),6);assert.deepEqual(target.elements.slice(0,4).map(f=>f.value),['Row','3','Curl','2']);assert.equal(target.elements[4].checked,true);assert.deepEqual(target.elements[5].options.map(f=>f.selected),[true,false,true]);
});
test('restoration refuses credentials even in a manually tampered stored draft',()=>{
  const form=formFixture([field('githubToken'),field('name')]);
  const count=restoreDraftFields(form,[{name:'githubToken',index:0,type:'text',value:'hello'},{name:'name',index:0,type:'text',value:'github_pat_abcdefghijklmnopqrst'}]);
  assert.equal(count,0);assert.ok(form.elements.every(f=>f.value===''));
});
test('unfinished values survive a new shell instance and are never applied automatically',async()=>{
  const storage=storageFixture(),food=field('name',''),quantity=field('quantity',''),form=formFixture([food,quantity,field('githubToken','','password')]);
  const shell=createTrackerShell({storage}),cleanup=shell.trackDraft(form,{key:'food:2026-10-15:new',title:'Log food',date:'2026-10-15',route:{kind:'food',date:'2026-10-15'}});
  food.value='Greek yoghurt';quantity.value='180 g';form.change(food);shell.flushDrafts();cleanup();shell.dispose();
  const reopened=createTrackerShell({storage}),fresh=formFixture([field('name'),field('quantity'),field('githubToken','','password')]);
  assert.equal(reopened.getDrafts().length,1);reopened.trackDraft(fresh,{key:'food:2026-10-15:new'});assert.equal(fresh.elements[0].value,'');
  assert.equal(await reopened.hydrateDraft(fresh,'food:2026-10-15:new'),2);assert.equal(fresh.elements[0].value,'Greek yoghurt');assert.equal(fresh.elements[2].value,'');reopened.dispose();
});
test('successful save clears a draft and cleanup cannot recreate it',()=>{
  const storage=storageFixture(),value=field('name',''),form=formFixture([value]),shell=createTrackerShell({storage});
  const cleanup=shell.trackDraft(form,{key:'food:new',date:'2026-10-15'});value.value='Oats';form.change(value);shell.flushDrafts();assert.equal(shell.getDrafts().length,1);
  shell.clearDraft('food:new');cleanup();shell.flushDrafts();assert.deepEqual(shell.getDrafts(),[]);assert.equal(JSON.parse(storage.values.get(DRAFT_STORAGE_KEY)).length,0);shell.dispose();
});
test('entering an inline GitHub token never writes or removes an awaiting draft',()=>{
  const key='food:2026-10-15:new',storage=storageFixture({[DRAFT_STORAGE_KEY]:JSON.stringify([{key,title:'Log food',date:'2026-10-15',fields:[{name:'name',index:0,type:'text',value:'Saved oats'}],updatedAt:1}])}),shell=createTrackerShell({storage});
  const token=field('githubToken','','password'),form=formFixture([field('name'),token]);const cleanup=shell.trackDraft(form,{key});token.value='github_pat_abcdefghijklmnopqrst';form.change(token);shell.flushDrafts();cleanup();assert.equal(shell.getDrafts()[0].fields[0].value,'Saved oats');assert.doesNotMatch(storage.values.get(DRAFT_STORAGE_KEY),/github_pat_/);shell.dispose();
});
test('local route metadata cannot persist credential-looking fields or values',()=>{
  const storage=storageFixture(),value=field('name',''),form=formFixture([value]),shell=createTrackerShell({storage}),cleanup=shell.trackDraft(form,{key:'food:new',route:{kind:'food',id:'abc',token:'private',notes:'Bearer abcdefghijklmnopqrst'}});
  value.value='Rice';form.change(value);shell.flushDrafts();assert.deepEqual(shell.getDrafts()[0].route,{kind:'food',id:'abc'});cleanup();shell.dispose();
});
test('reading memory is local, bounded and rejects sensitive names or values',()=>{
  const storage=storageFixture(),shell=createTrackerShell({storage});shell.remember('body:range',90);shell.remember('githubToken','private');shell.remember('auth',{token:'abc'});shell.remember('notes','ghp_abcdefghijklmnopqrst');
  assert.equal(shell.recall('body:range'),90);assert.equal(shell.recall('githubToken'),null);assert.equal(shell.recall('auth'),null);assert.equal(shell.recall('notes'),null);shell.dispose();
});
test('haptics run only for an actual hold callback and follow the local preference',()=>{
  const pulses=[],shell=createTrackerShell({storage:storageFixture(),document:{hidden:false},window:{navigator:{vibrate:n=>pulses.push(n)}}});
  shell.pulseHold();shell.setPreferences({haptics:false});shell.pulseHold();assert.deepEqual(pulses,[8]);shell.dispose();
});
test('nested food routes retain snapshots, recipe ingredients, nulls and units after reload',()=>{
  const storage=storageFixture(),value=field('name',''),form=formFixture([value]),shell=createTrackerShell({storage});
  const route={module:'food',mode:'recipe',date:'2026-10-15',units:'imperial',id:null,baseline:{id:'recipe-123',name:'Lunch',total:{kcal:750,protein:null}},ingredients:[{id:'first',name:'Rice',grams:100,kcal:130},{id:'second',name:'Beans',grams:150,kcal:null}],food:{id:'off-123',name:'A packaged food',servingSize:35,nutrition:{kcal:400}},bundle:{foods:[{name:'Rice',amount:150}]},record:{date:'2026-10-14',food:{id:'past-record',quantity:'One serving'}}};
  const cleanup=shell.trackDraft(form,{key:'food:recipe:new',route});value.value='Lunch';form.change(value);shell.flushDrafts();cleanup();shell.dispose();
  const reloaded=createTrackerShell({storage});assert.deepEqual(reloaded.getDrafts()[0].route,route);reloaded.dispose();
});
test('live getRoute captures ingredient rows added after mounting and preserves its original key',()=>{
  const storage=storageFixture(),value=field('name',''),form=formFixture([value]),shell=createTrackerShell({storage});
  let current={module:'food',mode:'recipe',ingredients:[{name:'First'}],units:'metric'};
  const cleanup=shell.trackDraft(form,{key:'stable-original-key',route:current,getRoute:()=>current});value.value='Recipe';form.change(value);current={...current,ingredients:[...current.ingredients,{name:'Second',grams:75}]};cleanup();
  assert.equal(shell.getDrafts()[0].key,'stable-original-key');assert.equal(shell.getDrafts()[0].route.ingredients.length,2);assert.equal(shell.getDrafts()[0].route.ingredients[1].grams,75);shell.dispose();
});
test('nested route sanitization excludes credential values, prototype objects, files and cycles',()=>{
  const cycle={name:'Cycle'};cycle.self=cycle;
  const route={module:'food',food:{name:'Oats',notes:'A plain note',password:'private',meta:{accessToken:'nope',safe:'yes',nestedSecret:'nope',value:'github_pat_abcdefghijklmnopqrst'}},image:new Blob(['photo']),object:new Date(),instance:new (class Foo{constructor(){this.safe='no';}})(),cycle,list:[{apiKey:'nope',name:'Rice'}]};
  assert.deepEqual(cleanRoute(route),{module:'food',food:{name:'Oats',notes:'A plain note',meta:{safe:'yes'}},cycle:{name:'Cycle'},list:[{name:'Rice'}]});
  assert.deepEqual(cleanRoute(JSON.parse('{"module":"food","__proto__":{"polluted":true},"constructor":"no","prototype":"no"}')),{module:'food'});assert.equal({}.polluted,undefined);
});
test('route sanitization bounds untrusted routes and safely handles a throwing live snapshot',()=>{
  const huge={ingredients:Array.from({length:100},()=>({notes:'a'.repeat(12000)}))};assert.deepEqual(cleanRoute(huge),{});
  const storage=storageFixture(),value=field('name',''),form=formFixture([value]),shell=createTrackerShell({storage}),cleanup=shell.trackDraft(form,{key:'food:new',route:{module:'food',mode:'custom'},getRoute:()=>{throw Error('Form already detached');}});
  value.value='Dinner';form.change(value);cleanup();assert.deepEqual(shell.getDrafts()[0].route,{module:'food',mode:'custom'});shell.dispose();
});
test('unfinished entries can include the independently persisted live workout draft',()=>{
  const shell=createTrackerShell({storage:storageFixture(),extraDrafts:()=>'<button data-act="resume-workout">Resume your live workout</button>'});
  assert.match(shell.draftsView(),/data-act="resume-workout"/);assert.doesNotMatch(shell.draftsView(),/All caught up/);shell.dispose();
});
