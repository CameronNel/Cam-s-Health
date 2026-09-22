import {readFile} from 'node:fs/promises';
import {validateHealth} from '../dist/body.js';
import {totals} from '../dist/model.js';
const data=validateHealth(JSON.parse(await readFile(process.argv[2]||'dist/data/health.json','utf8')));
console.log('VALID: schema, unique entry IDs, body measurements, and workout status.');
for(const [date,day] of Object.entries(data.days))console.log(date, JSON.stringify(totals(day)));
