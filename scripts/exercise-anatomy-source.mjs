/* A continuous ceramic anatomy study. Geometry is sculpted once; only its skeleton moves. */
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

export function buildExerciseAnatomyMesh(T){
  if(cache.has(T))return cache.get(T);
  const primitives=[];
  const ell=(c,r,k=.037)=>primitives.push({type:0,c,r,k});
  const cap=(a,b,r,k=.028)=>{const d=b.map((v,i)=>v-a[i]),len=d.reduce((n,v)=>n+v*v,0);primitives.push({type:1,a,d,len,r,k});};
  const swell=(a,b,radii,k=.025)=>{
    const axis=new T.Vector3().fromArray(b).sub(new T.Vector3().fromArray(a)).normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis).invert();
    primitives.push({type:2,c:a.map((v,i)=>(v+b[i])*.5),r:radii,k,q:[q.x,q.y,q.z,q.w]});
  };
  // Ribcage, abdomen, pelvis, trapezius and neck blend into a single uninterrupted surface.
  ell([0,1.337,-.008],[.193,.226,.112],.065);
  ell([0,1.115,.003],[.137,.19,.103],.057);
  ell([0,.979,-.006],[.173,.137,.120],.052);
  ell([0,1.466,-.009],[.170,.080,.077],.05);
  cap([0,1.47,0],[0,1.655,0],.050,.040);
  for(const [s,n]of[['L',-1],['R',1]]){
    ell([n*.083,1.36,.046],[.104,.102,.078],.048);
    ell([n*.071,.938,-.032],[.105,.104,.101],.044);
    ell([n*.220,1.424,-.002],[.081,.104,.078],.048);
    cap(REST['shoulder'+s],REST['elbow'+s],.051,.034);
    swell([n*.25,1.414,.006],[n*.36,1.249,.017],[.067,.119,.069],.035);
    cap(REST['elbow'+s],REST['wrist'+s],.032,.023);
    swell([n*.399,1.190,.018],[n*.472,1.042,.030],[.050,.106,.047],.029);
    // A narrow wrist leads to a palm and gently curled fingertips, with a distinct radial thumb.
    cap(REST['wrist'+s],REST['hand'+s],.024,.018);
    swell([n*.516,.953,.036],[n*.548,.887,.042],[.035,.047,.020],.017);
    for(let f=0;f<4;f++){
      const spread=(f-1.5)*.015,start=[n*.548+spread,.895,.046],end=[n*.565+spread,.860+(f===0||f===3?.010:0),.062];
      cap(start,end,.009,.004);
    }
    cap([n*.518,.924,.051],[n*.506,.895,.071],.012,.009);
    cap(REST['hip'+s],REST['knee'+s],.067,.039);
    swell([n*.132,.906,-.003],[n*.138,.641,.004],[.094,.178,.088],.039);
    cap(REST['knee'+s],REST['ankle'+s],.042,.031);
    swell([n*.14,.486,-.014],[n*.14,.267,-.009],[.057,.143,.059],.037);
    ell([n*.14,.525,.013],[.061,.067,.055],.037);
    // Real heel and forefoot shapes, with a low, softly rounded training shoe silhouette.
    ell([n*.14,.073,.005],[.052,.051,.069],.021);
    ell([n*.14,.057,.110],[.057,.039,.100],.021);
  }
  // The head is sculpted with a jaw taper, brow, bridge and small ears rather than stacked orbs.
  ell([0,1.739,-.009],[.084,.109,.086],.021);
  ell([0,1.675,.013],[.067,.065,.066],.029);
  ell([0,1.713,.061],[.058,.051,.034],.019);
  ell([0,1.711,.087],[.012,.026,.019],.008);
  ell([0,1.734,.069],[.061,.017,.020],.011);
  for(const n of[-1,1])ell([n*.083,1.719,-.004],[.012,.026,.018],.008);
  function field(x,y,z){
    let value=9;
    for(let i=0;i<primitives.length;i++){
      const p=primitives[i];let d;
      if(p.type===1){
        let ax=x-p.a[0],ay=y-p.a[1],az=z-p.a[2];const t=clamp((ax*p.d[0]+ay*p.d[1]+az*p.d[2])/p.len,0,1);
        ax-=p.d[0]*t;ay-=p.d[1]*t;az-=p.d[2]*t;d=Math.sqrt(ax*ax+ay*ay+az*az)-p.r;
      }else{
        let ax=x-p.c[0],ay=y-p.c[1],az=z-p.c[2];
        if(p.type===2){const q=p.q,tx=2*(q[1]*az-q[2]*ay),ty=2*(q[2]*ax-q[0]*az),tz=2*(q[0]*ay-q[1]*ax);const px=ax+q[3]*tx+q[1]*tz-q[2]*ty,py=ay+q[3]*ty+q[2]*tx-q[0]*tz;az=az+q[3]*tz+q[0]*ty-q[1]*tx;ax=px;ay=py;}
        const rx=p.r[0],ry=p.r[1],rz=p.r[2],k0=Math.sqrt(ax*ax/(rx*rx)+ay*ay/(ry*ry)+az*az/(rz*rz)),k1=Math.sqrt(ax*ax/(rx**4)+ay*ay/(ry**4)+az*az/(rz**4));d=k1>1e-8?k0*(k0-1)/k1:-Math.min(rx,ry,rz);
      }
      const h=Math.max(p.k-Math.abs(value-d),0)/p.k;value=Math.min(value,d)-h*h*p.k*.25;
    }
    return value;
  }
  const step=.016,minX=-.64,minY=-.008,minZ=-.18,nx=81,ny=118,nz=27,total=nx*ny*nz,values=new Float32Array(total);
  const index=(x,y,z)=>(z*ny+y)*nx+x;
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)values[index(x,y,z)]=field(minX+x*step,minY+y*step,minZ+z*step);
  const position=[],indices=[],vertexEdges=new Map();
  const xs=new Float32Array(total),ys=new Float32Array(total),zs=new Float32Array(total);
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const i=index(x,y,z);xs[i]=minX+x*step;ys[i]=minY+y*step;zs[i]=minZ+z*step;}
  const cube=new Int32Array(8),tet=new Int32Array(4),edgeIds=new Int32Array(6);
  function edgeVertex(a,b){
    const lo=Math.min(a,b),hi=Math.max(a,b),key=lo*total+hi;if(vertexEdges.has(key))return vertexEdges.get(key);
    const t=values[a]/(values[a]-values[b]),id=position.length/3;position.push(xs[a]+(xs[b]-xs[a])*t,ys[a]+(ys[b]-ys[a])*t,zs[a]+(zs[b]-zs[a])*t);vertexEdges.set(key,id);return id;
  }
  for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
    cube[0]=index(x,y,z);cube[1]=cube[0]+1;cube[3]=cube[0]+nx;cube[2]=cube[3]+1;cube[4]=cube[0]+nx*ny;cube[5]=cube[4]+1;cube[7]=cube[4]+nx;cube[6]=cube[7]+1;
    let any=0;for(let i=0;i<8;i++)if(values[cube[i]]<0)any++;if(any===0||any===8)continue;
    for(const t of tetrahedra){
      let mask=0;for(let i=0;i<4;i++){tet[i]=cube[t[i]];if(values[tet[i]]<0)mask|=1<<i;}const table=cases[mask];if(!table.length)continue;
      edgeIds.fill(-1);
      for(let i=0;i<table.length;i++){
        const e=table[i];if(edgeIds[e]<0)edgeIds[e]=edgeVertex(tet[edges[e][0]],tet[edges[e][1]]);
      }
      for(let i=0;i<table.length;i+=3){
        let a=edgeIds[table[i]],b=edgeIds[table[i+1]],c=edgeIds[table[i+2]];const ax=position[a*3],ay=position[a*3+1],az=position[a*3+2],bx=position[b*3]-ax,by=position[b*3+1]-ay,bz=position[b*3+2]-az,cx=position[c*3]-ax,cy=position[c*3+1]-ay,cz=position[c*3+2]-az;
        let inside=tet[0];for(let q=0;q<4;q++)if(values[tet[q]]<0){inside=tet[q];break;}
        if((by*cz-bz*cy)*(ax-xs[inside])+(bz*cx-bx*cz)*(ay-ys[inside])+(bx*cy-by*cx)*(az-zs[inside])<0){const q=b;b=c;c=q;}
        indices.push(a,b,c);
      }
    }
  }
  // Weld sub-pixel marching-tetrahedron slivers before smoothing. Six-millimetre cells are
  // smaller than a displayed pixel at phone scale and keep the mobile surface economical.
  const cells=new Map(),remap=new Uint32Array(position.length/3),sums=[],counts=[];
  for(let i=0;i<position.length;i+=3){const key=Math.round(position[i]/.006)+','+Math.round(position[i+1]/.006)+','+Math.round(position[i+2]/.006);let cell=cells.get(key);if(cell===undefined){cell=counts.length;cells.set(key,cell);counts.push(0);sums.push(0,0,0);}remap[i/3]=cell;counts[cell]++;sums[cell*3]+=position[i];sums[cell*3+1]+=position[i+1];sums[cell*3+2]+=position[i+2];}
  for(let i=0;i<counts.length;i++)for(let a=0;a<3;a++)sums[i*3+a]/=counts[i];
  const compact=[];for(let i=0;i<indices.length;i+=3){const a=remap[indices[i]],b=remap[indices[i+1]],c=remap[indices[i+2]];if(a!==b&&b!==c&&a!==c)compact.push(a,b,c);}
  position.length=0;for(const p of sums)position.push(p);indices.length=0;for(const i of compact)indices.push(i);
  // A volume-preserving smoothing pass removes voxel-grid ripples while retaining the sculpted silhouette.
  const neighbors=Array.from({length:position.length/3},()=>new Set());
  for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2];neighbors[a].add(b).add(c);neighbors[b].add(a).add(c);neighbors[c].add(a).add(b);}
  const adjusted=new Float32Array(position.length);
  for(const amount of [.34,-.36,.34,-.36]){
    for(let i=0;i<neighbors.length;i++){let x=0,y=0,z=0;const adjacent=neighbors[i];for(const j of adjacent){x+=position[j*3];y+=position[j*3+1];z+=position[j*3+2];}const n=adjacent.size||1;adjusted[i*3]=position[i*3]+amount*(x/n-position[i*3]);adjusted[i*3+1]=position[i*3+1]+amount*(y/n-position[i*3+1]);adjusted[i*3+2]=position[i*3+2]+amount*(z/n-position[i*3+2]);}
    for(let i=0;i<position.length;i++)position[i]=adjusted[i];
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const skinIndices=[],skinWeights=[],zones=[];
  const nearest=(p,a,b)=>{let t=0;if(b){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy+(p[2]-a[2])*dz)/(dx*dx+dy*dy+dz*dz),0,1);return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy,p[2]-a[2]-t*dz);}return Math.hypot(p[0]-a[0],p[1]-a[1],p[2]-a[2]);};
  for(let i=0;i<position.length;i+=3){
    const p=position.slice(i,i+3),scores=[];
    for(let d=0;d<defs.length;d++){
      const [name,start,end,r]=defs[d];let score=Math.exp(-2.6*(nearest(p,REST[start],end?REST[end]:null)/r)**2);
      if(name==='pelvis')score*=1-smooth(1.02,1.14,p[1]);
      if(name==='lowerSpine')score*=1-smooth(1.20,1.38,p[1]);
      if(name==='upperSpine')score*=smooth(1.18,1.34,p[1]);
      if(name==='head')score*=smooth(1.54,1.66,p[1]);
      if((name.includes('Arm')||name.includes('forearm')||name.includes('hand'))&&((name.endsWith('L')&&p[0]>0)||(name.endsWith('R')&&p[0]<0)))score=0;
      if((name.includes('thigh')||name.includes('calf')||name.includes('foot'))&&((name.endsWith('L')&&p[0]>0)||(name.endsWith('R')&&p[0]<0)))score=0;
      scores.push([d,score]);
    }
    scores.sort((a,b)=>b[1]-a[1]);const sum=scores[0][1]+scores[1][1]+scores[2][1]+scores[3][1]||1;
    for(let k=0;k<4;k++){skinIndices.push(scores[k][0]);skinWeights.push(scores[k][1]/sum);}
    const x=Math.abs(p[0]),y=p[1];let zone='skin';
    if(y<.126&&x<.26)zone='shoe';else if(y<1.042&&y>.772&&x<.25)zone='shorts';
    else if(y>1.56)zone='neck';else if(x>.24&&y>1.17)zone='shoulders';else if(x>.36&&y>1.01)zone='biceps';else if(x>.43&&y>.82)zone='forearms';
    else if(y<.54)zone='calves';else if(y<.79)zone='quads';else if(y>1.25)zone=p[2]>.005?'chest':'back';else zone='abs';zones.push(zone);
  }
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeights,4));
  geometry.computeBoundingSphere();const result={geometry,zones};cache.set(T,result);return result;
}

