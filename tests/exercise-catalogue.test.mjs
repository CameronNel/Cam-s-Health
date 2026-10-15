import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {exerciseDemos,findExerciseDemo,getExerciseDemo,getExercisePose,exercisePhaseAt} from '../dist/exercise-catalogue.js';

const data=JSON.parse(fs.readFileSync(new URL('../dist/data/health.json',import.meta.url),'utf8'));
const required=['hipL','hipR','kneeL','kneeR','ankleL','ankleR','toeL','toeR','shoulderL','shoulderR','elbowL','elbowR','wristL','wristR','handL','handR','neck','head','waist','chest'];
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const pose=(id,t=0,variant)=>getExercisePose(id,t,variant);

test('every prescribed movement has a named authored demonstration, without changing the health record',()=>{
  const names=[...new Set(data.training.sessions.flatMap(s=>s.exercises.map(e=>e.name)))];
  assert.equal(names.length,32);
  for(const name of names){const d=findExerciseDemo(name);assert.ok(d,`Missing ${name}`);assert.equal(d.name,name);assert.ok(d.cues.length>=3);assert.ok(d.equipment);}
  assert.equal(new Set(exerciseDemos.map(d=>d.id)).size,exerciseDemos.length);
});
test('every named exercise in recorded sessions has a deliberately matched illustration',()=>{
  const names=[...new Set(Object.values(data.days).flatMap(day=>day.workouts.flatMap(w=>w.actualExercises?.map(e=>e.name)||[])))];
  assert.ok(names.length>0);
  for(const name of names)assert.ok(findExerciseDemo(name),`Missing recorded exercise ${name}`);
  for(const name of ['Lateral raises','RDL','Bicep curls'])assert.match(findExerciseDemo(name).equipment,/illustrated variation/);
});
test('matching is exact after punctuation normalization; unknown custom activities are never guessed',()=>{
  assert.equal(findExerciseDemo('  SINGLE–LEG DB RDL  ')?.id,'single-leg-db-rdl');
  assert.equal(findExerciseDemo('Pull ups')?.id,'pull-ups');
  for(const unknown of ['Dips with a jump','Chair neck bridge','Mystery row',null,'','Swim 20 laps'])assert.equal(findExerciseDemo(unknown),null);
  assert.equal(getExerciseDemo('no-such-demo'),null);assert.equal(pose('no-such-demo'),null);
});
test('every authored variant produces finite complete skeletons and a closed looping pose',()=>{
  for(const d of exerciseDemos){
    assert.ok(d.cycleSeconds>=1.8&&d.cycleSeconds<=8,`${d.id} tempo`);
    for(const variant of d.variants?.map(v=>v.id)||[undefined]){
      for(const phase of [0,.125,.25,.375,.5,.625,.75,.875,1]){
        const p=pose(d.id,phase,variant);assert.ok(p.phaseLabel,`${d.id} phase label`);
        for(const key of required){assert.equal(p.joints[key]?.length,3,`${d.id}/${key}`);assert.ok(p.joints[key].every(Number.isFinite),`${d.id}/${key} finite`);}
        for(const point of [p.camera,p.target])assert.ok(point.length===3&&point.every(Number.isFinite));
        for(const prop of p.props){assert.ok(['bar','bench','box','cable','dumbbell','cuff'].includes(prop.kind),`${d.id} supported prop ${prop.kind}`);for(const key of ['from','to','position','size','rotation'])if(prop[key])assert.ok(prop[key].length===3&&prop[key].every(Number.isFinite));}
      }
      assert.deepEqual(pose(d.id,0,variant),pose(d.id,1,variant),`${d.id} closed loop`);
      assert.deepEqual(pose(d.id,.25,variant),pose(d.id,1.25,variant),`${d.id} wrapped phase`);
    }
  }
});
test('the illustration keeps human limb proportions through full repetitions',()=>{
  const limbs=[['shoulder','elbow',.29],['elbow','wrist',.27],['hip','knee',.435],['knee','ankle',.435]];
  for(const d of exerciseDemos)for(const phase of [0,.25,.5,.75]){
    const j=pose(d.id,phase).joints;
    for(const s of ['L','R'])for(const [a,b,expected] of limbs)assert.ok(Math.abs(distance(j[a+s],j[b+s])-expected)<.052,`${d.id} ${a}-${b} ${s}: ${distance(j[a+s],j[b+s])}`);
  }
});
test('timed grip alternatives are genuine static holds with the correct equipment',()=>{
  const id='farmer-hold-dead-hang';
  for(const variant of ['farmer-hold','dead-hang'])assert.deepEqual(pose(id,0,variant).joints,pose(id,.5,variant).joints);
  assert.equal(pose(id,0,'farmer-hold').props.filter(p=>p.kind==='dumbbell').length,2);
  assert.equal(pose(id,0,'dead-hang').props.filter(p=>p.kind==='dumbbell').length,0);
  assert.ok(pose(id,0,'dead-hang').joints.wristR[1]>pose(id,0,'dead-hang').joints.head[1]);
});
test('the neck circuit includes flexion, extension and both sides while staying gently bounded',()=>{
  const samples=Array.from({length:32},(_,i)=>pose('neck-circuit',i/32));
  const rel=samples.map(p=>p.joints.head.map((n,i)=>n-p.joints.neck[i]));
  assert.ok(Math.min(...rel.map(p=>p[2]))<-.02);assert.ok(Math.max(...rel.map(p=>p[2]))>.02);
  assert.ok(Math.min(...rel.map(p=>p[0]))<-.02);assert.ok(Math.max(...rel.map(p=>p[0]))>.02);
  assert.ok(samples.every(p=>Math.max(...p.headRotation.map(Math.abs))<=.24));
  assert.ok(getExerciseDemo('neck-circuit').cues.some(c=>c.includes('no neck bridges')));
});
test('wrist work articulates the hands while forearms remain supported',()=>{
  const a=pose('wrist-flexion-extension',.125,'flexion').joints,b=pose('wrist-flexion-extension',.625,'flexion').joints;
  assert.deepEqual(a.wristR,b.wristR);assert.deepEqual(a.elbowR,b.elbowR);assert.ok(distance(a.handR,b.handR)>.04);
  assert.equal(pose('wrist-flexion-extension',.25,'flexion').grip,'supinated');assert.equal(pose('wrist-flexion-extension',.25,'extension').grip,'pronated');
});
test('the deficit push-up is explicitly identified and supported by two fixed blocks',()=>{
  const d=getExerciseDemo('weighted-deficit-push-up');assert.equal(d.variants[0].id,'deficit');assert.ok(d.cues[0].includes('deficit option'));
  const a=pose(d.id,0),b=pose(d.id,.5);assert.equal(a.props.filter(p=>p.kind==='box').length,2);assert.deepEqual(a.props,b.props);
  assert.ok(b.joints.shoulderR[1]<a.joints.shoulderR[1]-.2);assert.ok(distance(a.joints.ankleR,b.joints.ankleR)<.02);
});
test('movement directions distinguish fly, rear fly, hip hinge, leg extension and hamstring curl',()=>{
  const width=p=>distance(p.joints.wristL,p.joints.wristR);
  assert.ok(width(pose('cable-fly',.5))<width(pose('cable-fly',0)));
  assert.ok(width(pose('cable-rear-delt-fly',.5))>width(pose('cable-rear-delt-fly',0)));
  assert.ok(pose('db-rdl',.5).joints.hipR[2]<pose('db-rdl',0).joints.hipR[2]-.15);
  assert.ok(pose('cable-leg-extension',.5).joints.ankleR[2]>pose('cable-leg-extension',0).joints.ankleR[2]+.4);
  assert.ok(pose('cable-hamstring-curl',.5).joints.ankleR[2]<pose('cable-hamstring-curl',0).joints.ankleR[2]-.4);
});


