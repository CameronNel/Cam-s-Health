import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FOOD_CATALOG} from '../dist/food-catalog.js';
import {parseFoodReport,searchFoods,portionNutrition,foodAction,foodById,parseAmount} from '../dist/food-lookup.js';
import {parseLocalCheckIn,prepareHealthProposal,validateLifeHealth} from '../dist/health-intelligence.js';
const data=JSON.parse(readFileSync(new URL('../dist/data/health.json',import.meta.url)));
test('USDA reference preserves unknown nutrients and sane edible household weights',()=>{
 assert.equal(FOOD_CATALOG.length,7793);assert.equal(new Set(FOOD_CATALOG.map(r=>r[0])).size,7793);
 for(const row of FOOD_CATALOG){for(const n of row.slice(2,6))assert.ok(n===null||Number.isFinite(n)&&n>=0);for(const [count,label,grams] of row[6])assert.ok(count>0&&grams>0&&label);}
});
test('a meal splits into foods and scales sourced cooked chicken and rice',()=>{
 const items=parseFoodReport('I ate 200 g chicken breast and 150 g cooked rice',data);assert.equal(items.length,2);
 assert.deepEqual(portionNutrition(items[0],data).nutrients,{kcal:330,protein:62.04,carbs:0,fat:7.14});
 assert.deepEqual(portionNutrition(items[1],data).nutrients,{kcal:195,protein:4.04,carbs:42.26,fat:.42});
 assert.match(foodAction(items[0],data).source,/USDA.*05064/);assert.match(foodAction(items[0],data).note,/Oil|oil/);assert.equal(foodAction(items[0],data).estimated,true);
});
test('raw and cooked weights use different records and never silently share nutrition',()=>{
 const raw=foodAction(parseFoodReport('I ate 200g raw chicken breast',data)[0],data),cooked=foodAction(parseFoodReport('I ate 200g cooked chicken breast',data)[0],data);
 assert.equal(raw.kcal,240);assert.equal(cooked.kcal,330);assert.notEqual(raw.source,cooked.source);
 assert.equal(foodAction(parseFoodReport('I ate 100 g dry rice',data)[0],data).kcal,365);
});
test('cooking descriptions retain the report and use a disclosed cooked reference estimate',()=>{
 const item=parseFoodReport('I ate 80g of chicken breast left extremely long in the oven',data)[0];
 assert.equal(item.foodId,'05064');assert.equal(foodAction(item,data).kcal,132);assert.match(foodAction(item,data).note,/extremely long/);assert.match(foodAction(item,data).note,/changes moisture/);
 assert.equal(parseFoodReport('I ate 80g dried out chicken breast',data)[0].foodId,'05064');
});
test('a named food shows per-100g values but does not invent the portion',()=>{
 const item=parseFoodReport('chicken breast',data)[0];assert.equal(item.amount,null);assert.equal(portionNutrition(item,data).nutrients,null);assert.equal(foodById(item.foodId,data).per100g.kcal,165);assert.throws(()=>foodAction(item,data),/portion/);
 const one=parseFoodReport('I ate one chicken breast',data)[0];assert.equal(one.amount,null);assert.equal(one.needsWeight,true);
});
test('explicit counts, tablespoons, fractions and weight units have visible measured bases',()=>{
 const bananas=portionNutrition(parseFoodReport('I ate 2 bananas',data)[0],data);assert.equal(bananas.grams,236);assert.match(bananas.quantity,/medium.*236 g/);
 assert.equal(portionNutrition(parseFoodReport('I ate 1 tbsp olive oil',data)[0],data).grams,13.5);
 assert.equal(portionNutrition(parseFoodReport('I ate half a cup rice',data)[0],data).grams,79);
 assert.equal(portionNutrition(parseFoodReport('I ate 1/2 cup rice',data)[0],data).grams,79);
 assert.equal(portionNutrition(parseFoodReport('I ate 0.2kg cooked chicken breast',data)[0],data).grams,200);
 assert.equal(parseAmount('8 oz chicken breast').unit,'oz');
});
test('questions, examples, future plans and negated reports do not become meals',()=>{
 for(const message of ['Should I eat chicken breast?','Tomorrow I will eat chicken breast.','I did not eat chicken breast.','I haven’t eaten chicken breast.','"I ate 200 g chicken breast"','For example I ate chicken breast','I would eat 200g rice','hello'])assert.deepEqual(parseFoodReport(message,data),[],message);
});
test('unknown foods have no fabricated match or calories; choosing unknown keeps nulls',()=>{
 const item=parseFoodReport('I ate 200g Imaginary Brand Mystery Mix',data)[0];assert.equal(item.foodId,null);assert.throws(()=>foodAction(item,data),/matching food/);
 item.foodId='unknown:'+item.query;const action=foodAction(item,data);for(const k of ['kcal','protein','carbs','fat'])assert.equal(action[k],null);assert.equal(action.estimated,false);
});
test('invalid, zero, excessive and negative portions cannot be saved',()=>{
 for(const amount of [0,-200,Infinity,NaN,10001]){const item=parseFoodReport('I ate 200 g rice',data)[0];item.amount=amount;assert.throws(()=>foodAction(item,data),/portion/);}
});
test('saved recipe matches precede generic foods and use the saved recipe values',()=>{
 const fixture={...data,recipes:[{id:'test-rice',name:'My rice bowl',per100g:{kcal:200,protein:10,carbs:30,fat:5},note:'Includes sauce.'}]};
 assert.equal(searchFoods('My rice bowl',fixture)[0].id,'recipe:test-rice');
 const item=parseFoodReport('I ate 250g My rice bowl',fixture)[0];assert.equal(foodAction(item,fixture).kcal,500);assert.match(foodAction(item,fixture).note,/Includes sauce/);
});
test('explicit label nutrients remain authoritative rather than being replaced by a generic lookup',()=>{
 const report='I ate chicken breast 400 kcal, protein: 50g, carbs: 8g, fat: 20g';assert.deepEqual(parseFoodReport(report,data),[]);
 const result=parseLocalCheckIn(report);assert.equal(result.actions.find(a=>a.type==='add_food').kcal,400);
});
test('conflicting source calories/macros are retained and flagged for review',()=>{
 const proposal=prepareHealthProposal(data,'2026-10-05',[{type:'add_food',name:'Label conflict',kcal:400,protein:1,carbs:1,fat:1}]);
 const entry=proposal.candidate.days['2026-10-05'].food.at(-1);assert.equal(entry.kcal,400);assert.equal(entry.reviewRequired,true);
});
test('mixed food/body check-ins preserve all old records and are idempotent on retry',()=>{
 const input='I ate 200g cooked chicken breast and 150g cooked rice. I weigh 84kg. My watch says body fat: 21%.',original=structuredClone(data);
 const actions=parseFoodReport(input,data).map((item,i)=>({...foodAction(item,data),id:'isolated-meal-'+i}));actions.push(...parseLocalCheckIn(input).actions.filter(a=>a.type!=='add_food'));
 const proposal=prepareHealthProposal(data,'2026-10-05',actions);const current=structuredClone(data),before=current.days['2026-10-05'].food.length;
 proposal.apply(current);assert.equal(current.days['2026-10-05'].food.length,before+2);assert.equal(current.days['2026-10-05'].weightKg,84);assert.equal(current.days['2026-10-05'].body.bodyFatPct,21);
 proposal.apply(current);assert.equal(current.days['2026-10-05'].food.length,before+2);assert.deepEqual(data,original);assert.deepEqual(current.days['2026-10-04'],data.days['2026-10-04']);validateLifeHealth(current);
});
