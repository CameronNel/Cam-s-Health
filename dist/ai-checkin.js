import {validateLifeHealth, prepareHealthProposal} from './health-intelligence.js';
import {validDate, BODY_FIELDS} from './body.js';
import {dayFor, shiftDate, totals, nextSession} from './model.js';

export const AI_MODEL_SOURCE = 'Groq · GPT-OSS 120B model estimate';
const NUTRIENTS = ['kcal','protein','carbs','fat'];
const METRICS = ['steps','waterMl','weightKg'];
const BODY = ['bodyFatPct','skeletalMuscleKg','method','notes', ...BODY_FIELDS.map(([key]) => key)];
const WELLBEING = ['mood','energy','sleepHours','feelings'];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const clip = (value, max) => typeof value === 'string' ? value.slice(0,max) : '';
const number = value => Number.isFinite(value) ? value : null;
const fields = (value, keys) => Object.fromEntries(keys.filter(key => own(value || {},key)).map(key => [key, value[key]]));

function strict(value, allowed, required, label) {
  if (!record(value)) throw Error(`${label} must be an object.`);
  if (Object.keys(value).some(key => !allowed.includes(key))) throw Error(`Unsupported ${label} field.`);
  if (required.some(key => !own(value,key))) throw Error(`${label} is missing a required field.`);
}

function string(value, max, label, nullable = false) {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || value.length > max) throw Error(`${label} must be text of no more than ${max} characters.`);
}

function normalizeAction(action, {pending = false} = {}) {
  if (!record(action)) throw Error('AI actions must be objects.');
  let result;
  const allowId = pending && own(action,'id');
  if (['set_metrics','set_body','set_wellbeing'].includes(action.type)) {
    const allowed = action.type === 'set_metrics' ? METRICS : action.type === 'set_body' ? BODY : WELLBEING;
    if (own(action,'field') || own(action,'value')) {
      strict(action,['type','field','value'],['type','field','value'],'AI metric action');
      if (!allowed.includes(action.field)) throw Error('Unsupported AI metric field.');
      result = action.type === 'set_body' && !['bodyFatPct','skeletalMuscleKg','method','notes'].includes(action.field)
        ? {type:action.type,measurementsCm:{[action.field]:action.value}}
        : {type:action.type,[action.field]:action.value};
    } else {
      const internalAllowed = action.type === 'set_body' ? ['bodyFatPct','skeletalMuscleKg','method','notes','measurementsCm'] : allowed;
      strict(action,['type',...internalAllowed],['type'],'AI metric action');
      if (Object.keys(action).length !== 2) throw Error('Each AI metric action must contain exactly one reported field.');
      if (own(action,'measurementsCm')) {
        strict(action.measurementsCm,BODY_FIELDS.map(([key]) => key),[],'AI measurements');
        if (Object.keys(action.measurementsCm).length !== 1) throw Error('Each AI measurement action must contain exactly one reported field.');
      }
      result = structuredClone(action);
    }
  } else if (action.type === 'add_food') {
    const required = ['type','name','quantity','kcal','protein','carbs','fat','estimated','source','note'];
    strict(action,[...required,...(allowId ? ['id'] : [])],pending ? ['type','name'] : required,'AI food action');
    result = {type:'add_food',name:action.name,quantity:action.quantity ?? '',...Object.fromEntries(NUTRIENTS.map(key => [key,action[key] ?? null])),estimated:action.estimated ?? false,source:action.source ?? '',note:action.note ?? ''};
    string(result.name,300,'Food name');
    for (const key of ['quantity','source','note']) string(result[key],key === 'note' ? 2000 : 500,`Food ${key}`);
    if (!result.quantity.trim() && NUTRIENTS.some(key => result[key] !== null)) throw Error('Nutrition needs a reported portion. Ask for the amount instead of assuming 100 g.');
  } else if (action.type === 'add_workout') {
    const required = ['type','name','sessionId','status','durationMin','notes'];
    strict(action,[...required,...(allowId ? ['id'] : [])],pending ? ['type','name','status'] : required,'AI workout action');
    result = {type:'add_workout',name:action.name,sessionId:action.sessionId ?? null,status:action.status,durationMin:action.durationMin ?? null,notes:action.notes ?? ''};
    string(result.name,300,'Workout name');
    string(result.sessionId,200,'Workout session',true);
    string(result.notes,2000,'Workout notes');
  } else throw Error('Unsupported AI health action.');
  return result;
}

function validatePending(pendingActions, health, date) {
  if (!Array.isArray(pendingActions) || pendingActions.length > 10) throw Error('Keep a check-in to no more than 10 proposed changes.');
  const normalized = pendingActions.map(action => normalizeAction(action,{pending:true}));
  prepareHealthProposal(health,date,normalized,{idFactory:(type,index) => `ai-pending-validation-${type}-${index}`});
  return normalized;
}