test('ordinary illustrations play at natural rep speed with a quicker lift and controlled return',()=>{
  for(const d of exerciseDemos.filter(d=>d.cadence.kind==='rep')){
    assert.ok(d.cycleSeconds>=1.8&&d.cycleSeconds<=2.6,`${d.id} visibly faster cycle`);
    assert.equal(d.durationMs,d.cycleSeconds*1000);
    const firstSeconds=d.cycleSeconds*d.cadence.firstHalfFraction;
    const secondSeconds=d.cycleSeconds-firstSeconds;
    const lift=d.cadence.firstHalf==='lift'?firstSeconds:secondSeconds;
    const lower=d.cadence.firstHalf==='lower'?firstSeconds:secondSeconds;
    assert.ok(lift<lower,`${d.id} lift is quicker than lowering`);
  }
  for(const id of ['bulgarian-split-squat','single-leg-db-rdl','step-up','reverse-db-lunge','single-leg-hip-thrust'])assert.equal(getExerciseDemo(id).cycleSeconds,2.6);
});

test('time warping accelerates pressing while preserving the opposite direction of lowering-first movements',()=>{
  const press=getExerciseDemo('db-shoulder-press'),dip=getExerciseDemo('dips');
  const peakPress=pose(press.id,exercisePhaseAt(press.id,.4));
  const atOneSecond=pose(press.id,exercisePhaseAt(press.id,1/press.cycleSeconds));
  assert.ok(distance(peakPress.joints.wristR,pose(press.id,.5).joints.wristR)<1e-8);
  assert.ok(atOneSecond.joints.wristR[1]>1.95,'press is already near its overhead turn after one second');
  assert.equal(dip.cadence.firstHalf,'lower');
  assert.ok(Math.abs(exercisePhaseAt(dip.id,.6)-.5)<1e-10,'dip lowering takes 60% of the loop');
  const bottom=pose(dip.id,exercisePhaseAt(dip.id,.6));
  assert.ok(bottom.joints.shoulderR[1]<pose(dip.id,0).joints.shoulderR[1]-.25);
  for(const id of ['dips','bulgarian-split-squat','single-leg-db-rdl','weighted-deficit-push-up','reverse-db-lunge','db-rdl','rdl-example'])assert.equal(getExerciseDemo(id).cadence.firstHalf,'lower',id);
});

