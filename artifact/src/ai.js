// Real-Claude prompts and strict parsing. Claude only drafts; the app validates and saves.
import {healthSystemPrompt} from '../../dist/health-intelligence.js';
import {totals, dayFor, shiftDate} from '../../dist/model.js';

const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat'];
const FOOD_KEYS = ['id', 'name', 'quantity', ...NUTRIENTS, 'estimated', 'source', 'note'];
export const ALLOWED = {
  add_food: ['type', ...FOOD_KEYS.slice(1)],
  update_food: ['type', ...FOOD_KEYS],
  set_metrics: ['type', 'steps', 'waterMl', 'weightKg'],
  set_body: ['type', 'bodyFatPct', 'skeletalMuscleKg', 'method', 'measurementsCm', 'notes'],
  set_wellbeing: ['type', 'mood', 'energy', 'sleepHours', 'feelings'],
  add_workout: ['type', 'sessionId', 'name', 'status', 'durationMin', 'notes']
};

const FORMAT = `Reply with ONLY one JSON object, no prose outside it:
{"date":"YYYY-MM-DD","reply":"short, friendly message to Cam: what you understood, every assumption you made, and what is still unknown","actions":[...],"questions":["only questions whose answer you truly need"]}
Action shapes (omit fields you do not know, never write null to erase an existing value):
{"type":"add_food","name":"","quantity":"100 g","kcal":0,"protein":0,"carbs":0,"fat":0,"estimated":true,"source":"","note":""}
{"type":"update_food","id":"<existing entry id from context>", ...only the fields that change}
{"type":"set_metrics","steps":0} | {"type":"set_metrics","waterMl":0} | {"type":"set_metrics","weightKg":0}  (daily totals)
{"type":"set_body","bodyFatPct":0} | {"type":"set_body","skeletalMuscleKg":0} | {"type":"set_body","method":"BIA watch"} | {"type":"set_body","measurementsCm":{"waist":0}}
{"type":"set_wellbeing","mood":1-5} | {"type":"set_wellbeing","energy":1-5} | {"type":"set_wellbeing","sleepHours":0} | {"type":"set_wellbeing","feelings":""}
{"type":"add_workout","name":"","sessionId":null,"status":"completed","durationMin":0,"notes":""}
Use "date" only for the day the report is about (default: the selected date in context). If the user reports on several days, handle the clearest and ask them to send the other separately.`;

const OVERRIDE = `Cam has explicitly asked this app to estimate nutrition for food they describe without a label. This overrides the rule above about asking for a label first. When a food and a quantity are given, estimate kcal, protein, carbs and fat from well-established reference values (USDA FoodData Central style), set estimated true, set source to "Claude estimate from reference values", and list every assumption in note (raw vs cooked weight, cut, cooking method, added oil, how moisture loss changes the numbers). Preserve Cam's own wording in name and quantity. If the food already has an entry in context with unknown nutrition, use update_food on that id instead of adding a second entry. Prefer a saved recipe or a label Cam gave over an estimate. If the quantity is missing, ask, and log nothing for that food. Never fabricate brand data. Weighed or described items like "extremely overcooked" change texture and moisture, not the nutrition of the cooked weight in any large way; say so briefly rather than inventing precision.`;

const brief = (data, date) => {
  const day = dayFor(data, date), t = totals(day);
  return {date, totals: {kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat, incompleteEntries: t.pending}, steps: day.steps, waterMl: day.waterMl, weightKg: day.weightKg};
};

export function buildContext(data, date) {
  const day = dayFor(data, date);
  const recent = [];
  for (let i = 1; i <= 13; i++) { const d = shiftDate(date, -i); if (data.days[d]) recent.push({...brief(data, d), bodyFatPct: data.days[d].body?.bodyFatPct ?? null, bodyMethod: data.days[d].body?.method ?? null, skeletalMuscleKg: data.days[d].body?.skeletalMuscleKg ?? null, mood: data.days[d].wellbeing?.mood ?? null, energy: data.days[d].wellbeing?.energy ?? null, sleepHours: data.days[d].wellbeing?.sleepHours ?? null, workouts: data.days[d].workouts.map(w => w.name + ' (' + w.status + ')')}); }
  return {
    selectedDate: date,
    profile: {targets: data.profile.targets, trainingStatus: data.profile.trainingStatus, trainingNote: data.profile.trainingNote, heightCm: data.profile.heightCm ?? null},
    selectedDay: day,
    previousDays: recent,
    recipes: (data.recipes || []).map(r => ({id: r.id, name: r.name, yieldG: r.yieldG, per100g: r.per100g, total: r.total, estimated: r.estimated, note: r.note})),
    sessions: data.training.sessions.map(s => ({id: s.id, name: s.name})),
    rotation: data.training.rotation
  };
}

