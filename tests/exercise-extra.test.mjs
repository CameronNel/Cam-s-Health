import test from 'node:test';
import assert from 'node:assert/strict';
import {extraExerciseDemos,getExtraExercisePose} from '../dist/exercise-extra.js';
import {getExercisePose} from '../dist/exercise-catalogue.js';

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('historical extras have explicit unique identities and honest illustration equipment',()=>{
  assert.equal(new Set(extraExerciseDemos.map(d=>d.id)).size,extraExerciseDemos.length);
  for(const d of extraExerciseDemos){assert.ok(d.cues.length>=3);assert.ok(d.equipment);assert.ok(Object.isFrozen(d.aliases));}
  for(const id of ['db-curl','rdl-example','db-lateral-raise'])assert.match(extraExerciseDemos.find(d=>d.id===id).equipment,/illustrated variation/);
  assert.equal(getExtraExercisePose('made-up shoulder thing',0,null,getExercisePose),null);
});

test('every extra movement remains finite and closes a smooth continuous loop',()=>{
  for(const d of extraExerciseDemos){
    for(const phase of [0,.125,.25,.375,.5,.625,.75,.875,1,-.25]){
      const pose=getExtraExercisePose(d.id,phase,undefined,getExercisePose);assert.ok(pose,`${d.id}: missing pose`);
      for(const [name,point] of Object.entries(pose.joints)){assert.equal(point.length,3);assert.ok(point.every(Number.isFinite),`${d.id} ${name}`);}
      for(const s of ['L','R']){
        // The pedagogical mannequin never stretches its limbs to reach the equipment.
        const j=pose.joints;assert.ok(Math.abs(distance(j['shoulder'+s],j['elbow'+s])-.29)<.012,`${d.id}: upper arm`);
        assert.ok(Math.abs(distance(j['elbow'+s],j['wrist'+s])-.27)<.002,`${d.id}: forearm`);
      }
    }
    const a=getExtraExercisePose(d.id,0,undefined,getExercisePose),b=getExtraExercisePose(d.id,1-1e-5,undefined,getExercisePose);
    for(const k of Object.keys(a.joints))assert.ok(distance(a.joints[k],b.joints[k])<.001,`${d.id}: loop seam ${k}`);
  }
});

test('distinct historical exercises use their own equipment and only the working side moves',()=>{
  const pose=(id,p)=>getExtraExercisePose(id,p,undefined,getExercisePose);
  assert.ok(pose('db-shoulder-press',.5).props.filter(p=>p.kind==='dumbbell').length===2);
  assert.ok(pose('db-lateral-raise',.5).joints.wristR[0]>.65);
  for(const id of ['single-arm-cable-fly','single-arm-db-overhead-extension','behind-body-cable-curl']){
    assert.ok(distance(pose(id,0).joints.wristL,pose(id,.5).joints.wristL)<.001,id);
    assert.ok(distance(pose(id,0).joints.wristR,pose(id,.5).joints.wristR)>.1,id);
  }
  for(const id of ['single-arm-preacher-curl','hammer-preacher-curl'])assert.ok(pose(id,.25).props.filter(p=>p.kind==='bench').length===2);
  const a=pose('bent-over-db-row',0),b=pose('bent-over-db-row',.5);
  assert.deepEqual(a.joints.shoulderR,b.joints.shoulderR);assert.ok(b.joints.elbowR[2]<a.joints.elbowR[2]);
});
