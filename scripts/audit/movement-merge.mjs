// Reconcile independently planned states with the final integrated browser evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sourceFingerprint} from './harness.mjs';
const root=process.argv[2]||'/workspace/cams-health-layout-audit/movements-final';
const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
const hash=await sourceFingerprint(),parts=['native-gallery','responsive-current'];
const inputs=await Promise.all(parts.map(async part=>({part,cases:await read(part+'/cases.json'),run:await read(part+'/results.json')})));
const inventory=await read('native-gallery/inventory.json');
const all=inputs.flatMap(p=>p.cases.cases.map(c=>({...c,...(c.screenshots?{screenshots:c.screenshots.map(file=>path.join(p.part,file))}:{})})));
const key=c=>[c.id,c.profile,c.mode].join('|');
assert.equal(new Set(all.map(key)).size,all.length,'No duplicate route states');
assert.deepEqual(all.map(key).sort(),inventory.expectedAllScreenStates.map(key).sort(),'All independently planned route states were tested');
for(const c of all){assert.equal(c.sourceChangedSinceBoot,false);assert.ok(c.devicePixelRatio>0);assert.ok(c.documentOverflow<=2&&c.sheetOverflow<=2);for(const field of ['smallTargets','clippedControls','unnamedControls','verticallyClippedStickyControls'])assert.equal(c[field]?.length||0,0,`${key(c)} ${field}`);}
for(const input of inputs){assert.equal(input.run.sourceHashAfter,input.run.sourceHash);assert.equal(input.run.sourceChangedSinceStart,false);assert.ok(input.cases.cases.every(c=>c.sourceHash===input.run.sourceHash));assert.equal(input.cases.errors.length,0);assert.equal(input.cases.mockWrites.length,0);assert.equal(input.run.canonicalBefore,input.run.canonicalAfter);}
assert.equal(inputs[1].run.sourceHash,hash,'Full9-profile geometry is tested on current repaired source');
const native=inputs[0].run;
const baselineHash=native.sourceHash,relevance=await read('baseline-source-relevance.json');assert.equal(relevance.sourceHash,baselineHash);
const currentHashes=Object.fromEntries(await Promise.all(Object.keys(relevance.hashes).map(async file=>[file,createHash('sha256').update(await fs.readFile(new URL('../../dist/'+file,import.meta.url))).digest('hex')])));
for(const [file,digest] of Object.entries(native.geometrySourceHashes))assert.equal(currentHashes[file],digest,'Renderer/artwork remains identical to native baseline: '+file);
const sourceRelevance={baselineHash,currentHash:hash,baselineHashes:relevance.hashes,currentHashes,changedPublicFiles:Object.keys(currentHashes).filter(f=>currentHashes[f]!==relevance.hashes[f]),rendererArtworkUnchanged:true,note:'Native images retain their original baseline hashes. Current9-profile geometry and targeted module-error/SVG repair proofs are separate. Scoped shared CSS and error-state semantics changes are not silently attributed to earlier pixels.'};
await fs.writeFile(path.join(root,'source-relevance-current.json'),JSON.stringify(sourceRelevance,null,2));
assert.deepEqual(native.renderStates.map(s=>s.stateId).sort(),inventory.states.map(s=>s.stateId).sort(),'All independently planned angle/side/variant states were rendered');
assert.equal(native.coverage.demos,53);assert.equal(native.coverage.variants,59);assert.equal(native.coverage.angleSideStates,304);assert.equal(native.coverage.poseSamples,2432);
assert.deepEqual(native.captures.map(c=>c.id).sort(),inventory.expectedNativeCaptureIds.sort(),'All488 independently planned native screenshots exist');
for(const c of native.captures){assert.equal(c.actualDPR,3);assert.ok(c.nativeSize.width>0&&c.nativeSize.height>0);if(c.id.endsWith('--oppo-popup'))assert.deepEqual(c.nativeSize,{width:1272,height:2772});}
assert.ok(native.geometry.every(g=>!g.unexpectedClipping.length));
const geometry=await read('geometry-source-audit.json'),currentGeometry=await read('geometry-current/geometry-source-audit.json');assert.equal(geometry.sourceHash,baselineHash);assert.equal(currentGeometry.sourceHash,hash);assert.equal(geometry.unexpectedCropping.length,0);assert.equal(currentGeometry.unexpectedCropping.length,0);
const lifecycle=await read('lifecycle/results.json'),repair=await read('lifecycle-repair/results-module-error-no-webgl.json');
for(const [folder,summary,source]of[['lifecycle',lifecycle,baselineHash],['lifecycle-repair',repair,hash]]){assert.equal(summary.sourceHash,source);assert.equal(summary.sourceHashAfter,source);assert.equal(summary.errors.length,0);assert.ok(summary.states.every(s=>s.pass));for(const state of summary.states){const ledger=await read(folder+'/'+state.id+'/cases.json');assert.equal(ledger.errors.length,0);assert.equal(ledger.mockWrites.length,0);assert.ok(ledger.checks.every(c=>c.pass));for(const c of ledger.cases){assert.equal(c.sourceHash,source);assert.equal(c.sourceChangedSinceBoot,false);}}}
const contacts=await read('native-gallery/contacts/index.json');assert.equal(contacts.sourceHash,baselineHash);
const review=await read('native-gallery/contacts/visual-review.json');assert.equal(review.sourceHash,baselineHash);assert.deepEqual(review.reviewedPages.sort(),contacts.pages.map(p=>p.file).sort());
const merged={domain:'movements-final',sourceHash:hash,baselineSourceHash:baselineHash,sourceSnapshotMode:'Baseline native artwork plus current geometry and scoped repair proofs; original per-case hashes retained.',date:inputs[0].cases.date,profiles:inputs[0].cases.profiles,cases:all,checks:inputs.flatMap(p=>p.cases.checks),errors:[],blockedRequests:inputs.flatMap(p=>p.cases.blockedRequests),mockWrites:[],childLedgers:parts.map(p=>p+'/cases.json'),baselineVisualLedger:'responsive/cases.json',lifecycleLedger:'lifecycle/results.json',scopedRepairLedger:'lifecycle-repair/results-module-error-no-webgl.json'};
await fs.writeFile(path.join(root,'cases.json'),JSON.stringify(merged,null,2));
await fs.writeFile(path.join(root,'inventory.json'),JSON.stringify({...inventory,scope:'all-final',sourceHash:hash,baselineSourceHash:baselineHash,sourceSnapshotMode:merged.sourceSnapshotMode,expectedScreenStates:inventory.expectedAllScreenStates,childLedgers:merged.childLedgers,lifecycleStates:lifecycle.states.map(s=>s.id)},null,2));
const result={sourceHash:hash,baselineSourceHash:baselineHash,sourceSnapshotMode:merged.sourceSnapshotMode,sourceRelevance,routeCases:all.length,coverage:native.coverage,geometry:{baseline:geometry,current:currentGeometry},lifecycle:lifecycle.states,scopedRepair:repair.states,captures:{native:native.captures.length,contacts:contacts.pages.length},visualReview:review,errors:[],mockWrites:0,canonicalHealthUnchanged:true};
await fs.writeFile(path.join(root,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({sourceHash:hash,routeCases:all.length,coverage:native.coverage,lifecycle:lifecycle.states,captures:result.captures}));
