// Source-backed geometry stress checks, separate from actual browser layout/captures.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {sourceFingerprint} from './harness.mjs';
import {exerciseDemos,getExercisePose,exercisePhaseAt} from '../../dist/exercise-catalogue.js';
import {exerciseDemoWorkingSide,exerciseDemoCamera,reflectExercisePose,projectExercisePoint} from '../../dist/exercise-demo.js';
const out=process.argv[2]||'/workspace/cams-health-layout-audit/movements-final';await fs.mkdir(out,{recursive:true});
const dimensions=[{id:'portrait-popup',width:382,height:300},{id:'portrait-full',width:382,height:416},{id:'small-popup',width:278,height:240},{id:'small-full',width:278,height:320},{id:'landscape-full',width:430,height:320}];
const sourceHash=await sourceFingerprint(),sourceHashes=Object.fromEntries(await Promise.all(['exercise-catalogue.js','exercise-extra.js','exercise-demo.js','exercise-anatomy.js','exercise-anatomy-mesh.js'].map(async file=>[file,createHash('sha256').update(await fs.readFile(new URL('../../dist/'+file,import.meta.url))).digest('hex')])));
if(process.env.AUDIT_EXPECT_SOURCE&&sourceHash!==process.env.AUDIT_EXPECT_SOURCE)throw Error('Projection audit source does not match AUDIT_EXPECT_SOURCE');
let states=0,samples=0,points=0,intentionalLowerLegCropping=0;const unexpectedCropping=[];
for(const d of exerciseDemos)for(const variant of d.variants?.map(v=>v.id)||[undefined])for(const side of exerciseDemoWorkingSide(d.id)?['left','right']:['both'])for(const angle of ['front','side','rear','three-quarter']){
 states++;for(const time of [0,.125,.25,.375,.5,.625,.75,.875]){
  samples++;let pose=getExercisePose(d.id,exercisePhaseAt(d.id,time),variant);if(side!=='both'&&side!==exerciseDemoWorkingSide(d.id))pose=reflectExercisePose(pose);const camera=exerciseDemoCamera(pose,angle,side==='left'?'left':'right');
  for(const dim of dimensions)for(const[joint,value]of Object.entries(pose.joints)){
   points++;const projected=projectExercisePoint(value,camera,pose.target,dim.width,dim.height);if(!projected.every(Number.isFinite))throw Error(d.id+' invalid projection');
   if(projected[0]<0||projected[0]>dim.width||projected[1]<0||projected[1]>dim.height){if(['neck-circuit','wrist-flexion-extension','wrist-curl','wrist-extension'].includes(d.id)&&/^(ankle|toe)/.test(joint))intentionalLowerLegCropping++;else unexpectedCropping.push({id:d.id,variant,side,angle,time,joint,sizeCase:dim.id,projected});}
  }
 }
}
const sourceHashAfter=await sourceFingerprint(),sourceChangedSinceStart=sourceHashAfter!==sourceHash;
const result={sourceHash,sourceHashAfter,sourceChangedSinceStart,sourceHashes,generatedAt:new Date().toISOString(),kind:'Source-backed projection stress test using five nominal renderer aspect/size ranges. Actual browser stage dimensions and screenshots are separately recorded in results.json and cases.json.',states,samples,points,dimensions,unexpectedCropping,intentionalLowerLegCropping,explanation:'Neck and supported wrist studies deliberately zoom the working region. Only nonworking ankles/toes may fall outside their frame; all working joints stay visible.'};await fs.writeFile(path.join(out,'geometry-source-audit.json'),JSON.stringify(result,null,2));if(sourceChangedSinceStart)throw Error('Projection audit source changed during the run');if(unexpectedCropping.length)throw Error(JSON.stringify(unexpectedCropping));console.log(JSON.stringify({sourceHash,sourceHashAfter,sourceChangedSinceStart,states,samples,points,unexpectedCropping:0,intentionalLowerLegCropping}));
