// Rebuild dist/data/health.json from an export of the Cam's Life Artifact database.
// Usage: node scripts/assemble-health.mjs <dir with health/meta.json and days/*.json> [output]
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {validateLifeHealth} from '../dist/health-intelligence.js';
const [dir, out = 'dist/data/health.json'] = process.argv.slice(2);
if (!dir) { console.error('Usage: node scripts/assemble-health.mjs <export dir> [output]'); process.exit(2); }
const body = async file => { const v = JSON.parse(await readFile(file, 'utf8')); return v && typeof v.data === 'object' && 'id' in v ? v.data : v; };
const meta = await body(join(dir, 'health', 'meta.json'));
const days = {};
for (const file of (await readdir(join(dir, 'days'))).filter(name => name.endsWith('.json')).sort()) days[file.slice(0, -5)] = await body(join(dir, 'days', file));
const data = validateLifeHealth({schemaVersion: 1, updatedAt: meta.updatedAt, profile: meta.profile, training: meta.training, days, ...(meta.recipes ? {recipes: meta.recipes} : {}), ...(meta.provenance ? {provenance: meta.provenance} : {})});
await writeFile(out, JSON.stringify(data, null, 2) + '\n');
console.log(`Wrote ${out}: ${Object.keys(days).length} days, validated.`);
