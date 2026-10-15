import test from 'node:test';
import assert from 'node:assert/strict';
import {exerciseDemos,getExercisePose} from '../dist/exercise-catalogue.js';
import {exerciseDemoWorkingSide,exerciseDemoGuideJoints,normalizeDemoControls,exerciseDemoCamera,reflectExercisePose,projectExercisePoint} from '../dist/exercise-demo.js';

const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
const near=(a,b,message='')=>assert.ok(distance(a,b)<1e-8,message);

test('playback controls accept the offered speeds and reject corrupt preference values',()=>{
  assert.deepEqual(normalizeDemoControls(),{angle:'three-quarter',side:'right',speed:1,overlay:false});
  assert.deepEqual(normalizeDemoControls({angle:'rear',side:'left',speed:'0.5',overlay:'true'}),{angle:'rear',side:'left',speed:.5,overlay:true});
  assert.deepEqual(normalizeDemoControls({angle:'underneath',side:'either',speed:0,overlay:'false'}),{angle:'three-quarter',side:'right',speed:1,overlay:false});
  for(const speed of [.5,1,1.5])assert.equal(normalizeDemoControls({speed}).speed,speed);
});

test('front, rear and side cameras orbit around the authored target without changing zoom or elevation',()=>{
  for(const demo of exerciseDemos){
    const pose=getExercisePose(demo.id,.25),target=pose.target;
    const radius=Math.hypot(pose.camera[0]-target[0],pose.camera[2]-target[2]);
    for(const angle of ['front','rear','side','three-quarter'])for(const side of ['left','right']){
      const camera=exerciseDemoCamera(pose,angle,side);
      assert.ok(camera.every(Number.isFinite),`${demo.id}/${angle}`);
      assert.equal(camera[1],pose.camera[1]);
      assert.ok(Math.abs(Math.hypot(camera[0]-target[0],camera[2]-target[2])-radius)<1e-9);
      if(angle==='front'){assert.equal(camera[0],target[0]);assert.ok(camera[2]>target[2]);}
      if(angle==='rear'){assert.equal(camera[0],target[0]);assert.ok(camera[2]<target[2]);}
      if(angle==='side'){assert.equal(camera[2],target[2]);assert.equal(Math.sign(camera[0]-target[0]),side==='left'?-1:1);}
    }
  }
});

test('switching unilateral sides reflects the complete exercise and equipment without changing human proportions',()=>{
  const unilateral=exerciseDemos.filter(d=>exerciseDemoWorkingSide(d.id));
  assert.ok(unilateral.length>=17);
  assert.equal(exerciseDemoWorkingSide('bulgarian-split-squat'),'left');
  assert.equal(exerciseDemoWorkingSide('single-arm-cable-shoulder-press'),'right');
  for(const bilateral of ['db-rdl','flat-db-press','db-shoulder-press','pull-ups','unknown'])assert.equal(exerciseDemoWorkingSide(bilateral),null);
  for(const demo of unilateral)for(const phase of [0,.25,.5,.75]){
    const pose=getExercisePose(demo.id,phase),original=structuredClone(pose),reflected=reflectExercisePose(pose);
    assert.deepEqual(pose,original,'reflection must never mutate the shared catalogue pose');
    for(const [key,point] of Object.entries(pose.joints))near(reflected.joints[key],[-point[0],point[1],point[2]]);
    for(const [a,b] of [['shoulderR','elbowR'],['elbowR','wristR'],['hipL','kneeL'],['kneeL','ankleL']])assert.ok(Math.abs(distance(pose.joints[a],pose.joints[b])-distance(reflected.joints[a],reflected.joints[b]))<1e-10);
    reflected.props.forEach((prop,i)=>{
      for(const key of ['from','to','position'])if(pose.props[i][key])near(prop[key],[-pose.props[i][key][0],pose.props[i][key][1],pose.props[i][key][2]]);
      if(prop.rotation)near(prop.rotation,[pose.props[i].rotation[0],-pose.props[i].rotation[1],-pose.props[i].rotation[2]]);
    });
    const restored=reflectExercisePose(reflected);
    for(const key of Object.keys(pose.joints))near(restored.joints[key],pose.joints[key]);
    assert.deepEqual(restored.props,pose.props);
  }
});

test('projected form guides align to the camera target and preserve their position when the stage resizes',()=>{
  const target=[.1,.9,.2],camera=[2.7,1.8,3.9],point=[.25,1.5,.1];
  near(projectExercisePoint(target,camera,target,336,300).slice(0,2),[168,150]);
  const small=projectExercisePoint(point,camera,target,336,300),large=projectExercisePoint(point,camera,target,672,600);
  near(large.slice(0,2),small.slice(0,2).map(n=>n*2));
  for(const angle of ['front','side','rear','three-quarter']){
    const eye=exerciseDemoCamera({camera,target},angle);
    near(projectExercisePoint(target,eye,target,390,460).slice(0,2),[195,230]);
    assert.ok(projectExercisePoint(point,eye,target,390,460).every(Number.isFinite));
  }
});

test('technique paths follow isolated wrist motion, raised legs and the calf-raise foot',()=>{
  for(const id of ['wrist-flexion-extension','wrist-curl','wrist-extension']){
    const groups=exerciseDemoGuideJoints(id);assert.ok(groups.every(g=>g.some(j=>j.startsWith('hand'))));
    const a=getExercisePose(id,.125,'flexion'),b=getExercisePose(id,.625,'flexion');
    assert.ok(distance(a.joints.handR,b.joints.handR)>.03,'the guide includes the moving hand');
    near(a.joints.wristR,b.joints.wristR,'the supported wrist remains stationary');
  }
  const legs=exerciseDemoGuideJoints('hanging-leg-raise').flat();
  assert.ok(legs.includes('ankleL')&&legs.includes('ankleR')&&legs.includes('kneeL')&&legs.includes('kneeR'));
  const low=getExercisePose('hanging-leg-raise',0),high=getExercisePose('hanging-leg-raise',.5);
  assert.ok(distance(low.joints.ankleR,high.joints.ankleR)>.5);
  const calf=exerciseDemoGuideJoints('single-leg-calf-raise')[0];assert.deepEqual(calf,['kneeL','ankleL','toeL']);
  const down=getExercisePose('single-leg-calf-raise',0),up=getExercisePose('single-leg-calf-raise',.5);
  near(down.joints.toeL,up.joints.toeL,'calf guide includes the planted toe reference');assert.ok(distance(down.joints.ankleL,up.joints.ankleL)>.08);
  assert.deepEqual(exerciseDemoGuideJoints('unknown'),[]);
});
