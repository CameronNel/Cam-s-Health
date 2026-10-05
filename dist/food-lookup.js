import {FOOD_CATALOG} from './food-catalog.js';

export const NUTRIENTS=['kcal','protein','carbs','fat'];
const byId=new Map(FOOD_CATALOG.map(row=>[row[0],row]));
const norm=s=>String(s||'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const singular=s=>s.replace(/\b(bananas|apples|eggs|breasts|potatoes|tomatoes|almonds|carrots|slices)\b/g,w=>({potatoes:'potato',tomatoes:'tomato',slices:'slice'}[w]||w.slice(0,-1)));
const groups=[
 ['chicken breast|kipfilet',['05064','05062','05065','05063']],
 ['rice|white rice|rijst',['20045','20044']],
 ['banana|banaan',['09040']],['apple|appel',['09003']],
 ['egg|whole egg|ei',['01129','01123']],['boiled egg|hard boiled egg',['01129']],
 ['olive oil|olijfolie',['04053']],['coconut oil',['04047']],
 ['oats|oatmeal|porridge|havermout',['08120','08121']],
 ['broccoli',['11091','11090']],['potato|potatoes|aardappel',['11365','11352']],
 ['salmon|zalm',['15237','15236','15209','15076']],
 ['avocado',['09037']],['bread|white bread',['18069']],['whole wheat bread|wholemeal bread',['18075']],
 ['greek yogurt|greek yoghurt',['01256','01287','01293']],
 ['milk|2 percent milk|semi skimmed milk',['01079']],['peanut butter|pindakaas',['16098']],
 ['butter',['01001']],['almond|almonds',['12061']],['strawberries|strawberry',['09316']],
 ['orange',['09200']],['carrot|carrots',['11124']],['tomato|tomatoes',['11529']],
 ['cucumber',['11205']],['spinach',['11457']],['pasta|spaghetti',['20121','20120']]
];
const aliases=new Map(groups.flatMap(([names,ids])=>names.split('|').map(name=>[singular(name),ids.filter(id=>byId.has(id))])));
const genericSource='USDA SR Legacy (2018)';
function catalogFood(row){return {id:row[0],name:row[1],per100g:Object.fromEntries(NUTRIENTS.map((k,i)=>[k,row[i+2]])),
 portions:row[6].map(([amount,label,grams],i)=>({id:'p:'+i,label,grams:grams/amount})),
 source:genericSource+' · NDB '+row[0],url:'https://fdc.nal.usda.gov/food-search/?type=SR+Legacy&query='+row[0],estimated:true};}
function savedFoods(data){
 const result=[];
 for(const recipe of data?.recipes||[]){const per=recipe.per100g||recipe.per100Grams;if(!per||!NUTRIENTS.some(k=>Number.isFinite(per[k])))continue;
  result.push({id:'recipe:'+recipe.id,name:recipe.name,per100g:Object.fromEntries(NUTRIENTS.map(k=>[k,Number.isFinite(per[k])?per[k]:null])),portions:[],source:'Saved recipe: '+recipe.name,estimated:true,note:recipe.note||recipe.notes||''});}
 // Reuse only explicitly weighed saved portions; never infer a scoop or package size.
 const seen=new Set();
 for(const [date,day] of Object.entries(data?.days||{}).sort(([a],[b])=>b.localeCompare(a)))for(const f of day.food||[]){
  const amount=parseAmount(f.quantity);if(!amount||!['g','kg','oz','lb'].includes(amount.unit)||seen.has(norm(f.name))||!NUTRIENTS.some(k=>Number.isFinite(f[k])))continue;
  seen.add(norm(f.name));const grams=mass(amount.amount,amount.unit);if(!(grams>0))continue;
  result.push({id:'saved:'+date+':'+f.id,name:f.name,per100g:Object.fromEntries(NUTRIENTS.map(k=>[k,Number.isFinite(f[k])?f[k]*100/grams:null])),portions:[],source:'Saved food: '+date+' · '+(f.source||f.name),estimated:true,note:f.note||''});
 }
 return result;
}
export function foodById(id,data){
 if(String(id||'').startsWith('unknown:'))return {id,name:id.slice(8),per100g:Object.fromEntries(NUTRIENTS.map(k=>[k,null])),portions:[],source:'Explicit check-in; nutrition unknown',estimated:false};
 return byId.has(id)?catalogFood(byId.get(id)):savedFoods(data).find(f=>f.id===id)||null;
}
function coreQuery(query){return singular(norm(query)).replace(/\b(?:raw|uncooked|dry|cooked|baked|grilled|roasted|boiled|steamed|fried|fresh|skinless|boneless|medium|large|small|left|kept|extremely|long|too|very|well|done|overcooked|burnt|burned|dried|out|until|in|the|oven)\b/g,'').replace(/\s+/g,' ').trim();}
function preferred(ids,query){
 const q=norm(query),raw=/\b(raw|uncooked)\b/.test(q)||/\bdry\b/.test(q)&&ids.some(id=>['20044','08120','20120'].includes(id)),cooked=/\b(cooked|grilled|roasted|boiled|steamed|fried|baked|oven)\b/.test(q);
 if(!raw&&!cooked)return ids;
 const wanted=ids.filter(id=>{const n=norm(byId.get(id)[1]);return raw?/\b(raw|dry|fresh)\b/.test(n):/\b(cooked|roasted|boiled|stewed|fried)\b/.test(n);});
 if(/\bfried\b/.test(q))wanted.sort((a,b)=>Number(/fried/.test(byId.get(b)[1]))-Number(/fried/.test(byId.get(a)[1])));
 if(/\bboiled\b/.test(q))wanted.sort((a,b)=>Number(/boiled|stewed/.test(byId.get(b)[1]))-Number(/boiled|stewed/.test(byId.get(a)[1])));
 return [...wanted,...ids.filter(id=>!wanted.includes(id))];
}
export function searchFoods(query,data,{limit=8}={}){
 const q=singular(norm(query));if(q.length<2)return [];
 const tokens=q.split(' ').filter(t=>!['a','an','the','of','with','and'].includes(t));
 const saved=savedFoods(data).filter(f=>tokens.every(t=>singular(norm(f.name)).includes(t)));
 const ids=aliases.get(coreQuery(query));
 const common=ids?preferred(ids,query).map(id=>catalogFood(byId.get(id))):[];
 const others=common.length?[]:FOOD_CATALOG.filter(row=>tokens.every(t=>singular(norm(row[1])).split(' ').includes(t)))
  .sort((a,b)=>a[1].length-b[1].length).slice(0,limit).map(catalogFood);
 const all=[...saved,...common,...others];return all.filter((f,i)=>all.findIndex(v=>v.id===f.id)===i).slice(0,limit);
}
const number=String.raw`(?:-?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|a|an|one|two|three|four|five|six|half|quarter)`;
const words={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,half:.5,quarter:.25};
function value(s){s=s.toLowerCase().replace(',','.');if(s in words)return words[s];const p=s.split('/').map(Number);return p.length===2?p[0]/p[1]:Number(s);}
function unit(s){s=String(s||'').toLowerCase();return /^(grams?|g)$/.test(s)?'g':/^(kilograms?|kg)$/.test(s)?'kg':/^(ounces?|oz)$/.test(s)?'oz':/^(pounds?|lbs?)$/.test(s)?'lb':/^(tablespoons?|tbsp)$/.test(s)?'tbsp':/^(teaspoons?|tsp)$/.test(s)?'tsp':/^(cups?)$/.test(s)?'cup':/^(slices?)$/.test(s)?'slice':'count';}
export function parseAmount(text){
 const m=String(text||'').trim().match(new RegExp('^('+number+')\\s*(?:of\\s+(?:a|an)\\s+|(?:a|an)\\s+)?(kg|kilograms?|g|grams?|oz|ounces?|lbs?|pounds?|cups?|tbsp|tablespoons?|tsp|teaspoons?|slices?|pieces?)?\\b','i'));
 return m?{amount:value(m[1]),unit:unit(m[2]),text:m[0],rest:String(text).slice(m[0].length).trim()}:null;
}
function mass(amount,u){return amount*({g:1,kg:1000,oz:28.349523125,lb:453.59237}[u]||0);}
export function defaultUnit(food,requested='g',query=''){
 if(['g','kg','oz','lb'].includes(requested))return requested;
 const pattern=requested==='tbsp'?/^(?:tbsp|tablespoon)\b/:requested==='tsp'?/^(?:tsp|teaspoon)\b/:requested==='cup'?/^cup\b/:requested==='slice'?/^slice\b/:/^medium\b/;
 let portion=food?.portions.find(p=>pattern.test(p.label));
 if(requested==='count'){
  if(/\begg\b/i.test(food?.name||''))portion=food.portions.find(p=>/^large\b/.test(p.label));
  const size=norm(query).match(/\b(small|medium|large)\b/)?.[1];if(size)portion=food?.portions.find(p=>p.label.startsWith(size));
 }
 return portion?.id||null;
}
export function portionNutrition(item,data){
 const food=foodById(item.foodId,data);if(!food)return {food:null,grams:null,nutrients:null,error:'Choose a matching food.'};
 const amount=Number(item.amount);if(item.amount==null||item.amount===''||!Number.isFinite(amount)||amount<=0)return {food,grams:null,nutrients:null,error:'Enter a portion greater than zero.'};
 const portion=food.portions.find(p=>p.id===item.unit),grams=portion?amount*portion.grams:mass(amount,item.unit);
 if(!grams||grams>10000)return {food,grams:null,nutrients:null,error:'Enter a portion up to 10,000 g, using a listed unit.'};
 const nutrients=Object.fromEntries(NUTRIENTS.map(k=>[k,food.per100g[k]==null?null:Math.round(food.per100g[k]*grams)/100]));
 return {food,grams,nutrients,error:null,quantity:portion?`${amount} × ${portion.label} (${Math.round(grams*10)/10} g edible portion)`:`${amount} ${item.unit}`};
}
export function foodAction(item,data){
 const p=portionNutrition(item,data);if(p.error)throw Error(p.error);
 return {type:'add_food',name:p.food.name,quantity:p.quantity,...p.nutrients,estimated:p.food.estimated,source:p.food.source,
  note:p.food.estimated?[`Reported food: ${item.query}. Portion: ${Math.round(p.grams*10)/10} g edible food. Nutrition scaled from ${p.food.name} per 100 g; generic values are estimates.`,p.food.note,p.food.source.startsWith(genericSource)?'Added oil, sauces and other ingredients are excluded unless logged separately.':'',/overcooked|extremely long|dried|burnt|burned/i.test(item.query)?'Long cooking changes moisture and nutrient density; this is a reference estimate, not an exact analysis of this portion.':''].filter(Boolean).join(' ').slice(0,2000):'Nutrition was not found. Calories and macros remain unknown and are excluded from known totals.'};
}
function makeItem(segment,data){
 let part=segment.trim().replace(/[.!]+$/,'');let parsed=parseAmount(part),query=parsed?parsed.rest:part;
 if(!parsed){const m=part.match(new RegExp('\\s+('+number+')\\s*(kg|g|grams?|oz|lbs?|cups?|tbsp|tsp)\\s*$','i'));if(m){parsed=parseAmount(m[1]+' '+m[2]);query=part.slice(0,m.index);}}
 query=query.replace(/^(?:of\s+|some\s+|a portion of\s+)/i,'').trim();
 if(!query||query.length>300)return null;
 const choices=searchFoods(query,data),key=coreQuery(query),exact=choices.find(f=>norm(f.name.replace(/\s*[—–]\s*\d.*$/,''))===norm(query));
 const chosen=exact||((aliases.has(key)&&choices.find(f=>byId.has(f.id)))||null);
 const chosenUnit=chosen?defaultUnit(chosen,parsed?.unit||'g',query):parsed?.unit||'g';
 return {query,foodId:chosen?.id||null,amount:chosen&&!chosenUnit?null:parsed?.amount??null,unit:chosenUnit||'g',needsWeight:!!parsed&&!chosenUnit,choices};
}
/** Meal drafts only: quoted examples, plans, questions and negated reports never become food. */
export function parseFoodReport(input,data){
 if(typeof input!=='string'||input.length>10000)return [];
 const cleaned=input.replace(/```[\s\S]*?```/g,'').replace(/"[^"\n]*"/g,'').replace(/(?<=\d)\.(?=\d)/g,'§');
 const items=[];
 for(let clause of cleaned.match(/[^.!?\n]+(?:[.!?]|$)/g)||[]){
  clause=clause.replaceAll('§','.').trim();
  if(/\?$|\b(?:tomorrow|next week|planning|plan to|going to|want to|would|could|should|for example|hypothetical|what if|if i|didnt|didn't|did not|haven't|have not|not eaten|not ate)\b/i.test(clause))continue;
  const report=clause.match(/^(?:(?:today|for (?:breakfast|lunch|dinner))[, ]+)?(?:i\s+)?(?:ate|eaten|had|have eaten|just ate|just had|log(?:ged)?(?: food)?|food\s*:)\s+(.+)$/i);
  let segment=report?.[1]||clause.replace(/[.!]+$/,'');
  if(!report){const direct=makeItem(segment,data);if(direct&&(direct.foodId||direct.choices.length))items.push(direct);continue;}
  // Explicit labels remain the existing parser's responsibility.
  if(/\b(?:kcal|calories|protein|carbs|fat)\s*[:=]?\s*\d|\d\s*(?:kcal|calories|g\s*(?:protein|carbs|fat))\b/i.test(segment))continue;
  segment=segment.replace(/(?:[,;]|\s+and\s+)\s*(?:i\s+)?(?:weigh|weight|slept|feel|my watch|steps|water|body fat|muscle|mood|energy)\b.*/i,'');
  for(const part of segment.split(/\s+(?:and|with|plus)\s+|\s*\+\s*|[,;](?!\d)/i)){const item=makeItem(part,data);if(item)items.push(item);}
 }
 return items.slice(0,20);
}
