import {readFile} from 'node:fs/promises';
import {validate,totals} from '../dist/model.js';
const data=validate(JSON.parse(await readFile(new URL('../dist/data/health.json',import.meta.url),'utf8')));
for(const [date,day]of Object.entries(data.days))console.log(date,JSON.stringify(totals(day)));
console.log('Health data validated.');
