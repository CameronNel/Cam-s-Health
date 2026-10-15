import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createExerciseAnatomy} from '../dist/exercise-anatomy.js';
import {exerciseDemos,getExercisePose} from '../dist/exercise-catalogue.js';

test('the decoded figure is one connected surface with valid public mesh indices',()=>{
  const scene=new T.Scene(),anatomy=createExerciseAnatomy(T,scene),mesh=scene.children[0].children.find(o=>o.isSkinnedMesh),geometry=mesh.geometry,n=geometry.attributes.position.count;
  const parents=Int32Array.from({length:n},(_,i)=>i),used=new Set(),find=i=>parents[i]===i?i:parents[i]=find(parents[i]),indices=geometry.index.array;
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i],b=indices[i+1],c=indices[i+2];assert.ok(a<n&&b<n&&c<n);assert.notEqual(a,b);assert.notEqual(b,c);assert.notEqual(a,c);
    const root=find(a);parents[find(b)]=root;parents[find(c)]=root;used.add(a).add(b).add(c);
  }
  assert.equal(new Set([...used].map(find)).size,1,'shoulders, elbows, knees, hands and torso share one skin surface');
  for(const value of geometry.attributes.position.array)assert.ok(Number.isFinite(value));anatomy.dispose();
});

test('baked anatomy skinning stays finite across every authored movement and its extremes',()=>{
  const scene=new T.Scene(),anatomy=createExerciseAnatomy(T,scene),meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  assert.equal(meshes.length,1);const mesh=meshes[0],geometry=mesh.geometry,positions=geometry.attributes.position.array;
  assert.ok(geometry.attributes.position.count<30000,'surface stays within the mobile mesh budget');
  for(let i=0;i<geometry.attributes.skinWeight.count;i++){
    const weights=geometry.attributes.skinWeight;assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<.00001);
  }
  const point=new T.Vector3();
  for(const demo of exerciseDemos)for(const phase of [0,.25,.5,.75]){
    const variants=demo.variants?.map(v=>v.id)||[undefined];
    for(const variant of variants){
      anatomy.update(getExercisePose(demo.id,phase,variant));
      for(let i=0;i<geometry.attributes.position.count;i+=101){point.fromBufferAttribute(geometry.attributes.position,i);mesh.applyBoneTransform(i,point);assert.ok(Number.isFinite(point.x+point.y+point.z),`${demo.id} has finite skinning`);assert.ok(point.length()<4,`${demo.id} keeps the figure in physical bounds`);}
    }
  }
  assert.equal(mesh.geometry,geometry);assert.equal(mesh.geometry.attributes.position.array,positions,'movement does not rebuild vertex buffers');anatomy.dispose();
});

test('changing target muscles reuses the rig and disposal releases its owned resources',()=>{
  const scene=new T.Scene(),anatomy=createExerciseAnatomy(T,scene),mesh=scene.children[0].children.find(o=>o.isSkinnedMesh),geometry=mesh.geometry,material=mesh.material;
  const before=geometry.attributes.color.array.slice();anatomy.setMuscles(['chest','back','biceps','quads']);assert.notDeepEqual(geometry.attributes.color.array,before);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);
  let geometryDisposed=0,materialDisposed=0;geometry.addEventListener('dispose',()=>geometryDisposed++);material.addEventListener('dispose',()=>materialDisposed++);anatomy.dispose();anatomy.dispose();assert.equal(scene.children.length,0);assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);
});
