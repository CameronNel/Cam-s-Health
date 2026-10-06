// Two-way merge between GitHub's dist/data/health.json and the Cam's Life Artifact database.
// Never overwrites a newer change: entries are merged by id against the last synced baseline,
// and a true conflict keeps the GitHub value and is reported.
// Usage: node scripts/sync-health.mjs --base base.json --github github.json --artifact-dir <export dir> --out merged.json --artifact-out <dir> --report report.json
import {readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {validateLifeHealth} from '../dist/health-intelligence.js';

const canonical = v => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v ?? null);
const eq = (a, b) => canonical(a) === canonical(b);
const META_KEYS = ['profile', 'training', 'recipes', 'provenance'];

function pick(base, github, artifact, where, conflicts) {
  if (eq(github, artifact)) return github;
  if (eq(github, base)) return artifact;
  if (eq(artifact, base)) return github;
  conflicts.push(`${where}: changed in both places; kept the GitHub value`);
  return github;
}

function mergeEntries(base = [], github = [], artifact = [], where, conflicts) {
  const by = list => new Map(list.map(entry => [entry.id, entry]));
  const b = by(base), g = by(github), a = by(artifact);
  const order = [...new Set([...github.map(e => e.id), ...artifact.map(e => e.id)])];
  const out = [];
  for (const id of order) {
    const be = b.get(id), ge = g.get(id), ae = a.get(id), here = `${where}/${id}`;
    if (ge && ae) { out.push(eq(ge, ae) ? ge : eq(ge, be) ? ae : eq(ae, be) ? ge : (conflicts.push(`${here}: changed in both places; kept the GitHub value`), ge)); }
    else if (ge) { if (be && eq(ge, be)) continue; if (be) conflicts.push(`${here}: removed in the app but changed on GitHub; kept the GitHub entry`); out.push(ge); }
    else if (ae) { if (be && eq(ae, be)) continue; if (be) conflicts.push(`${here}: removed on GitHub but changed in the app; kept the app entry`); out.push(ae); }
  }
  return out;
}

function mergeDay(base = {}, github = {}, artifact = {}, date, conflicts) {
  const out = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(github), ...Object.keys(artifact)])) {
    const value = key === 'food' || key === 'workouts'
      ? mergeEntries(base[key], github[key], artifact[key], `${date}/${key}`, conflicts)
      : pick(base[key], github[key], artifact[key], `${date}/${key}`, conflicts);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function mergeHealth(base, github, artifact) {
  // Refuse to merge from, or write, a record the app would reject.
  validateLifeHealth(github); validateLifeHealth(artifact);
  const conflicts = [], report = {conflicts, fromGithub: [], fromApp: []};
  const merged = {schemaVersion: 1, updatedAt: ''};
  for (const key of ['profile', 'training']) merged[key] = pick(base?.[key], github[key], artifact[key], key, conflicts);
  merged.days = {};
  for (const key of ['recipes', 'provenance']) { const v = pick(base?.[key], github[key], artifact[key], key, conflicts); if (v !== undefined) merged[key] = v; }
  for (const date of [...new Set([...Object.keys(base?.days || {}), ...Object.keys(github.days), ...Object.keys(artifact.days)])].sort()) {
    const day = mergeDay(base?.days?.[date], github.days[date], artifact.days[date], date, conflicts);
    if (Object.keys(day).length) merged.days[date] = day;
    if (!eq(day, github.days[date]) && day) report.fromApp.push(date);
    if (!eq(day, artifact.days[date])) report.fromGithub.push(date);
  }
  const strip = x => ({...x, updatedAt: 0});
  merged.updatedAt = eq(strip(merged), strip(github)) ? github.updatedAt : eq(strip(merged), strip(artifact)) ? artifact.updatedAt : new Date().toISOString();
  validateLifeHealth(merged);
  report.githubChanged = !eq(strip(merged), strip(github));
  report.appChanged = !eq(strip(merged), strip(artifact));
  report.metaChanged = META_KEYS.some(key => !eq(merged[key], artifact[key])) || report.githubChanged;
  return {merged, report};
}

export async function readExport(dir) {
  const body = async file => { const v = JSON.parse(await readFile(file, 'utf8')); return v && typeof v.data === 'object' && 'id' in v ? v.data : v; };
  const meta = await body(join(dir, 'health', 'meta.json')), days = {};
  for (const file of (await readdir(join(dir, 'days'))).filter(n => n.endsWith('.json'))) days[file.slice(0, -5)] = await body(join(dir, 'days', file));
  const data = {schemaVersion: 1, updatedAt: meta.updatedAt, profile: meta.profile, training: meta.training, days};
  if (meta.recipes) data.recipes = meta.recipes;
  if (meta.provenance) data.provenance = meta.provenance;
  return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]]] : acc, []));
  for (const k of ['base', 'github', 'artifact-dir', 'out', 'artifact-out', 'report']) if (!args[k]) { console.error('Missing --' + k); process.exit(2); }
  const base = JSON.parse(await readFile(args.base, 'utf8')), github = validateLifeHealth(JSON.parse(await readFile(args.github, 'utf8'))), artifact = validateLifeHealth(await readExport(args['artifact-dir']));
  const {merged, report} = mergeHealth(base, github, artifact);
  await writeFile(args.out, JSON.stringify(merged, null, 2) + '\n');
  // Files to write back into the app: only days that differ, plus the meta document.
  await mkdir(join(args['artifact-out'], 'days'), {recursive: true});
  const write = [];
  for (const date of Object.keys(merged.days)) if (!eq(merged.days[date], artifact.days[date])) { await writeFile(join(args['artifact-out'], 'days', date + '.json'), JSON.stringify(merged.days[date])); write.push(date); }
  const {days, ...meta} = merged;
  if (report.metaChanged || write.length) await writeFile(join(args['artifact-out'], 'meta.json'), JSON.stringify(meta));
  report.appWrites = {days: write, meta: !!(report.metaChanged || write.length)};
  await writeFile(args.report, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
