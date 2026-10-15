import {searchFoods,foodById,NUTRIENTS} from './food-lookup.js';
import {shiftDate,totals} from './model.js';
import {ensureDay,assertUnchanged,validDate} from './body.js';

export {NUTRIENTS};
export const MEALS=['breakfast','lunch','dinner','snacks'];
const clone=v=>structuredClone(v);
const round=n=>Math.round(n*100)/100;
const number=(v,max=100000)=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=max?Number(v):null;
export function foodSettings(data){return data?.tracker?.food||{};}
export function ensureFoodSettings(data){data.tracker??={};return data.tracker.food??={};}
export function targetsForDate(data,date){const f=foodSettings(data),type=f.dayTypes?.[date];return {...data?.profile?.targets,...(type&&f.targets?.[type]?f.targets[type]:{})};}
export function targetDayType(data,date){return foodSettings(data).dayTypes?.[date]||null;}
export function mealGroups(day){return [...MEALS,'unassigned'].map(meal=>({meal,items:(day?.food||[]).filter(f=>(f.meal||'unassigned')===meal)})).filter(g=>g.items.length);}
export function foodWeek(data,end){return Array.from({length:7},(_,i)=>{const date=shiftDate(end,i-6),day=data.days?.[date],food=day?.food||[],t=totals(day),complete=day?.foodLogComplete===true;return {date,entries:food.length,complete,pending:t.pending,totals:t,targets:targetsForDate(data,date),dayType:targetDayType(data,date),label:!food.length?'Not logged':!complete||t.pending?'Incomplete':'Complete'};});}
export function historyFoods(data,query=''){const q=query.trim().toLocaleLowerCase();return Object.entries(data.days||{}).sort(([a],[b])=>b.localeCompare(a)).flatMap(([date,day])=>(day.food||[]).filter(f=>!q||[f.name,f.quantity,f.note,f.source].join(' ').toLocaleLowerCase().includes(q)).map(f=>({date,food:f})));}
export function libraryFood(data,id){return foodSettings(data).library?.find(f=>f.id===id)||foodById(id,data);}
export function searchLibrary(data,query,limit=12){const q=query.trim().toLocaleLowerCase(),saved=(foodSettings(data).library||[]).filter(f=>!q||f.name.toLocaleLowerCase().includes(q)),catalog=q.length>=2?searchFoods(query,data,{limit}):[];return [...saved,...catalog].filter((f,i,a)=>a.findIndex(v=>v.id===f.id)===i).slice(0,limit);}
export function portion(food,amount,unit,{densityGPerMl=food?.densityGPerMl,servingGrams=null,householdGrams=null}={}){
 const n=number(amount,100000);if(!(n>0))throw Error('Enter a portion greater than zero.');
 const selected=food?.portions?.find(p=>p.id===unit);let grams;
 if(unit==='g')grams=n;else if(unit==='kg')grams=n*1000;else if(unit==='oz')grams=n*28.349523125;else if(unit==='ml'){if(!(Number(densityGPerMl)>0))throw Error('Enter the product’s density in grams per millilitre; millilitres cannot be treated as grams automatically.');grams=n*Number(densityGPerMl);}
 else if(unit==='serving'){if(!(Number(servingGrams)>0))throw Error('Enter the weight of one serving in grams.');grams=n*Number(servingGrams);}
 else if(unit==='household'){if(!(Number(householdGrams)>0))throw Error('Enter the measured grams in one household measure.');grams=n*Number(householdGrams);}
 else if(selected?.grams>0)grams=n*selected.grams;else throw Error('Choose a portion unit with a known gram weight.');
 if(!(grams>0)||grams>10000)throw Error('Use a portion no greater than 10,000 g.');
 const nutrients=Object.fromEntries(NUTRIENTS.map(k=>[k,food?.per100g?.[k]==null?null:round(food.per100g[k]*grams/100)]));
 const label=selected?selected.label:unit==='household'?'household measure':unit;
 return {grams:round(grams),nutrients,quantity:`${n} ${label}${unit==='g'?'':` (${round(grams)} g)`}`};
}
export function entryFromPortion(food,amount,unit,{id,meal='snacks',...options}={}){const p=portion(food,amount,unit,options);return {id,name:food.name,quantity:p.quantity,...p.nutrients,meal,estimated:food.estimated!==false,source:food.source||'User-entered nutrition',note:[food.note,`Portion ${p.grams} g; scaled from the reviewed per-100 g nutrition.`,food.url].filter(Boolean).join(' ').slice(0,5000),nutritionConfirmed:true,...(food.reviewRequired!==undefined?{reviewRequired:food.reviewRequired}:{}),foodLibraryId:food.id,portionGrams:p.grams,...(food.recipeId?{recipeId:food.recipeId}:{}),...(food.recipeVersionId?{recipeVersionId:food.recipeVersionId}:{}),loggedAt:new Date().toISOString()};}
export function snapshotFood(food){const out={};for(const key of ['name','quantity',...NUTRIENTS,'estimated','source','note','portionGrams','recipeId','recipeVersionId','foodLibraryId','nutritionConfirmed','reviewRequired'])if(food[key]!==undefined)out[key]=clone(food[key]);return out;}
export function forkRecipeFood(food,id){
 if(typeof id!=='string'||!id.trim())throw Error('A new custom food ID is required.');
 const {recipeId,recipeVersionId,foodLibraryId,...copy}=clone(food);
 return {...copy,id,source:('Adapted from '+(food.source||'saved recipe '+recipeId)).slice(0,500),note:[food.note,'Custom library variant. Editing this food does not update the saved recipe or its immutable versions.'].filter(Boolean).join(' ').slice(0,5000)};
}
export function scaleSnapshot(food,multiplier,id,meal){const m=number(multiplier,100);if(!(m>0))throw Error('Enter a multiplier greater than zero and no more than 100.');const f={...snapshotFood(food),id,meal,quantity:m===1?food.quantity:`${m} × ${food.quantity}`,loggedAt:new Date().toISOString()};for(const key of NUTRIENTS)f[key]=food[key]==null?null:round(food[key]*m);if(food.portionGrams!=null)f.portionGrams=round(food.portionGrams*m);return f;}
export function appendFoods(data,date,entries){if(!validDate(date))throw Error('Choose a valid date.');const d=ensureDay(data,date),ids=new Set([...d.food,...d.workouts].map(f=>f.id));for(const f of entries){if(!f.id||ids.has(f.id))throw Error('This entry already exists. Refresh before trying again.');ids.add(f.id);}d.food.push(...clone(entries));d.foodLogComplete=false;}
export function saveFoodCollection(data,key,value,baseline){const s=ensureFoodSettings(data);assertUnchanged(s[key],baseline);s[key]=clone(value);}
export function makeRecipeVersion({id,recipeId,name,yieldG,servings,ingredients,createdAt=new Date().toISOString()}){
 if(!name?.trim())throw Error('Name this recipe.');const yieldN=number(yieldG,100000),servingsN=number(servings,10000);if(!(yieldN>0))throw Error('Enter the finished batch weight in grams.');if(!(servingsN>0))throw Error('Enter the number of servings.');if(!Array.isArray(ingredients)||!ingredients.length)throw Error('Add at least one ingredient.');
 for(const f of ingredients){if(!f.name?.trim()||!(number(f.grams,100000)>0))throw Error('Give every ingredient a name and gram weight.');for(const k of NUTRIENTS)if(f[k]!=null&&number(f[k])==null)throw Error('Ingredient nutrition must be a non-negative number or unknown.');}
 // An unknown ingredient makes that whole batch nutrient unknown, rather than hiding it in a partial subtotal.
 const total=Object.fromEntries(NUTRIENTS.map(k=>[k,ingredients.some(f=>f[k]==null)?null:round(ingredients.reduce((a,f)=>a+f[k],0))]));
 return {id,recipeId,name:name.trim(),yieldG:yieldN,servings:servingsN,ingredients:clone(ingredients),total,per100g:Object.fromEntries(NUTRIENTS.map(k=>[k,total[k]==null?null:round(total[k]*100/yieldN)])),createdAt};
}
export function commitRecipeVersion(data,version,baselineRecipe){data.recipes??=[];const i=data.recipes.findIndex(r=>r.id===version.recipeId);if(baselineRecipe){if(i<0)throw Error('This recipe was removed elsewhere.');assertUnchanged(data.recipes[i],baselineRecipe);}else if(i>=0)throw Error('A recipe with this ID already exists.');const f=ensureFoodSettings(data);f.recipeVersions??=[];if(f.recipeVersions.some(v=>v.id===version.id))throw Error('This recipe version already exists.');f.recipeVersions.push(clone(version));const recipe={...baselineRecipe,id:version.recipeId,name:version.name,yieldG:version.yieldG,servings:version.servings,total:clone(version.total),per100g:clone(version.per100g),ingredients:clone(version.ingredients),currentVersionId:version.id,notes:'Nutrition calculated from individually reviewed ingredient amounts. Unknown ingredients leave the corresponding batch nutrient unknown.'};if(i>=0)data.recipes[i]=recipe;else data.recipes.push(recipe);}
export function productFromOFF(response,barcode){const p=response?.product;if(response?.status!==1||!p)throw Error('This barcode was not found. Enter the label manually or try another code.');const n=p.nutriments||{},read=k=>number(n[k],30000);let kcal=read('energy-kcal_100g');if(kcal==null&&read('energy-kj_100g')!=null)kcal=round(read('energy-kj_100g')/4.184);const per100g={kcal,protein:read('proteins_100g'),carbs:read('carbohydrates_100g'),fat:read('fat_100g')};const serving=String(p.serving_size||'').match(/(\d+(?:[.,]\d+)?)\s*g\b/i);return {id:'barcode:'+barcode,name:[p.product_name||p.generic_name||'Product '+barcode,p.brands].filter(Boolean).join(' · ').slice(0,300),per100g,portions:serving?[{id:'label-serving',label:p.serving_size,grams:Number(serving[1].replace(',','.'))}]:[],densityGPerMl:null,source:'Open Food Facts · barcode '+barcode,url:'https://world.openfoodfacts.org/product/'+encodeURIComponent(barcode),barcode,estimated:false,note:'Community-maintained product data. Check every value against your package; blank values remain unknown.'};}
export function normalizeBarcode(value){const code=String(value||'').replace(/[\s-]/g,'');if(!/^\d{8,14}$/.test(code))throw Error('Enter an 8–14 digit product barcode.');return code;}
export function parseNutritionLabel(text){
 const clean=String(text||'').replace(/\r/g,'').replace(/(\d),(\d)/g,'$1.$2'),lines=clean.split('\n').map(s=>s.trim()).filter(Boolean),per100=/per\s*100\s*(?:g|ml)|(?:per|per\s+de)\s*100|100\s*g\s*(?:\/|per)/i.test(clean),out={kcal:null,protein:null,carbs:null,fat:null};
 const patterns={protein:/^(?:proteins?|eiwit(?:ten)?|prote[iï]ne?s?)(?=\s|[:\d]|$)/i,carbs:/^(?:carbohydrate?s?|koolhydraten|glucides)(?=\s|[:\d]|$)/i,fat:/^(?:total\s+)?(?:fat|vet(?:ten)?|mati[eè]res grasses)(?=\s|[:\d]|$)/i};
 for(const line of lines){const energy=line.match(/(\d+(?:\.\d+)?)\s*kcal\b/i);if(energy)out.kcal=number(energy[1],30000);for(const [k,re]of Object.entries(patterns)){if(!re.test(line))continue;const v=line.replace(re,'').match(/\b(\d+(?:\.\d+)?)\s*g?\b/i);if(v)out[k]=number(v[1],3000);}}
 return {per100g:out,basisConfirmed:per100&&!/per\s*100\s*ml/i.test(clean),rawText:clean.slice(0,10000)};
}
export function nutritionNeedsReview(f){return f.reviewRequired===true||NUTRIENTS.some(k=>f[k]==null);}
