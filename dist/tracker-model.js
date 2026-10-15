// Optional tracker features extend schemaVersion 1. Reading them never fills in,
// migrates or overwrites the canonical health record.
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const clone = value => structuredClone(value);
const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat'];
const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];
const METRICS = ['weightKg','bodyFatPct','skeletalMuscleKg','neck','shoulders','chest','waist','hips','upperArmLeft','upperArmRight','forearmLeft','forearmRight','thighLeft','thighRight','calfLeft','calfRight'];
const EQUIPMENT = ['dumbbells','cable','bench','incline-bench','platform','pullup-bar','parallel-bars','pushup-handles','manual','sliders'];
const forbidden = key => ['__proto__', 'prototype', 'constructor'].includes(key);

function fail(name, message) { throw Error(`${name}: ${message}`); }
function object(value, name) { if (!record(value)) fail(name, 'must be an object.'); return value; }
function text(value, name, max = 500, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(name, `must be ${required ? 'non-empty ' : ''}text of no more than ${max} characters.`);
}
function number(value, name, max = 100000, min = 0, {nullable = true, integer = false, positive = false} = {}) {
  if (value === null && nullable) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || (positive && value === 0) || value > max || (integer && !Number.isInteger(value))) fail(name, `must be ${integer ? 'an integer' : 'a number'} ${positive ? 'greater than' : 'at least'} ${min} and no more than ${max}${nullable ? ', or null when unknown' : ''}.`);
}
function boolean(value, name) { if (typeof value !== 'boolean') fail(name, 'must be true or false.'); }
function oneOf(value, values, name) { if (!values.includes(value)) fail(name, `choose ${values.join(', ')}.`); }
function list(value, name, max) { if (!Array.isArray(value) || value.length > max) fail(name, `must be an array with no more than ${max} items.`); return value; }
function date(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(name, 'must be a valid date.');
  const d = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) fail(name, 'must be a valid date.');
}
function timestamp(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail(name, 'must be a valid ISO timestamp.');
  date(value.slice(0, 10), name);
}
function ids(items, name, max) {
  list(items, name, max); const seen = new Set();
  for (const [i, item] of items.entries()) {
    object(item, `${name}[${i}]`); text(item.id, `${name}[${i}] id`, 200, true);
    if (seen.has(item.id)) fail(name, `duplicate id ${item.id}.`);
    seen.add(item.id);
  }
  return items;
}
function nutrients(value, name) {
  object(value, name);
  for (const key of NUTRIENTS) if (own(value, key)) number(value[key], `${name} ${key}`);
}
function foodSnapshot(value, name) {
  object(value, name); text(value.name, `${name} name`, 300, true);
  for (const key of NUTRIENTS) if (own(value, key)) number(value[key], `${name} ${key}`);
  for (const key of ['quantity','source']) if (own(value, key) && value[key] !== null) text(value[key], `${name} ${key}`, 1000);
  if (own(value, 'note') && value.note !== null) text(value.note, `${name} note`, 10000);
  for (const key of ['estimated','nutritionConfirmed','reviewRequired']) if (own(value, key)) boolean(value[key], `${name} ${key}`);
  if (own(value, 'meal') && value.meal !== null) oneOf(value.meal, MEALS, `${name} meal`);
  if (own(value, 'portionGrams')) number(value.portionGrams, `${name} portion grams`, 100000, 0, {positive:true});
  for (const key of ['recipeId','recipeVersionId','foodLibraryId']) if (own(value, key) && value[key] !== null) text(value[key], `${name} ${key}`, 200, true);
}
function validateFood(value) {
  const name = 'Food settings'; object(value, name);
  if (own(value, 'library')) for (const item of ids(value.library, 'Food library', 2000)) {
    foodSnapshot(item, 'Food library entry'); nutrients(item.per100g, 'Food library per-100 g nutrition');
    if (own(item, 'densityGPerMl')) number(item.densityGPerMl, 'Food density', 100, 0, {positive:true});
    if (own(item, 'portions')) for (const p of ids(item.portions, 'Food portions', 100)) { text(p.label, 'Portion label', 200, true); number(p.grams, 'Portion grams', 100000, 0, {positive:true,nullable:false}); }
    if (own(item, 'url')) { text(item.url, 'Food source URL', 2000); if (!/^https?:\/\//.test(item.url)) fail('Food source URL', 'must use http or https.'); }
    if (own(item, 'barcode')) { text(item.barcode, 'Barcode', 14, true); if (!/^\d{8,14}$/.test(item.barcode)) fail('Barcode', 'must contain 8–14 digits.'); }
  }
  if (own(value, 'favorites')) for (const item of ids(value.favorites, 'Favourite foods', 2000)) {
    text(item.foodId, 'Favourite food id', 200, true); number(item.amount, 'Favourite portion', 100000, 0, {positive:true,nullable:false}); text(item.unit, 'Favourite unit', 200, true);
  }
  if (own(value, 'templates')) for (const item of ids(value.templates, 'Meal templates', 500)) {
    text(item.name, 'Meal template name', 300, true); oneOf(item.meal, MEALS, 'Meal template group');
    for (const food of list(item.items, 'Meal template foods', 200)) foodSnapshot(food, 'Meal template food');
    if (!item.items.length) fail('Meal template', 'add at least one food.');
  }
  if (own(value, 'recipeVersions')) for (const version of ids(value.recipeVersions, 'Recipe versions', 5000)) {
    text(version.recipeId, 'Recipe id', 200, true); text(version.name, 'Recipe name', 300, true);
    number(version.yieldG, 'Recipe batch grams', 100000, 0, {positive:true,nullable:false}); number(version.servings, 'Recipe servings', 10000, 0, {positive:true,nullable:false});
    timestamp(version.createdAt, 'Recipe version createdAt'); nutrients(version.total, 'Recipe batch nutrition'); nutrients(version.per100g, 'Recipe per-100 g nutrition');
    for (const ingredient of list(version.ingredients, 'Recipe ingredients', 200)) { foodSnapshot(ingredient, 'Recipe ingredient'); number(ingredient.grams, 'Ingredient grams', 100000, 0, {positive:true,nullable:false}); }
    if (!version.ingredients.length) fail('Recipe', 'add at least one ingredient.');
  }
  if (own(value, 'plannedMeals')) {
    object(value.plannedMeals, 'Planned meals');
    for (const [key, meals] of Object.entries(value.plannedMeals)) {
      date(key, 'Planned meal date');
      for (const meal of ids(meals, `${key} planned meals`, 100)) {
        text(meal.name, 'Planned meal name', 300, true); oneOf(meal.meal, MEALS, 'Planned meal group');
        for (const food of list(meal.items, 'Planned meal foods', 200)) foodSnapshot(food, 'Planned meal food');
        if (!meal.items.length) fail('Planned meal', 'add at least one food.');
      }
    }
  }
  if (own(value, 'targets')) { object(value.targets, 'Food target schedules'); for (const [type, target] of Object.entries(value.targets)) { oneOf(type, ['training','rest'], 'Food target day type'); nutrients(target, `${type} targets`); } }
  if (own(value, 'dayTypes')) { object(value.dayTypes, 'Food day types'); for (const [key, type] of Object.entries(value.dayTypes)) { date(key, 'Food day-type date'); oneOf(type, ['training','rest'], 'Food day type'); } }
  if (own(value, 'proteinFocus')) boolean(value.proteinFocus, 'Protein focus');
}
function validateBody(value) {
  object(value, 'Body settings');
  if (own(value, 'pinned')) { const items = list(value.pinned, 'Pinned body metrics', METRICS.length); if (new Set(items).size !== items.length) fail('Pinned body metrics', 'metrics must be unique.'); for (const item of items) oneOf(item, METRICS, 'Pinned body metric'); }
  if (own(value, 'goals')) {
    object(value.goals, 'Body goals');
    for (const [key, goal] of Object.entries(value.goals)) {
      oneOf(key, METRICS, 'Body goal metric'); object(goal, `${key} goal`);
      const max = key === 'weightKg' ? 500 : key === 'bodyFatPct' ? 99.9 : key === 'skeletalMuscleKg' ? 300 : 400;
      for (const edge of ['min','max']) if (own(goal, edge)) number(goal[edge], `${key} goal ${edge}`, max, 0, {positive:true});
      if (goal.min == null && goal.max == null) fail(`${key} goal`, 'enter at least one bound.');
      if (goal.min != null && goal.max != null && goal.min > goal.max) fail(`${key} goal`, 'minimum cannot exceed maximum.');
    }
  }
  if (own(value, 'annotations')) for (const item of ids(value.annotations, 'Body annotations', 1000)) { date(item.date, 'Annotation date'); text(item.text, 'Annotation text', 500, true); }
  if (own(value, 'reminder')) {
    const r = object(value.reminder, 'Body reminder');
    if (own(r, 'enabled')) boolean(r.enabled, 'Body reminder enabled');
    if (own(r, 'weekdays')) { const days = list(r.weekdays, 'Body reminder weekdays', 7); if (new Set(days).size !== days.length) fail('Body reminder weekdays', 'days must be unique.'); for (const n of days) number(n, 'Body reminder weekday', 6, 0, {nullable:false,integer:true}); }
    if (own(r, 'time') && (typeof r.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))) fail('Body reminder time', 'must use HH:MM.');
    if (own(r, 'timezone')) { text(r.timezone, 'Body reminder timezone', 100, true); try { new Intl.DateTimeFormat('en', {timeZone:r.timezone}); } catch { fail('Body reminder timezone', 'must be a recognised timezone.'); } }
  }
}
function validateWorkouts(value, data) {
  object(value, 'Workout settings');
  if (own(value, 'equipment')) { const items = list(value.equipment, 'Workout equipment', EQUIPMENT.length); if (new Set(items).size !== items.length) fail('Workout equipment', 'items must be unique.'); for (const item of items) oneOf(item, EQUIPMENT, 'Workout equipment'); }
  if (own(value, 'substitutions')) {
    object(value.substitutions, 'Exercise substitutions');
    for (const [sessionId, substitutions] of Object.entries(value.substitutions)) {
      const session = data.training.sessions.find(s => s.id === sessionId); if (!session) fail('Exercise substitutions', 'unknown training session.');
      object(substitutions, 'Session substitutions');
      for (const [original, replacement] of Object.entries(substitutions)) { if (!session.exercises.some(e => e.name === original)) fail('Exercise substitution', 'original exercise is not in this session.'); text(replacement, 'Replacement exercise', 300, true); }
    }
  }
  if (own(value, 'supersets')) {
    object(value.supersets, 'Supersets');
    for (const [sessionId, groups] of Object.entries(value.supersets)) {
      const session = data.training.sessions.find(s => s.id === sessionId); if (!session) fail('Superset', 'unknown training session.');
      const seen = new Set();
      for (const group of list(groups, 'Session superset groups', 100)) {
        list(group, 'Superset exercise group', 100); if (group.length < 2) fail('Superset', 'group at least two exercises.');
        for (const exercise of group) { if (seen.has(exercise) || !session.exercises.some(e => e.name === exercise)) fail('Superset', 'use unique exercises from this session.'); seen.add(exercise); }
      }
    }
  }
  if (own(value, 'progression')) {
    object(value.progression, 'Progression rules'); if (Object.keys(value.progression).length > 1000) fail('Progression rules', 'too many exercises.');
    for (const [name, rule] of Object.entries(value.progression)) {
      text(name, 'Progression exercise name', 300, true); object(rule, 'Progression rule');
      number(rule.sets, 'Progression sets', 100, 1, {integer:true,nullable:false}); number(rule.reps, 'Progression reps', 1000, 1, {integer:true,nullable:false});
      if (own(rule, 'load')) number(rule.load, 'Progression load', 1000);
      if (own(rule, 'rir')) number(rule.rir, 'Progression reps in reserve', 10);
    }
  }
}

export function trackerSettings(data, section) { return clone(data?.tracker?.[section] ?? {}); }

export function validateTrackerExtensions(data) {
  if (data.tracker != null) {
    object(data.tracker, 'Tracker settings');
    if (data.tracker.food != null) validateFood(data.tracker.food);
    if (data.tracker.body != null) validateBody(data.tracker.body);
    if (data.tracker.workouts != null) validateWorkouts(data.tracker.workouts, data);
  }
  for (const [day, value] of Object.entries(data.days || {})) {
    for (const food of value.food || []) {
      // Only validate extension keys here; older food fields retain their original contract.
      for (const key of ['meal','portionGrams','foodLibraryId','recipeVersionId','nutritionConfirmed']) if (own(food, key)) foodSnapshot({name:food.name,[key]:food[key]}, `${day} food ${food.id}`);
    }
    for (const workout of value.workouts || []) {
      const setIds = new Set();
      for (const exercise of workout.actualExercises || []) {
        if (own(exercise, 'originalName')) text(exercise.originalName, `${day} original exercise`, 300, true);
        if (own(exercise, 'measure')) oneOf(exercise.measure, ['reps','seconds'], `${day} exercise measure`);
        if (own(exercise, 'muscles')) { const muscles = list(exercise.muscles, `${day} muscle labels`, 30); if (new Set(muscles).size !== muscles.length) fail(`${day} muscle labels`, 'must be unique.'); for (const muscle of muscles) text(muscle, 'Muscle label', 100, true); }
        if (own(exercise, 'setLog')) for (const set of ids(exercise.setLog, `${day} exercise set log`, 100)) {
          if (setIds.has(set.id)) fail(`${day} workout set log`, 'set ids must be unique throughout the workout.'); setIds.add(set.id);
          oneOf(set.kind, ['warmup','working'], `${day} set kind`);
          for (const [key, max, min, integer] of [['reps',1000,1,true],['durationSec',3600,1,false],['load',1000,0,false],['rir',10,0,false],['rpe',10,1,false]]) if (own(set, key)) number(set[key], `${day} set ${key}`, max, min, {integer});
          if (exercise.measure === 'seconds' && set.reps != null) fail(`${day} timed set`, 'use durationSec rather than reps.');
          timestamp(set.completedAt, `${day} set completedAt`);
        }
      }
    }
  }
  return data;
}

// Undo patches address stable record ids, not mutable array offsets. This lets a
// saved change be reversed without replacing newer meals, dates or preferences.
const equal = (a, b) => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  return record(a) && record(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => own(b, k) && equal(a[k], b[k]));
};
const keyed = (value, key = 'id') => Array.isArray(value) && value.every(v => record(v) && typeof v[key] === 'string' && v[key].trim()) && new Set(value.map(v => v[key])).size === value.length;
const state = (exists, value) => exists ? {exists:true,value:clone(value)} : {exists:false};
const placeholder = value => value === null || value === '' || (Array.isArray(value) && value.length === 0);