function selectedDayContext(day) {
  return {
    food:day.food.slice(-10).map(food => ({id:clip(food.id,120),name:clip(food.name,150),quantity:clip(food.quantity,120),...Object.fromEntries(NUTRIENTS.map(key => [key,number(food[key])])),estimated:food.estimated === true,source:clip(food.source,180),note:clip(food.note,180)})),
    foodCount:day.food.length,foodLogComplete:day.foodLogComplete === true,
    workouts:day.workouts.slice(-5).map(workout => ({id:clip(workout.id,120),sessionId:workout.sessionId ?? null,name:clip(workout.name,150),status:workout.status,durationMin:number(workout.durationMin)})),
    ...Object.fromEntries(METRICS.map(key => [key,number(day[key])])),
    body:{...Object.fromEntries(['bodyFatPct','skeletalMuscleKg'].map(key => [key,number(day.body?.[key])])),method:clip(day.body?.method,40),measurementsCm:fields(day.body?.measurementsCm,BODY_FIELDS.map(([key]) => key))},
    wellbeing:{...Object.fromEntries(['mood','energy','sleepHours'].map(key => [key,number(day.wellbeing?.[key])])),feelings:clip(day.wellbeing?.feelings,180)},
    nutrition:day.food.length ? totals(day) : null
  };
}

function recipeContext(recipe, id) {
  const nutrients = value => value && record(value) ? Object.fromEntries(NUTRIENTS.map(key => [key,number(value[key])])) : null;
  return {id:clip(recipe.id || id,120),name:clip(recipe.name,150),yieldG:number(recipe.yieldG),total:nutrients(recipe.total),per100g:nutrients(recipe.per100g),estimated:recipe.estimated === true,source:clip(recipe.source,180),note:clip(recipe.notes || recipe.note,200)};
}

/** The only health context sent to the provider; full snapshots stay on our server. */
export function buildAIContext(health, date, {message = '',conversation = [],pendingActions = []} = {}) {
  if (JSON.stringify(health).length > 1048576) throw Error('The health snapshot is too large. Reload the latest app data.');
  validateLifeHealth(health);
  if (!validDate(date)) throw Error('Choose a valid check-in date.');
  string(message,3000,'Check-in');
  if (!Array.isArray(conversation) || conversation.length > 6) throw Error('Supply no more than six recent conversation messages.');
  let conversationSize = 0;
  const recentConversation = conversation.map(entry => {
    strict(entry,['role','content'],['role','content'],'Conversation message');
    if (!['user','assistant'].includes(entry.role)) throw Error('Unsupported conversation role.');
    string(entry.content,1200,'Conversation message');
    conversationSize += entry.content.length;
    return {role:entry.role,content:entry.content};
  });
  while (conversationSize > 1800 && recentConversation.length) conversationSize -= recentConversation.shift().content.length;
  const pending = validatePending(pendingActions,health,date);
  const start = shiftDate(date,-13);
  const recentDays = Object.entries(health.days).filter(([d]) => d >= start && d <= date).sort(([a],[b]) => a.localeCompare(b)).map(([d,day]) => ({date:d,nutrition:day.food.length ? totals(day) : null,foodLogComplete:day.foodLogComplete === true,steps:number(day.steps),waterMl:number(day.waterMl),weightKg:number(day.weightKg),bodyFatPct:number(day.body?.bodyFatPct),skeletalMuscleKg:number(day.body?.skeletalMuscleKg),method:clip(day.body?.method,40),...Object.fromEntries(['mood','energy','sleepHours'].map(key => [key,number(day.wellbeing?.[key])])),completedWorkouts:day.workouts.filter(workout => workout.status === 'completed').length}));
  const recipeEntries = Array.isArray(health.recipes) ? health.recipes.map((value,index) => [String(index),value]) : Object.entries(health.recipes || {});
  const matchedRecipes = recipeEntries.filter(([,recipe]) => record(recipe) && recipe.name && message.toLocaleLowerCase().includes(recipe.name.toLocaleLowerCase())).slice(0,3);
  const context = {
    selectedDate:date,message,conversation:recentConversation,pendingActions:pending,
    profile:{timezone:clip(health.profile.timezone,80),targets:fields(health.profile.targets,[...NUTRIENTS,'steps','waterMl']),trainingStatus:clip(health.profile.trainingStatus,60),trainingNote:clip(health.profile.trainingNote,350)},
    training:{rotation:health.training.rotation.slice(0,30),sessions:health.training.sessions.slice(0,30).map(session => ({id:clip(session.id,120),name:clip(session.name,150)})),nextSessionId:nextSession(health,date)?.id ?? null},
    selectedDay:selectedDayContext(dayFor(health,date)),recentDays,
    recipes:matchedRecipes.map(([id,recipe]) => recipeContext(recipe,id))
  };
  const size = () => JSON.stringify(context).length;
  while (size() > 6000 && context.recentDays.length) context.recentDays.shift();
  while (size() > 6000 && context.selectedDay.food.length) context.selectedDay.food.shift();
  while (size() > 6000 && context.conversation.length) context.conversation.shift();
  if (size() > 6000) throw Error('This draft is too large for a free-plan request. Split it into smaller check-ins.');
  return context;
}