test('retimed loops remain monotonic and continuous and tolerate wrapped or invalid playback times',()=>{
  for(const d of exerciseDemos){
    let previous=0;
    for(let i=0;i<100;i++){
      const phase=exercisePhaseAt(d.id,i/100);
      assert.ok(Number.isFinite(phase)&&phase>=0&&phase<1,d.id);
      assert.ok(phase>=previous-1e-10,`${d.id} phase never reverses`);previous=phase;
    }
    assert.equal(exercisePhaseAt(d.id,0),exercisePhaseAt(d.id,1));
    assert.ok(Math.abs(exercisePhaseAt(d.id,-.25)-exercisePhaseAt(d.id,.75))<1e-10);
    assert.equal(exercisePhaseAt(d.id,Infinity),0);
    const a=pose(d.id,exercisePhaseAt(d.id,0)),b=pose(d.id,exercisePhaseAt(d.id,1-1e-6));
    for(const key of required)assert.ok(distance(a.joints[key],b.joints[key])<.0001,`${d.id} retimed loop seam ${key}`);
  }
  assert.equal(exercisePhaseAt('unknown exercise',.4),null);
});

test('circuit timing keeps gentle subcycles, isolated wrists and genuine static holds',()=>{
  assert.equal(getExerciseDemo('neck-circuit').cycleSeconds,8);
  assert.equal(getExerciseDemo('wrist-flexion-extension').cycleSeconds,4.8);
  for(const id of ['neck-circuit','wrist-flexion-extension','wrist-curl','wrist-extension'])assert.ok(Math.abs(exercisePhaseAt(id,.25)-.25)<1e-10);
  for(const t of [0,.2,.5,.8,1])for(const variant of ['farmer-hold','dead-hang']){
    assert.equal(exercisePhaseAt('farmer-hold-dead-hang',t),0);
    assert.deepEqual(pose('farmer-hold-dead-hang',exercisePhaseAt('farmer-hold-dead-hang',t),variant).joints,pose('farmer-hold-dead-hang',0,variant).joints);
  }
  const a=pose('wrist-flexion-extension',exercisePhaseAt('wrist-flexion-extension',.125)).joints;
  const b=pose('wrist-flexion-extension',exercisePhaseAt('wrist-flexion-extension',.375)).joints;
  assert.deepEqual(a.elbowR,b.elbowR);assert.deepEqual(a.wristR,b.wristR);
  assert.ok(distance(a.handR,b.handR)>.01);
});
