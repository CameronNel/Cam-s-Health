/* A continuous ceramic anatomy study. Geometry is sculpted once; only its skeleton moves. */
import { anatomyMesh } from './exercise-anatomy-mesh.js';
const cache = new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,t)=>{const q=clamp((t-a)/(b-a),0,1);return q*q*(3-2*q);};
const REST={hip:[0,.96,0],chest:[0,1.30,0],neck:[0,1.57,0],head:[0,1.72,0]};
for(const [s,n] of [['L',-1],['R',1]]){
  REST['shoulder'+s]=[n*.23,1.45,0];REST['elbow'+s]=[n*.39,1.207,.015];REST['wrist'+s]=[n*.51,.966,.035];
  REST['hand'+s]=[n*.550, .886,.042];REST['hip'+s]=[n*.13,.96,0];REST['knee'+s]=[n*.14,.525,0];REST['ankle'+s]=[n*.14,.09,0];REST['toe'+s]=[n*.14,.045,.16];
}
const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const edges=[[0,1],[1,2],[2,0],[0,3],[1,3],[2,3]];
const cases=[[],[0,3,2],[0,1,4],[1,4,2,2,4,3],[1,2,5],[0,3,5,0,5,1],[0,2,5,0,5,4],[5,4,3],[3,4,5],[4,5,0,5,2,0],[1,5,0,5,3,0],[5,2,1],[3,4,2,2,4,1],[4,1,0],[2,3,0],[]];
const defs=[['pelvis','hip','chest',.19],['lowerSpine','hip','chest',.17],['upperSpine','chest','neck',.19],['head','head',null,.10]];
for(const s of ['L','R'])defs.push(['upperArm'+s,'shoulder'+s,'elbow'+s,.080],['forearm'+s,'elbow'+s,'wrist'+s,.060],['hand'+s,'wrist'+s,'hand'+s,.040],['thigh'+s,'hip'+s,'knee'+s,.105],['calf'+s,'knee'+s,'ankle'+s,.070],['foot'+s,'ankle'+s,'toe'+s,.065]);

function sculpt(T){
  if(cache.has(T))return cache.get(T);
  const binary=atob(anatomyMesh.data),buffer=new ArrayBuffer(binary.length),bytes=new Uint8Array(buffer);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const n=anatomyMesh.vertices,positions=new Float32Array(n*3),packedPositions=new Int16Array(buffer,0,n*3);
  for(let i=0;i<positions.length;i++)positions[i]=packedPositions[i]/10000;
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  geometry.setAttribute('normal',new T.Int16BufferAttribute(new Int16Array(buffer,n*6,n*3),3,true));
  geometry.setIndex(new T.Uint16BufferAttribute(new Uint16Array(buffer,n*12,anatomyMesh.indices),1));
  const start=n*12+anatomyMesh.indices*2;
  geometry.setAttribute('skinIndex',new T.Uint8BufferAttribute(new Uint8Array(buffer,start,n*4),4));
  geometry.setAttribute('skinWeight',new T.Uint8BufferAttribute(new Uint8Array(buffer,start+n*4,n*4),4,true));
  const zoneIds=new Uint8Array(buffer,start+n*8,n),zones=Array.from(zoneIds,i=>anatomyMesh.zones[i]);
  geometry.computeBoundingSphere();const result={geometry,zones};cache.set(T,result);return result;
}

