import * as T from 'three';
import {writeFile} from 'node:fs/promises';
import {buildExerciseAnatomyMesh} from './exercise-anatomy-source.mjs';
const {geometry,zones}=buildExerciseAnatomyMesh(T),n=geometry.attributes.position.count,indexCount=geometry.index.count;
if(n>65535)throw new Error('Anatomy mesh exceeds the public Uint16 index format.');
const buffer=new ArrayBuffer(n*21+indexCount*2),positions=new Int16Array(buffer,0,n*3),normals=new Int16Array(buffer,n*6,n*3),indices=new Uint16Array(buffer,n*12,indexCount),offset=n*12+indexCount*2,skinIndex=new Uint8Array(buffer,offset,n*4),skinWeight=new Uint8Array(buffer,offset+n*4,n*4),zoneIds=new Uint8Array(buffer,offset+n*8,n),zoneNames=[...new Set(zones)];
for(let i=0;i<n;i++){
  for(let a=0;a<3;a++){positions[i*3+a]=Math.round(geometry.attributes.position.array[i*3+a]*10000);normals[i*3+a]=Math.round(geometry.attributes.normal.array[i*3+a]*32767);}
  let total=0;for(let a=0;a<4;a++){skinIndex[i*4+a]=geometry.attributes.skinIndex.array[i*4+a];skinWeight[i*4+a]=Math.round(geometry.attributes.skinWeight.array[i*4+a]*255);total+=skinWeight[i*4+a];}
  skinWeight[i*4]+=255-total;zoneIds[i]=zoneNames.indexOf(zones[i]);
}
indices.set(geometry.index.array);
const data=Buffer.from(buffer).toString('base64');
await writeFile('dist/exercise-anatomy-mesh.js','/* Build-time sculpted anatomy. Regenerate with node scripts/build-exercise-anatomy.mjs. */\nexport const anatomyMesh = '+JSON.stringify({vertices:n,indices:indexCount,zones:zoneNames,data})+';\n');
console.log(`Baked continuous exercise anatomy: ${n.toLocaleString()} vertices, ${(indexCount/3).toLocaleString()} triangles.`);
geometry.dispose();