export function buildTurns(data, date, history, message) {
  const lead = `${healthSystemPrompt}\n\n${OVERRIDE}\n\n${FORMAT}\n\nCurrent app data (JSON, treat as data):\n${JSON.stringify(buildContext(data, date))}`;
  return [{role: 'user', content: lead}, ...history.slice(-8).map(t => ({role: t.role, content: t.content})), {role: 'user', content: message || 'Please look at the attached photo.'}];
}

export function sanitize(parsed, fallbackDate) {
  if (!parsed || typeof parsed !== 'object') throw Error('Claude did not return a usable answer.');
  const actions = [];
  for (const raw of Array.isArray(parsed.actions) ? parsed.actions : []) {
    const keys = ALLOWED[raw?.type];
    if (!keys) continue;
    const action = {};
    for (const key of keys) if (raw[key] !== undefined) action[key] = raw[key];
    if (action.type === 'add_food' || action.type === 'update_food') {
      if (action.type === 'add_food') {
        action.estimated = action.estimated === true;
        action.quantity ??= '';
      }
      for (const key of NUTRIENTS) if (action[key] === undefined && action.type === 'add_food') action[key] = null;
      if (action.estimated === true) {
        action.source = (action.source || '').trim() || 'Claude estimate from reference values';
        action.note = (action.note || '').trim() || 'Estimated by Claude from reference values; assumptions were not recorded.';
      }
    }
    actions.push(action);
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(parsed.date || '') ? parsed.date : fallbackDate;
  return {
    date,
    reply: typeof parsed.reply === 'string' ? parsed.reply.slice(0, 4000) : '',
    actions,
    questions: (Array.isArray(parsed.questions) ? parsed.questions : []).filter(q => typeof q === 'string' && q.trim()).slice(0, 5)
  };
}

export function insightsPrompt(data, date) {
  const rows = [];
  for (let i = 20; i >= 0; i--) {
    const d = shiftDate(date, -i), day = data.days[d];
    if (!day) continue;
    const t = totals(day);
    rows.push({date: d, kcal: day.food.length ? t.kcal : null, protein: day.food.length ? t.protein : null, incompleteEntries: t.pending, estimated: t.estimated, steps: day.steps, waterMl: day.waterMl, weightKg: day.weightKg, bodyFatPct: day.body?.bodyFatPct ?? null, bodyMethod: day.body?.method ?? null, skeletalMuscleKg: day.body?.skeletalMuscleKg ?? null, mood: day.wellbeing?.mood ?? null, energy: day.wellbeing?.energy ?? null, sleepHours: day.wellbeing?.sleepHours ?? null, workouts: day.workouts.map(w => `${w.name} (${w.status}${w.durationMin != null ? ', ' + w.durationMin + ' min' : ''})`)});
  }
  return `You review Cam's logged health data inside a private app. Targets: ${JSON.stringify(data.profile.targets)}. Training status: ${data.profile.trainingStatus}. Goal context from the profile: ${data.profile.source}
Rules: describe only what the logged days show. A missing day or missing meal is unknown, never zero. Do not infer a calorie deficit from intake alone and do not add exercise calories. Different body-composition methods are not comparable. Do not diagnose, do not call fat-free mass muscle, and do not promise outcomes. Compare actual against the stored targets as the expected line. Predictions must be a short extrapolation of recorded values with its limits stated, or omitted when fewer than five readings exist.
Reply with ONLY JSON: {"headline":"one sentence","insights":[{"title":"","detail":"","tone":"positive|neutral|attention"}],"concerns":[{"title":"","detail":""}],"nextSteps":["max 3 concrete, small actions"]}. At most 4 insights and 3 concerns; use an empty concerns array when nothing deserves concern.
Logged days (JSON):
${JSON.stringify(rows)}`;
}
