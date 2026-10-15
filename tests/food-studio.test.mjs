import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {foodSettings,targetsForDate,mealGroups,foodWeek,historyFoods,portion,entryFromPortion,snapshotFood,forkRecipeFood,scaleSnapshot,appendFoods,makeRecipeVersion,commitRecipeVersion,productFromOFF,normalizeBarcode,parseNutritionLabel,nutritionNeedsReview,saveFoodCollection} from '../dist/food-studio-model.js';
const fixture=async()=>JSON.parse(await readFile(new URL('../dist/data/health.json',import.meta.url)));
const food={id:'test-food',name:'Test food',per100g:{kcal:200,protein:20,carbs:10,fat:null},portions:[{id:'scoop',label:'scoop',grams:25}],densityGPerMl:.9,source:'Reviewed test label',estimated:false};
test('food portions require explicit mass for volumes and household measures',()=>{
 assert.equal(portion(food,2,'scoop').grams,50);
 assert.equal(portion(food,100,'ml').grams,90);
 assert.throws(()=>portion({...food,densityGPerMl:null},100,'ml'),/density/);
 assert.throws(()=>portion(food,1,'serving'),/weight/);
 assert.throws(()=>portion(food,1,'household'),/grams/);
 assert.equal(portion(food,2,'serving',{servingGrams:30}).nutrients.protein,12);
 assert.equal(portion(food,1,'household',{householdGrams:15}).grams,15);
 assert.equal(portion(food,1,'scoop').nutrients.fat,null);
 assert.throws(()=>portion(food,10001,'g'),/10,000/);
});
test('portion entries keep provenance and immutable recipe version identity',()=>{
 const e=entryFromPortion({...food,recipeId:'recipe-a',recipeVersionId:'version-1',reviewRequired:true},2,'scoop',{id:'new-id',meal:'lunch'});
 assert.equal(e.id,'new-id');assert.equal(e.kcal,100);assert.equal(e.fat,null);assert.equal(e.meal,'lunch');assert.equal(e.recipeId,'recipe-a');assert.equal(e.recipeVersionId,'version-1');assert.match(e.note,/50 g/);assert.equal(e.nutritionConfirmed,true);assert.equal(e.reviewRequired,true);
 const snapshot=snapshotFood(e);assert.equal(snapshot.id,undefined);assert.equal(snapshot.loggedAt,undefined);const scaled=scaleSnapshot(snapshot,.5,'scaled-id','dinner');assert.equal(scaled.kcal,50);assert.equal(scaled.fat,null);assert.equal(scaled.portionGrams,25);assert.equal(scaled.reviewRequired,true);assert.equal(e.kcal,100);
});
test('logging meal snapshots detects cross-kind ID collisions and resets completeness',async()=>{
 const d=await fixture(),date='2026-01-01';d.days[date]={food:[],workouts:[{id:'collision'}],foodLogComplete:true};
 assert.throws(()=>appendFoods(d,date,[{id:'collision'}]),/already exists/);assert.equal(d.days[date].food.length,0);
 appendFoods(d,date,[{id:'fresh',...snapshotFood(entryFromPortion(food,100,'g',{id:'old'}))}]);assert.equal(d.days[date].food.length,1);assert.equal(d.days[date].foodLogComplete,false);
});
test('target presets are explicit, default-compatible, and preserve unset targets',async()=>{
 const d=await fixture(),date='2026-01-01';assert.equal(targetsForDate(d,date).kcal,d.profile.targets.kcal);d.tracker={food:{targets:{training:{kcal:2500,protein:160,carbs:null,fat:70},rest:{kcal:2000}},dayTypes:{[date]:'training'}}};assert.equal(targetsForDate(d,date).kcal,2500);assert.equal(targetsForDate(d,date).carbs,null);assert.equal(targetsForDate(d,'2026-01-02').kcal,d.profile.targets.kcal);
});
test('week patterns distinguish unlogged, incomplete and fully known complete days',async()=>{
 const d=await fixture();d.days={};d.days['2026-01-02']={food:[{id:'a',name:'Apple',kcal:80,protein:0,carbs:20,fat:0}],workouts:[]};d.days['2026-01-03']={food:[{id:'b',name:'Unknown',kcal:80,protein:null,carbs:20,fat:0}],workouts:[],foodLogComplete:true};d.days['2026-01-04']={food:[{id:'c',name:'Complete',kcal:80,protein:0,carbs:20,fat:0,meal:'lunch'}],workouts:[],foodLogComplete:true};
 const week=foodWeek(d,'2026-01-07');assert.equal(week.length,7);assert.equal(week[0].label,'Not logged');assert.equal(week[1].label,'Incomplete');assert.equal(week[2].label,'Incomplete');assert.equal(week[3].label,'Complete');assert.equal(mealGroups(d.days['2026-01-04'])[0].meal,'lunch');assert.equal(historyFoods(d,'apple')[0].date,'2026-01-02');
});
test('recipe batch calculation does not disguise unknown ingredients as complete totals',()=>{
 const v=makeRecipeVersion({id:'v1',recipeId:'r1',name:'Dinner',yieldG:500,servings:2,ingredients:[{name:'A',grams:200,kcal:300,protein:30,carbs:20,fat:null},{name:'B',grams:100,kcal:100,protein:10,carbs:5,fat:2}]});assert.equal(v.total.kcal,400);assert.equal(v.per100g.protein,8);assert.equal(v.total.fat,null);assert.throws(()=>makeRecipeVersion({...v,yieldG:0}),/batch weight/);
});
test('recipe updates append immutable versions and preserve already logged nutrition',async()=>{
 const d=await fixture(),recipeId='recipe-test',base={id:'v1',recipeId,name:'Recipe',yieldG:100,servings:1,ingredients:[{name:'A',grams:100,kcal:100,protein:10,carbs:10,fat:0}]},v1=makeRecipeVersion(base);commitRecipeVersion(d,v1);const previous=structuredClone(d.recipes.find(r=>r.id===recipeId));d.days['2026-01-01']={food:[{id:'food-v1',recipeId,recipeVersionId:'v1',name:'Recipe',quantity:'100 g',kcal:100,protein:10,carbs:10,fat:0}],workouts:[]};const v2=makeRecipeVersion({...base,id:'v2',ingredients:[{name:'A',grams:100,kcal:200,protein:20,carbs:20,fat:0}]});commitRecipeVersion(d,v2,previous);assert.equal(foodSettings(d).recipeVersions.length,2);assert.equal(foodSettings(d).recipeVersions[0].per100g.kcal,100);assert.equal(d.days['2026-01-01'].food[0].kcal,100);assert.throws(()=>commitRecipeVersion(d,{...v2,id:'v3'},previous),/changed elsewhere/);
});
test('saved food collections preserve conflict detection',async()=>{const d=await fixture();saveFoodCollection(d,'favorites',[],undefined);assert.throws(()=>saveFoodCollection(d,'favorites',[{id:'x'}],undefined),/changed elsewhere/);});
test('editing a recipe-derived food forks its version provenance into an independent food',()=>{const original={...food,recipeId:'recipe-a',recipeVersionId:'version-a'},fork=forkRecipeFood(original,'new-custom-food');assert.equal(fork.id,'new-custom-food');assert.equal(Object.hasOwn(fork,'recipeId'),false);assert.equal(Object.hasOwn(fork,'recipeVersionId'),false);assert.match(fork.source,/Adapted from/);fork.per100g.kcal=999;assert.equal(original.per100g.kcal,200);assert.equal(original.recipeVersionId,'version-a');});
test('Open Food Facts products keep missing values unknown and show their source',()=>{
 const p=productFromOFF({status:1,product:{product_name:'Test product',brands:'Brand',nutriments:{'energy-kj_100g':418.4,proteins_100g:12,carbohydrates_100g:20,fat_100g:false},serving_size:'30 g'}},'12345678');assert.equal(p.per100g.kcal,100);assert.equal(p.per100g.fat,null);assert.equal(p.portions[0].grams,30);assert.match(p.source,/Open Food Facts/);assert.throws(()=>productFromOFF({status:0},'12345678'),/not found/);assert.equal(normalizeBarcode('1234 5678'),'12345678');assert.throws(()=>normalizeBarcode('12abc34'),/8–14/);
});
test('label extraction excludes saturated fat and leaves confirmation to the user',()=>{
 const parsed=parseNutritionLabel('Nutrition per 100 g\nEnergy 1300 kJ / 310 kcal\nFat 8,5 g\nof which saturates 2 g\nCarbohydrates 40 g\nof which sugars 5 g\nProtein 22 g');assert.deepEqual(parsed.per100g,{kcal:310,protein:22,carbs:40,fat:8.5});assert.equal(parsed.basisConfirmed,true);assert.equal(parseNutritionLabel('Per 100 ml\nFat 4 g').basisConfirmed,false);assert.equal(parseNutritionLabel('Fat8 g').per100g.fat,8);assert.equal(parseNutritionLabel('Serving\nProtein 3 g').basisConfirmed,false);assert.equal(nutritionNeedsReview({kcal:100,protein:null,carbs:20,fat:0}),true);
});
