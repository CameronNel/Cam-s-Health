/** Print app-owned action IDs so new menus cannot silently escape the screenshot inventory. */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './fixture.mjs';
import { ALL_CASES } from './inventory.mjs';
const files=(await readdir(path.join(ROOT,'dist'))).filter(name=>name.endsWith('.js')&&!['app.js','lookup.js','nutrition-lookup.js'].includes(name));
const actions=new Map();
for(const file of files){const text=await readFile(path.join(ROOT,'dist',file),'utf8');for(const match of text.matchAll(/data-(act|life)=["']([a-z][a-z0-9-]*)["']/g)){const key=match[1]+':'+match[2];actions.set(key,[...new Set([...(actions.get(key)||[]),file])]);}for(const match of text.matchAll(/\b(?:button|iconButton|btn)\(\s*['"][^'"\n]*['"]\s*,\s*['"]([a-z][a-z0-9-]*)['"]/g)){const key='helper:'+match[1];actions.set(key,[...new Set([...(actions.get(key)||[]),file])]);}}
console.log(JSON.stringify({screenCases:ALL_CASES.map(c=>c.id),actions:[...actions].sort().map(([id,files])=>({id,files}))},null,2));