export function createUndoPatch(before, after) {
  object(before, 'Undo baseline'); object(after, 'Undo result');
  const changes = [], containers = [], cleanup = [];
  function diff(leftExists, left, rightExists, right, path) {
    if (leftExists === rightExists && equal(left, right)) return;
    if (path.length === 1 && path[0] === 'updatedAt') return;
    if ((!leftExists || left === null) && record(right)) {
      containers.push({path:clone(path),type:'object',before:state(leftExists,left)});
      for (const [key, value] of Object.entries(right)) { if (forbidden(key)) fail('Undo patch', 'unsafe property name.'); diff(false, undefined, true, value, [...path,key]); }
      return;
    }
    if (leftExists && rightExists && record(left) && record(right)) {
      for (const key of new Set([...Object.keys(left),...Object.keys(right)])) { if (forbidden(key)) fail('Undo patch', 'unsafe property name.'); diff(own(left,key),left[key],own(right,key),right[key],[...path,key]); }
      return;
    }
    // Actual-exercise records predate stable per-set ids. Unique recorded names
    // identify those rows; ambiguous duplicate names remain an atomic array.
    const rowKey = path.at(-1) === 'actualExercises' && keyed(right,'name') && (!leftExists || left === null || keyed(left,'name')) ? 'name' : 'id';
    if (rightExists && keyed(right,rowKey) && (!leftExists || left === null || keyed(left,rowKey))) {
      if (!leftExists || left === null) containers.push({path:clone(path),type:'array',before:state(leftExists,left)});
      const old = leftExists && left !== null ? left : [], oldIds = old.map(v => v[rowKey]), newIds = right.map(v => v[rowKey]);
      for (const id of new Set([...oldIds,...newIds])) {
        const i = oldIds.indexOf(id), j = newIds.indexOf(id);
        const selector = {[rowKey]:id};
        if (i < 0 || j < 0) changes.push({type:'value',path:[...path,selector],before:state(i>=0,old[i]),after:state(j>=0,right[j]),position:i<0?null:{index:i,previous:oldIds[i-1]??null,next:oldIds[i+1]??null}});
        else diff(true,old[i],true,right[j],[...path,selector]);
      }
      const commonOld = oldIds.filter(id => newIds.includes(id)), commonNew = newIds.filter(id => oldIds.includes(id));
      if (!equal(commonOld, commonNew)) changes.push({type:'order',path:clone(path),key:rowKey,before:oldIds,after:newIds});
      return;
    }
    const change = {type:'value',path:clone(path),before:state(leftExists,left),after:state(rightExists,right)};
    // Fresh dates contain empty scaffolding. A later independent weigh-in should
    // survive undoing the food that originally caused this date to be created.
    if (!leftExists && rightExists && placeholder(right)) cleanup.push(change);
    else changes.push(change);
  }
  diff(true,before,true,after,[]);
  return {version:1,changes,containers,cleanup};
}