export function createExerciseAnatomy(T,scene,muscles=[]){
  const base=sculpt(T),geometry=base.geometry.clone(),colors=new Float32Array(geometry.attributes.position.count*3);
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  const material=new T.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,metalness:.035,roughness:.49,clearcoat:.17,clearcoatRoughness:.48,iridescence:.07,iridescenceIOR:1.28,iridescenceThicknessRange:[140,220]});
  const root=new T.Group(),bones=defs.map(()=>new T.Bone());root.name='continuous-exercise-anatomy';bones.forEach(b=>root.add(b));scene.add(root);
  const up=new T.Vector3(0,1,0),right=new T.Vector3(1,0,0),front=new T.Vector3(0,0,1),dir=new T.Vector3(),xAxis=new T.Vector3(),zAxis=new T.Vector3(),bodyRight=new T.Vector3(),bodyUp=new T.Vector3(),bodyFront=new T.Vector3(),hip=new T.Vector3(),chest=new T.Vector3(),neck=new T.Vector3(),temp=new T.Vector3(),matrix=new T.Matrix4(),q=new T.Quaternion(),headEuler=new T.Euler(),rollQ=new T.Quaternion();
  const bodyQ=new T.Quaternion(),upperQ=new T.Quaternion();
  function frame(b,start,end,facing,foot=false){
    b.position.fromArray(start);dir.fromArray(end).sub(b.position);const length=dir.length();if(length<1e-5)dir.copy(up);else dir.multiplyScalar(1/length);
    if(foot){
      zAxis.copy(dir);xAxis.copy(bodyRight).addScaledVector(zAxis,-bodyRight.dot(zAxis));if(xAxis.lengthSq()<.001)xAxis.copy(right);xAxis.normalize();temp.crossVectors(zAxis,xAxis).normalize();matrix.makeBasis(xAxis,temp,zAxis);
    }else{
      zAxis.copy(facing).addScaledVector(dir,-facing.dot(dir));if(zAxis.lengthSq()<.001)zAxis.copy(bodyUp).addScaledVector(dir,-bodyUp.dot(dir));if(zAxis.lengthSq()<.001)zAxis.copy(front);zAxis.normalize();xAxis.crossVectors(dir,zAxis).normalize();zAxis.crossVectors(xAxis,dir).normalize();matrix.makeBasis(xAxis,dir,zAxis);
    }
    b.quaternion.setFromRotationMatrix(matrix);return length;
  }
  bodyRight.copy(right);bodyUp.copy(up);bodyFront.copy(front);
  defs.forEach(([name,start,end],i)=>{
    if(name==='head'){bones[i].position.fromArray(REST.head);bones[i].quaternion.identity();}
    else frame(bones[i],REST[start],REST[end],front,name.startsWith('foot'));
  });
  root.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones),mesh=new T.SkinnedMesh(geometry,material);mesh.name='sculpted-athletic-figure';mesh.castShadow=true;mesh.frustumCulled=false;root.add(mesh);mesh.bind(skeleton);
  const skin=new T.Color(0xd6dcdf),accent=new T.Color(0xc5c2dd),shorts=new T.Color(0x252b35),shoe=new T.Color(0x727c8c);
  function setMuscles(names=[]){
    const active=new Set(names);for(let i=0;i<base.zones.length;i++){
      const zone=base.zones[i];let c=zone==='shorts'?shorts:zone==='shoe'?shoe:active.has(zone)||(zone==='biceps'&&active.has('triceps'))||(zone==='quads'&&active.has('hamstrings'))?accent:skin;
      colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
    }geometry.attributes.color.needsUpdate=true;
  }
  const handL=[0,0,0],handR=[0,0,0],hipArray=[0,0,0],chestArray=[0,0,0];
  function update(pose){
    const j=pose.joints;hip.fromArray(j.hipL).add(temp.fromArray(j.hipR)).multiplyScalar(.5);chest.fromArray(j.chest||j.neck);neck.fromArray(j.neck);
    bodyRight.fromArray(j.shoulderR).sub(temp.fromArray(j.shoulderL)).normalize();bodyUp.copy(neck).sub(hip).normalize();bodyFront.crossVectors(bodyRight,bodyUp).normalize();bodyRight.crossVectors(bodyUp,bodyFront).normalize();matrix.makeBasis(bodyRight,bodyUp,bodyFront);bodyQ.setFromRotationMatrix(matrix);
    hip.toArray(hipArray);chest.toArray(chestArray);
    for(let side=0;side<2;side++){const s=side?'R':'L',wr=j['wrist'+s],el=j['elbow'+s],hand=s==='L'?handL:handR;if(j['hand'+s]){hand[0]=j['hand'+s][0];hand[1]=j['hand'+s][1];hand[2]=j['hand'+s][2];}else{temp.fromArray(wr).sub(dir.fromArray(el)).normalize().multiplyScalar(.09).add(dir.fromArray(wr));temp.toArray(hand);}}
    for(let i=0;i<defs.length;i++){
      const [name,start,end]=defs[i],b=bones[i];
      if(name==='head'){
        b.position.fromArray(j.head);headEuler.set(pose.headRotation?.[0]||0,pose.headRotation?.[1]||0,pose.headRotation?.[2]||0);b.quaternion.copy(upperQ).multiply(q.setFromEuler(headEuler));continue;
      }
      let a=start==='hip'?hipArray:start==='chest'?chestArray:j[start],z=end==='chest'?chestArray:j[end];
      if(name==='handL')z=handL;else if(name==='handR')z=handR;
      if(!a||!z)continue;
      frame(b,a,z,bodyFront,name.startsWith('foot'));
      if(name==='pelvis')b.quaternion.copy(bodyQ);
      if(name==='upperSpine')upperQ.copy(b.quaternion);
      if(name.startsWith('hand')){
        const roll=Number.isFinite(pose.handRoll)?pose.handRoll:pose.grip==='pronated'?Math.PI/2:pose.grip==='supinated'?-Math.PI/2:0;
        b.quaternion.multiply(rollQ.setFromAxisAngle(up,roll));
      }
    }
    root.updateMatrixWorld(true);skeleton.update();
  }
  let disposed=false;setMuscles(muscles);
  return {update,setMuscles,dispose(){if(disposed)return;disposed=true;root.removeFromParent();skeleton.dispose();geometry.dispose();material.dispose();}};
}