const CLEAR_WORDS = /\b(?:clear|remove|unset|delete|unknown|not\s+(?:known|logged)|don['’]?t\s+know|do\s+not\s+know)\b/i;
const FIELD_WORDS = {steps:/\bstep(?:s)?\b/i,waterMl:/\b(?:water|hydration)\b/i,weightKg:/\b(?:weight|weigh)\b/i,bodyFatPct:/\b(?:body\s*fat|fat\s*percentage)\b/i,skeletalMuscleKg:/\b(?:muscle|skeletal)\b/i,method:/\b(?:method|device)\b/i,notes:/\b(?:body\s+note|measurement\s+note)\b/i,mood:/\bmood\b/i,energy:/\benergy\b/i,sleepHours:/\bsleep\b/i,feelings:/\b(?:feeling|feelings)\b/i};
const actionField = action => action.type === 'set_body' && action.measurementsCm ? Object.keys(action.measurementsCm)[0] : Object.keys(action).find(key => key !== 'type');
const fieldValue = action => action.measurementsCm ? action.measurementsCm[actionField(action)] : action[actionField(action)];
const nullValue = action => fieldValue(action) === null;
function explicitClear(action, message, pending) {
  const field = actionField(action);
  if (pending.some(previous => previous.type === action.type && actionField(previous) === field && (nullValue(previous) || (typeof fieldValue(previous) === 'string' && !fieldValue(previous).trim())))) return true;
  const pattern = FIELD_WORDS[field] || new RegExp(field.replace(/([a-z])([A-Z])/g,'$1\\s*$2'),'i');
  return message.split(/[.;\n]/).some(part => CLEAR_WORDS.test(part) && pattern.test(part));
}

function labelValues(action, reports) {
  const supplied = NUTRIENTS.filter(key => action[key] !== null);
  if (!supplied.length) return false;
  const names = {kcal:'(?:kcal|calories)',protein:'protein',carbs:'(?:carbs|carbohydrates)',fat:'fat'};
  return supplied.every(key => {
    const value = String(action[key]).replace('.','[.,]');
    const term = names[key];
    return new RegExp(`(?:\\b${value}\\s*(?:g\\s*)?${term}\\b|\\b${term}\\s*(?:[:=]|is)?\\s*${value}(?:\\s*g)?\\b)`,'i').test(reports);
  });
}

function recipeValues(action, health, reports) {
  const recipes = Array.isArray(health.recipes) ? health.recipes : Object.values(health.recipes || {});
  const amount = action.quantity.match(/^\s*(\d+(?:[.,]\d+)?)\s*g(?:rams?)?\b/i);
  if (!amount) return false;
  const grams = Number(amount[1].replace(',','.'));
  return recipes.some(recipe => {
    if (!record(recipe) || !recipe.name || recipe.estimated === true || recipe.per100g?.estimated === true || !reports.toLowerCase().includes(recipe.name.toLowerCase())) return false;
    return NUTRIENTS.filter(key => action[key] !== null).every(key => Number.isFinite(recipe.per100g?.[key]) && Math.abs(action[key] - recipe.per100g[key] * grams / 100) <= .11);
  });
}

function reportedPortion(action, reports, pending) {
  if (pending.some(previous => previous.type === 'add_food' && previous.name.toLowerCase() === action.name.toLowerCase() && previous.quantity.trim())) return true;
  reports = reports.replaceAll('½','0.5').replaceAll('¼','0.25').replaceAll('¾','0.75');
  // The food form reports its portion explicitly. Counted custom foods do not
  // need to occur in a food-name dictionary to qualify as a reported amount.
  if (/\bportion\s*:\s*(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\b/i.test(reports)) return true;
  const counts = /\b(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s+(?:(?:small|medium|large|whole|cooked|raw|chicken)\s+){0,3}(?:breasts?|pieces?|slices?|eggs?|bananas?|bowls?|cups?|tbsp|tsp|tablespoons?|teaspoons?|handfuls?|servings?|portions?|scoops?|fillets?|apples?|burgers?|sandwiches?|lattes?|coffees?|yoghurts?|yogurts?)\b/i;
  if (counts.test(reports) || /\b(?:ate|eaten|had|drank)\s+(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i.test(reports)) return true;
  const unitScale = unit => /^(?:kg|kilograms?)$/i.test(unit) ? 1000 : /^(?:l|litres?|liters?)$/i.test(unit) ? 1000 : /^(?:lb|lbs|pounds?)$/i.test(unit) ? 453.59237 : /^(?:oz|ounces?)$/i.test(unit) ? 28.349523125 : 1;
  const portions = text => [...text.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|g|grams?|ml|millilitres?|milliliters?|l|litres?|liters?|lb|lbs|pounds?|oz|ounces?)\b/gi)].map(match => Number(match[1].replace(',','.')) * unitScale(match[2]));
  const supplied = portions(reports), proposed = portions(action.quantity);
  return proposed.some(value => supplied.some(other => Math.abs(value-other) <= Math.max(.2,value*.001)));
}

/** Reject provider output before it can become an editable, persistent proposal. */
export function normalizeAIResponse(output, health, date, messageOrOptions = '') {
  validateLifeHealth(health);
  if (!validDate(date)) throw Error('Choose a valid check-in date.');
  const options = typeof messageOrOptions === 'string' ? {message:messageOrOptions} : messageOrOptions;
  const {message = '',conversation = [],pendingActions = []} = options || {};
  const pending = validatePending(pendingActions,health,date);
  strict(output,['summary','actions','questions'],['summary','actions','questions'],'AI response');
  string(output.summary,2000,'AI summary');
  if (!Array.isArray(output.actions) || output.actions.length > 10) throw Error('The AI response has too many proposed changes. Split your check-in.');
  if (!Array.isArray(output.questions) || output.questions.length > 5) throw Error('The AI response has too many questions.');
  for (const question of output.questions) string(question,500,'AI question');
  const reports = [...conversation.filter(entry => entry?.role === 'user').map(entry => clip(entry.content,1200)),message].join('\n');
  const actions = output.actions.map(action => normalizeAction(action));
  const targets = new Set(), entries = new Set();
  for (const action of actions) {
    if (action.type.startsWith('set_')) {
      const field = actionField(action), target = `${action.type}.${field}`;
      if (targets.has(target)) throw Error('The AI returned conflicting changes for the same field. Please clarify the intended value.');
      targets.add(target);
      const emptyText = typeof fieldValue(action) === 'string' && !fieldValue(action).trim();
      if ((nullValue(action) || emptyText) && !explicitClear(action,message,pending)) throw Error('The AI tried to clear a reading you did not ask to clear. Your existing data is unchanged.');
    } else {
      const signature = JSON.stringify(action);
      if (entries.has(signature)) throw Error('The AI returned a duplicate food or workout. Nothing has been saved.');
      entries.add(signature);
    }
    if (action.type === 'add_food' && NUTRIENTS.some(key => action[key] !== null)) {
      if (!reportedPortion(action,reports,pending)) throw Error('The AI assumed a food amount you did not report. Add the portion so it can estimate nutrition.');
      const fromLabel = labelValues(action,reports);
      const fromRecipe = recipeValues(action,health,reports);
      if (action.estimated === true || (!fromLabel && !fromRecipe)) {
        action.estimated = true;
        action.source = AI_MODEL_SOURCE;
        if (!action.note.trim()) throw Error('Model-estimated food needs a note describing the portion and preparation assumptions.');
      } else if (!action.estimated) action.source = fromRecipe ? 'Saved recipe values' : 'User-provided nutrition';
    }
  }
  const explicitRemoval = /\b(?:remove|delete|cancel|discard|forget|exclude)\b|\b(?:didn['’]?t|did\s+not)\s+(?:eat|have|do)\b/i.test(message);
  if (pending.length && !explicitRemoval) {
    for (const type of ['add_food','add_workout']) if (actions.filter(action => action.type === type).length < pending.filter(action => action.type === type).length) throw Error('The AI omitted an unsaved entry. Your current draft is still available; clarify the change or retry.');
    for (const previous of pending.filter(action => action.type.startsWith('set_'))) if (!targets.has(`${previous.type}.${actionField(previous)}`)) throw Error('The AI omitted an unsaved reading. Your current draft is still available; clarify the change or retry.');
  }
  prepareHealthProposal(health,date,actions,{idFactory:(type,index) => `ai-response-validation-${type}-${index}`});
  return {summary:output.summary.trim(),actions,questions:output.questions.map(question => question.trim()).filter(Boolean)};
}

export function parseAIResponse(content, health, date, options = '') {
  if (typeof content !== 'string' || content.length > 64000) throw Error('The AI returned an invalid or oversized response. Please retry.');
  let output;
  try {output = JSON.parse(content);} catch {throw Error('The AI returned an unreadable response. Please retry; nothing has been saved.');}
  return normalizeAIResponse(output,health,date,options);
}