function location(root, path) {
  let parent = null, key = null, value = root, exists = true;
  for (const segment of path) {
    parent = value;
    if (typeof segment === 'string') {
      if (forbidden(segment)) fail('Undo patch', 'unsafe property name.');
      if (!record(parent)) return {exists:false,blocked:true};
      key = segment; exists = own(parent, key);
    } else if (record(segment) && Object.keys(segment).length === 1 && ['id','name'].includes(Object.keys(segment)[0]) && typeof Object.values(segment)[0] === 'string') {
      const field = Object.keys(segment)[0];
      if (!keyed(parent,field)) return {exists:false,blocked:true};
      key = parent.findIndex(item => item[field] === segment[field]); exists = key >= 0;
    } else fail('Undo patch', 'invalid record path.');
    value = exists ? parent[key] : undefined;
  }
  return {parent,key,value,exists,blocked:false};
}
function pathLabel(path) { return path.map(part => typeof part === 'string' ? part : `[${part.id ?? part.name}]`).join('.'); }
function conflict(path) { fail('Undo unavailable', `${pathLabel(path)} changed after your save. Nothing was overwritten.`); }
function matches(found, expected) { return !found.blocked && found.exists === expected.exists && (!expected.exists || equal(found.value, expected.value)); }
function restore(root, change) {
  const found = location(root, change.path);
  if (!found.parent) fail('Undo patch', 'cannot replace the entire health record.');
  if (Array.isArray(found.parent)) {
    if (!change.before.exists) { if (found.exists) found.parent.splice(found.key,1); }
    else if (found.exists) found.parent[found.key] = clone(change.before.value);
    else {
      const p = change.position || {}, field = Object.keys(change.path.at(-1))[0], next = p.next == null ? -1 : found.parent.findIndex(v => v[field] === p.next), previous = p.previous == null ? -1 : found.parent.findIndex(v => v[field] === p.previous);
      const index = next >= 0 ? next : previous >= 0 ? previous+1 : Math.min(p.index ?? found.parent.length, found.parent.length);
      found.parent.splice(index,0,clone(change.before.value));
    }
  } else if (change.before.exists) found.parent[found.key] = clone(change.before.value);
  else delete found.parent[found.key];
}

