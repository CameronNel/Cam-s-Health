import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourceFingerprint} from './harness.mjs';
const expectedSource=process.env.AUDIT_EXPECT_SOURCE;assert.ok(expectedSource);
const retainedSource='236ecb12fdd7b0919a3bd482c5cdd869cc62c11e6ca82fbf2ce1c755fb650f45';
const root='/workspace/cams-health-layout-audit';
const plans=[
 {dir:'food-light-geometry',theme:'light',cases:408,source:retainedSource},
 {dir:'food-conditional-dark-repairs',theme:'dark',cases:162,source:retainedSource},
 {dir:'food-conditional-light-repairs',theme:'light',cases:162,source:retainedSource},
 {dir:'food-daytype-current/dark',theme:'dark',cases:12,source:retainedSource},
 {dir:'food-daytype-current/light',theme:'light',cases:12,source:retainedSource},
 {dir:'food-transition-current/dark',theme:'dark',cases:24,source:expectedSource},
 {dir:'food-transition-current/light',theme:'light',cases:24,source:expectedSource}
];
const results=[];
for(const plan of plans){
 const dir=path.join(root,plan.dir),ledger=JSON.parse(await fs.readFile(dir+'/cases.json','utf8')),inventory=JSON.parse(await fs.readFile(dir+'/inventory.json','utf8')),cases=ledger.cases;
 assert.equal(inventory.sourceHash,plan.source);assert.equal(inventory.expectedCaseCount,plan.cases);assert.equal(cases.length,plan.cases);
 const key=c=>[c.id,c.profile,c.mode].join('|');assert.equal(new Set(cases.map(key)).size,cases.length);assert.deepEqual(cases.map(key).sort(),inventory.expectedScreenStates.map(key).sort());
 assert.ok(cases.every(c=>c.sourceHash===plan.source&&!c.sourceChangedSinceBoot&&c.theme===plan.theme&&c.requestedTheme===plan.theme&&c.themeMatchesRequest));
 assert.ok(ledger.checks.length>0&&ledger.checks.every(c=>c.pass));assert.deepEqual(ledger.errors,[]);
 const bad=cases.filter(c=>c.documentOverflow>2||c.sheetOverflow>2||['smallTargets','clippedControls','offscreenControls','unnamedControls','verticallyClippedStickyControls','captureErrors'].some(k=>c[k]?.length));assert.deepEqual(bad,[]);
 const images=[];
 for(const c of cases)for(const file of c.screenshots||[]){const bytes=await fs.readFile(path.join(dir,file));assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);assert.equal(width,c.viewport.width*c.devicePixelRatio,file+' width');assert.equal(height,c.viewport.height*c.devicePixelRatio,file+' height');images.push({file,id:c.id,profile:c.profile,mode:c.mode,width,height,sha256:createHash('sha256').update(bytes).digest('hex')});}
 if(inventory.expectedNativeImageCount!=null)assert.equal(images.length,inventory.expectedNativeImageCount);
 if(inventory.expectedMockSaveCount!=null)assert.equal(ledger.mockWrites.length,inventory.expectedMockSaveCount);
 const summary={directory:dir,sourceHash:plan.source,theme:plan.theme,cases:cases.length,states:new Set(cases.map(c=>c.id)).size,nativeImages:images.length,checksPassed:ledger.checks.length,mockWrites:ledger.mockWrites.length,runtimeErrors:0,layoutPolicyViolations:0,captureErrors:0,actualThemesAndSourcesMatch:true,images};
 await fs.writeFile(dir+'/verified-summary.json',JSON.stringify(summary,null,2));results.push(summary);
}
assert.equal(await sourceFingerprint(),expectedSource);
const aggregate={finalSourceHash:expectedSource,retainedSourceHash:retainedSource,generatedAt:new Date().toISOString(),totalCases:results.reduce((n,r)=>n+r.cases,0),totalNativeImages:results.reduce((n,r)=>n+r.nativeImages,0),results,rawBaselinePreserved:'/workspace/cams-health-layout-audit/food-final-geometry',limitations:'Synthetic GitHub-intercepted Chromium proof with exact per-ledger source attribution. Earlier236 geometry, family and unchanged-selector proof remains retained; final-source transition/focus proof is separate. Root-reviewed source-policy admission and native/manual retest manifests determine acceptance; this aggregate does not replace them.'};
assert.equal(aggregate.totalCases,804);
await fs.writeFile(root+'/food-current-verification.json',JSON.stringify(aggregate,null,2));console.log(JSON.stringify({...aggregate,results:results.map(({images,...summary})=>summary)},null,2));