export function applyUndoPatch(current, patch) {
  object(current, 'Current health record');
  if (!record(patch) || patch.version !== 1 || !Array.isArray(patch.changes) || !Array.isArray(patch.containers) || !Array.isArray(patch.cleanup)) fail('Undo patch', 'unsupported patch.');
  // Preflight every affected value before applying anything, even to a clone.
  for (const change of patch.changes) {
    if (!Array.isArray(change.path) || !change.path.length || change.path[0] === 'updatedAt') fail('Undo patch', 'invalid target.');
    const found = location(current, change.path);
    if (change.type === 'order') {
      const key = change.key || 'id';
      if (!keyed(found.value,key) || !equal(found.value.map(v => v[key]).filter(id => change.after.includes(id)), change.after)) conflict(change.path);
    } else if (change.type !== 'value' || !record(change.before) || !record(change.after) || !matches(found, change.after)) conflict(change.path);
  }
  const result = clone(current);
  const newDates = new Set(patch.containers.filter(c => c.path.length === 2 && c.path[0] === 'days').map(c => c.path[1]));
  const dayScaffold = path => path.length === 3 && path[0] === 'days' && newDates.has(path[1]) && ['food','workouts','steps','waterMl','weightKg','notes'].includes(path[2]);
  for (const change of patch.changes.filter(c => c.type === 'value').reverse()) restore(result, change);
  for (const change of patch.changes.filter(c => c.type === 'order')) {
    const key = change.key || 'id', array = location(result,change.path).value, slots = array.map((v,i) => change.before.includes(v[key]) ? i : -1).filter(i => i>=0), ordered = change.before.map(id => array.find(v => v[key] === id)).filter(Boolean);
    slots.forEach((index,i) => { array[index] = ordered[i]; });
  }
  for (const change of patch.cleanup) if (!dayScaffold(change.path) && matches(location(result,change.path),change.after)) restore(result,change);
  for (const container of [...patch.containers].reverse()) {
    if (dayScaffold(container.path)) continue;
    const found = location(result,container.path);
    const emptyDay = container.path.length === 2 && container.path[0] === 'days' && record(found.value) && Object.entries(found.value).every(([key,value]) => ['food','workouts'].includes(key) ? Array.isArray(value) && value.length === 0 : ['steps','waterMl','weightKg','notes'].includes(key) && (value == null || value === ''));
    if (found.exists && (emptyDay || (container.type === 'array' ? Array.isArray(found.value) && found.value.length === 0 : record(found.value) && Object.keys(found.value).length === 0))) {
      if (container.before?.exists && found.parent) found.parent[found.key] = clone(container.before.value);
      else if (Array.isArray(found.parent)) found.parent.splice(found.key,1); else if (found.parent) delete found.parent[found.key];
    }
  }
  return result;
}
