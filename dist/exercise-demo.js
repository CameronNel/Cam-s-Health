/* Public, local movement studies. Illustrations never represent a logged set. */
import * as T from './vendor/three.js';
import { getExerciseDemo, getExercisePose } from './exercise-catalogue.js';

const UP = new T.Vector3(0, 1, 0);
const v = p => new T.Vector3(...p);
const mid = (a,b) => a.map((n,i)=>(n+b[i])/2);
const mix = (a,b,t) => a.map((n,i)=>n+(b[i]-n)*t);
const attr = value => String(value).replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
let illustrationSerial = 0;

function profile(points, segments=28) {
  return new T.LatheGeometry(points.map(([y,r])=>new T.Vector2(r,y)),segments);
}
function oriented(mesh,from,to,width=1,depth=width) {
  const a=v(from), b=v(to), delta=b.clone().sub(a);
  mesh.position.copy(a.add(b).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(UP,delta.clone().normalize());
  mesh.scale.set(width,delta.length(),depth);
}
function orb(mesh,p,scale) {
  mesh.position.set(...p); mesh.scale.set(...scale);
}
function studioEnvironment(renderer) {
  const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=256;
  const c=canvas.getContext('2d');
  if(!c)return null;
  c.fillStyle='#202332';c.fillRect(0,0,512,256);
  let g=c.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#535566');g.addColorStop(.49,'#252c3b');g.addColorStop(1,'#090b12');c.fillStyle=g;c.fillRect(0,0,512,256);
  const box=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  box(70,28,64,82,'#ffffff');box(348,52,20,132,'#d3ccff');box(440,34,35,96,'#e6f5ff');
  box(214,8,104,28,'#dce5f2');
  const texture=new T.CanvasTexture(canvas); texture.mapping=T.EquirectangularReflectionMapping;
  const pmrem=new T.PMREMGenerator(renderer); const result=pmrem.fromEquirectangular(texture);
  texture.dispose();pmrem.dispose();
  return result;
}

function makeSculpture(scene,muscles=[]) {
  const active=new Set(muscles);
  const skin=new T.MeshPhysicalMaterial({color:0xd9dedf,metalness:.12,roughness:.31,clearcoat:.5,clearcoatRoughness:.3,iridescence:.13,iridescenceIOR:1.3,iridescenceThicknessRange:[120,250]});
  const accent=new T.MeshPhysicalMaterial({color:0xbfb4e8,metalness:.2,roughness:.33,clearcoat:.48,iridescence:.24,iridescenceThicknessRange:[110,260]});
  const shorts=new T.MeshPhysicalMaterial({color:0x222730,metalness:.1,roughness:.61,clearcoat:.15});
  const shoes=new T.MeshStandardMaterial({color:0x6c7280,roughness:.7,metalness:.07});
  const sole=new T.MeshStandardMaterial({color:0xcbd0d5,roughness:.6});
  const seam=new T.MeshStandardMaterial({color:0x4d5263,roughness:.7});
  const sphere=new T.SphereGeometry(1,28,20);
  const upperArmGeo=profile([[-.5,.60],[-.42,.92],[-.20,1], [.08,.88],[.34,.69],[.5,.56]]);
  const forearmGeo=profile([[-.5,.72],[-.36,.95],[-.14,1],[.15,.80],[.5,.52]]);
  const thighGeo=profile([[-.5,.63],[-.30,.81],[-.05,1],[.28,1.02],[.5,.85]]);
  const calfGeo=profile([[-.5,.45],[-.20,.60],[.03,.94],[.26,1],[.5,.66]]);
  const upperBodyGeo=profile([[-.5,.138],[-.34,.145],[-.10,.181],[.16,.213],[.27,.216],[.35,.172],[.43,.099],[.5,.061]]);
  const lowerBodyGeo=profile([[-.5,.145],[-.28,.155],[.12,.149],[.5,.138]]);
  const clothingGeo=profile([[-.5,.88],[-.35,.96],[.25,1],[.5,.88]]);
  const cylinder=new T.CylinderGeometry(1,1,1,24);
  const group=new T.Group();scene.add(group);
  const mesh=(geometry,material)=>{const m=new T.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=false;group.add(m);return m;};
  const mat=(...groups)=>groups.some(g=>active.has(g))?accent:skin;
  const torso={lower:mesh(lowerBodyGeo,mat('abs')),upper:mesh(upperBodyGeo,mat('chest','back')),pelvis:mesh(sphere,shorts)};
  const head={neck:mesh(cylinder,mat('neck')),cranium:mesh(sphere,skin),jaw:mesh(sphere,skin),nose:mesh(sphere,skin),earL:mesh(sphere,skin),earR:mesh(sphere,skin)};
  const body={};
  for(const s of ['L','R']){
    body[s]={
      shoulder:mesh(sphere,mat('shoulders')),upperArm:mesh(upperArmGeo,mat('biceps','triceps')),
      elbow:mesh(sphere,skin),forearm:mesh(forearmGeo,mat('forearms')),wrist:mesh(sphere,skin),hand:mesh(sphere,skin),thumb:mesh(sphere,skin),
      thigh:mesh(thighGeo,mat('quads','hamstrings')),knee:mesh(sphere,skin),calf:mesh(calfGeo,mat('calves')),
      short:mesh(clothingGeo,shorts),hem:mesh(cylinder,seam),shoe:mesh(sphere,shoes),sole:mesh(sphere,sole),
    };
  }
  // A single sculpted chest surface avoids disconnected, armor-like muscle patches.
  const local=(origin,q,offset)=>v(offset).applyQuaternion(q).add(v(origin)).toArray();
  return pose=>{
    const j=pose.joints, hip=mid(j.hipL,j.hipR), shoulder=mid(j.shoulderL,j.shoulderR);
    const waist=j.waist||mix(hip,shoulder,.35);
    oriented(torso.lower,hip,waist,1,.72);
    oriented(torso.upper,waist,j.neck,1,.61);
    orb(torso.pelvis,hip,[.18,.137,.125]);torso.pelvis.quaternion.copy(torso.lower.quaternion);
    const q=torso.upper.quaternion;
    oriented(head.neck,j.neck,mix(j.neck,j.head,.56),.051,.048);
    const hq=q.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(...(pose.headRotation||[0,0,0]))));
    orb(head.cranium,j.head,[.092,.116,.095]);head.cranium.quaternion.copy(hq);
    for(const [key,offset,size] of [
      ['jaw',[0,-.068,.021],[.067,.061,.072]], ['nose',[0,-.009,.091],[.019,.031,.027]],
      ['earL',[-.091,-.006,0],[.017,.034,.018]],['earR',[.091,-.006,0],[.017,.034,.018]],
    ]){orb(head[key],local(j.head,hq,offset),size);head[key].quaternion.copy(hq);}
    for(const s of ['L','R']){
      const b=body[s], sh=j['shoulder'+s],el=j['elbow'+s],wr=j['wrist'+s],hi=j['hip'+s],kn=j['knee'+s],an=j['ankle'+s];
      orb(b.shoulder,sh,[.074,.078,.073]);
      oriented(b.upperArm,el,sh,.066,.067); // Profiles are broad at the shoulder.
      orb(b.elbow,el,[.046,.046,.046]);
      oriented(b.forearm,wr,el,.053,.052);
      orb(b.wrist,wr,[.030,.031,.030]);
      const hand=j['hand'+s]||mix(el,wr,1.30);
      oriented(b.hand,wr,hand,.033,.023);
      // The unit sphere requires half-length scaling, unlike unit-height lathe profiles.
      b.hand.scale.y*=.5;
      const roll=Number.isFinite(pose.handRoll)?pose.handRoll:pose.grip==='pronated'?Math.PI/2:pose.grip==='supinated'?-Math.PI/2:0;
      b.hand.rotateY(roll);
      orb(b.thumb,local(b.hand.position.toArray(),b.hand.quaternion,[(s==='L'?1:-1)*.028,-.007,.009]),[.013,.026,.014]);b.thumb.quaternion.copy(b.hand.quaternion);
      oriented(b.thigh,kn,hi,.096,.091);
      orb(b.knee,kn,[.065,.065,.061]);
      oriented(b.calf,an,kn,.069,.065);
      oriented(b.short,mix(hi,kn,.38),hi,.099,.096);
      oriented(b.hem,mix(hi,kn,.37),mix(hi,kn,.39),.087,.085);
      const toe=j['toe'+s]||[an[0],an[1]-.035,an[2]+.15];
      const direction=v(toe).sub(v(an)),footLength=Math.max(.1,direction.length()/2+.030);
      if(direction.lengthSq()>.0001)b.shoe.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction.normalize());
      const foot=local(mid(an,toe),b.shoe.quaternion,[0,-.013,0]);
      orb(b.shoe,foot,[.058,.051,footLength]);
      orb(b.sole,local(foot,b.shoe.quaternion,[0,-.032,0]),[.061,.019,footLength+.003]);b.sole.quaternion.copy(b.shoe.quaternion);
    }
  };
}

function makeProps(scene) {
  const group=new T.Group();scene.add(group);
  const chrome=new T.MeshPhysicalMaterial({color:0x9299a4,metalness:.93,roughness:.23,clearcoat:.4});
  const rubber=new T.MeshPhysicalMaterial({color:0x313643,metalness:.25,roughness:.45,clearcoat:.23});
  const pad=new T.MeshStandardMaterial({color:0x252b38,metalness:.08,roughness:.72});
  const cableMat=new T.MeshStandardMaterial({color:0x8994a8,metalness:.7,roughness:.35});
  const pipe=new T.CylinderGeometry(1,1,1,24),sphere=new T.SphereGeometry(1,20,12),box=new T.BoxGeometry(1,1,1);
  group.userData.disposableGeometries=[pipe,sphere,box];
  group.userData.disposableMaterials=[chrome,rubber,pad,cableMat];
  let signature='',entries=[];
  const add=(geo,mat)=>{const m=new T.Mesh(geo,mat);m.castShadow=true;group.add(m);return m;};
  function reset(props){
    group.clear();entries=props.map(p=>{
      if(p.kind==='dumbbell')return {rod:add(pipe,chrome),plates:[add(pipe,rubber),add(pipe,rubber)],rings:[add(pipe,chrome),add(pipe,chrome)]};
      if(p.kind==='bench')return {pad:add(box,pad),under:add(box,chrome),legs:[add(pipe,chrome),add(pipe,chrome)]};
      if(p.kind==='box')return {box:add(box,pad),edge:add(box,chrome)};
      if(p.kind==='cable')return {wire:add(pipe,cableMat),pulley:add(sphere,chrome),handle:add(pipe,rubber)};
      return {rod:add(pipe,p.kind==='cuff'?rubber:chrome),supports:p.support?[add(pipe,chrome),add(pipe,chrome)]:[]};
    });
  }
  return props=>{
    const next=props.map(p=>p.kind+(p.support?'s':'')).join(',');if(next!==signature){signature=next;reset(props);}
    props.forEach((p,i)=>{
      const m=entries[i],from=p.from,to=p.to;
      if(p.kind==='dumbbell'){
        oriented(m.rod,from,to,p.radius||.016,p.radius||.016);
        const dir=v(to).sub(v(from)).normalize();
        for(let k=0;k<2;k++){
          const at=k?to:from;
          oriented(m.plates[k],v(at).addScaledVector(dir,-.029).toArray(),v(at).addScaledVector(dir,.029).toArray(),.087,.087);
          oriented(m.rings[k],v(at).addScaledVector(dir,-.010).toArray(),v(at).addScaledVector(dir,.010).toArray(),.092,.092);
        }
      }else if(p.kind==='bench'){
        const pos=p.position||[0,.44,0],size=p.size||[.32,.10,1.1],q=new T.Quaternion().setFromEuler(new T.Euler(...(p.rotation||[0,0,0])));
        m.pad.position.set(...pos);m.pad.scale.set(...size);m.pad.quaternion.copy(q);
        m.under.position.copy(v([0,-size[1]*.6,0]).applyQuaternion(q).add(v(pos)));m.under.scale.set(size[0]*.65,.035,size[2]*.92);m.under.quaternion.copy(q);
        [-.34,.34].forEach((z,k)=>{const top=v([0,-size[1]*.7,z*size[2]]).applyQuaternion(q).add(v(pos));oriented(m.legs[k],[top.x,.025,top.z],top.toArray(),.027,.027);});
      }else if(p.kind==='box'){
        m.box.position.set(...(p.position||[0,.2,0]));m.box.scale.set(...(p.size||[.5,.4,.5]));m.box.rotation.set(...(p.rotation||[0,0,0]));
        m.edge.position.copy(m.box.position);m.edge.position.y+=(p.size?.[1]||.4)*.5+.004;m.edge.scale.set((p.size?.[0]||.5)*1.015,.008,(p.size?.[2]||.5)*1.015);
      }else if(p.kind==='cable'){
        oriented(m.wire,from,to,p.radius||.0035,p.radius||.0035);
        orb(m.pulley,from,[.037,.037,.018]);
        const end=v(to),start=end.clone().add(new T.Vector3(-.04,0,0));oriented(m.handle,start.toArray(),end.clone().add(new T.Vector3(.04,0,0)).toArray(),.014,.014);
      }else if(p.kind==='cuff'){
        m.rod.position.set(...(p.position||[0,0,0]));m.rod.scale.set(p.radius||.061,.037,p.radius||.061);
      }else{
        if(!from||!to)return;
        oriented(m.rod,from,to,p.radius||.021,p.radius||.021);
        m.supports.forEach((support,k)=>{const pt=k?to:from;oriented(support,[pt[0],.025,pt[2]],pt,.023,.023);});
      }
    });
  };
}

function makeThree(host,descriptor) {
  const canvas=document.createElement('canvas');canvas.className='exercise-demo-canvas';canvas.setAttribute('aria-hidden','true');
  let renderer;
  try{
    const context=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});
    if(!context)return null;
    renderer=new T.WebGLRenderer({canvas,context,alpha:true,antialias:true,powerPreference:'low-power'});
  }catch{return null;}
  let scene,environment;
  try{
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  scene=new T.Scene();const camera=new T.PerspectiveCamera(32,1,.05,30);
  environment=studioEnvironment(renderer);if(environment)scene.environment=environment.texture;
  scene.add(new T.HemisphereLight(0xe4e9ff,0x1d2036,1.8));
  const key=new T.DirectionalLight(0xf4f8ff,3.0);key.position.set(-2.3,4.4,4);key.castShadow=true;key.shadow.mapSize.set(512,512);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.normalBias=.025;key.shadow.bias=-.0004;scene.add(key);
  const rim=new T.DirectionalLight(0x9182e4,2.8);rim.position.set(2.6,2,-2.2);scene.add(rim);
  const fill=new T.DirectionalLight(0xc8e4ed,1.6);fill.position.set(-3,1,-1);scene.add(fill);
  const floor=new T.Mesh(new T.CircleGeometry(1.7,64),new T.ShadowMaterial({color:0x05060b,opacity:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;scene.add(floor);
  const ring=new T.Mesh(new T.TorusGeometry(1.13,.0025,6,100),new T.MeshBasicMaterial({color:0x9b9eb9,transparent:true,opacity:.20}));ring.rotation.x=Math.PI/2;ring.position.y=-.019;scene.add(ring);
  const updateBody=makeSculpture(scene,descriptor.muscles),updateProps=makeProps(scene);
  host.append(canvas);
  let width=0,height=0;
  function render(pose){
    const w=Math.max(host.clientWidth,1),h=Math.max(host.clientHeight,1);
    if(width!==w||height!==h){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    camera.position.set(...(pose.camera||[2.9,1.8,3.9]));camera.lookAt(...(pose.target||[0,.91,0]));
    updateBody(pose);updateProps(pose.props||pose.equipment||[]);
    renderer.render(scene,camera);
  }
  function dispose(){
    const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));o.userData.disposableGeometries?.forEach(g=>geometries.add(g));o.userData.disposableMaterials?.forEach(m=>materials.add(m));});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
    environment?.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
  }
  return {render,dispose,canvas};
  }catch{
    const geometry=new Set(),materials=new Set();scene?.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));o.userData.disposableGeometries?.forEach(g=>geometry.add(g));o.userData.disposableMaterials?.forEach(m=>materials.add(m));});
    geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment?.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();return null;
  }
}

// A fully articulated, shaded SVG uses the same movement poses when WebGL is unavailable.
function makeFallback(host) {
  const uid='movement-'+(++illustrationSerial),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 420 360');svg.setAttribute('aria-hidden','true');svg.classList.add('exercise-demo-vector');host.append(svg);
  const pt=(p,camera,target)=>{
    const eye=v(camera),forward=v(target).sub(eye).normalize(),right=new T.Vector3().crossVectors(forward,UP).normalize(),up=new T.Vector3().crossVectors(right,forward).normalize(),rel=v(p).sub(eye);
    const z=rel.dot(forward),scale=590/Math.max(z,.5);return [210+rel.dot(right)*scale,180-rel.dot(up)*scale];
  };
  function render(pose){
    const j=pose.joints,cam=pose.camera||[2.9,1.8,3.9],tar=pose.target||[0,.91,0],project=p=>pt(p,cam,tar),a=p=>project(p).map(n=>n.toFixed(2)).join(','),hip=mid(j.hipL,j.hipR),sh=mid(j.shoulderL,j.shoulderR);
    const line=(from,to,width,paint='skin')=>`<path d="M${a(from)}L${a(to)}" fill="none" stroke="url(#${uid}-${paint})" stroke-width="${width}" stroke-linecap="round"/>`;
    let props='';
    for(const p of pose.props||[]){
      if(p.kind==='bench'||p.kind==='box'){
        const s=p.size||[.4,.15,1],pos=p.position||[0,.4,0],q=new T.Quaternion().setFromEuler(new T.Euler(...(p.rotation||[0,0,0]))),corner=(x,y,z)=>v([x*s[0]/2,y*s[1]/2,z*s[2]/2]).applyQuaternion(q).add(v(pos)).toArray();
        const face=points=>`<polygon points="${points.map(a).join(' ')}" fill="url(#${uid}-gear)" stroke="#747e94" stroke-width=".6"/>`;
        props+=face([corner(-1,1,-1),corner(1,1,-1),corner(1,1,1),corner(-1,1,1)])+face([corner(1,1,-1),corner(1,-1,-1),corner(1,-1,1),corner(1,1,1)])+face([corner(-1,1,1),corner(1,1,1),corner(1,-1,1),corner(-1,-1,1)]);
        if(p.kind==='bench')for(const z of [-.35,.35]){const t=v([0,-s[1]/2,z*s[2]]).applyQuaternion(q).add(v(pos)).toArray();props+=line([t[0],0,t[2]],t,4,'gear');}
      }else if(p.kind==='cuff'){
        const point=project(p.position);props+=`<ellipse cx="${point[0]}" cy="${point[1]}" rx="8" ry="4" fill="none" stroke="#9ca4b9" stroke-width="4"/>`;
      }else if(p.from&&p.to){
        props+=line(p.from,p.to,p.kind==='cable'?1.5:4,'gear');
        if(p.kind==='dumbbell')for(const end of [p.from,p.to])props+=`<circle cx="${project(end)[0]}" cy="${project(end)[1]}" r="9" fill="url(#${uid}-gear)" stroke="#9ca4b7" stroke-width="1.4"/>`;
        if(p.support)for(const end of[p.from,p.to])props+=line([end[0],0,end[2]],end,4,'gear');
      }
    }
    const limb=s=>line(j['hip'+s],j['knee'+s],24)+line(j['knee'+s],j['ankle'+s],15)+line(j['ankle'+s],j['toe'+s],12,'gear')+line(j['hip'+s],mix(j['hip'+s],j['knee'+s],.35),27,'gear');
    const arm=s=>line(j['shoulder'+s],j['elbow'+s],16)+line(j['elbow'+s],j['wrist'+s],12)+line(j['wrist'+s],j['hand'+s]||mix(j['elbow'+s],j['wrist'+s],1.2),9);
    const hc=project(j.head),nc=project(j.neck),headangle=(pose.headRotation?.[2]||0)*180/Math.PI;
    svg.innerHTML=`<defs><linearGradient id="${uid}-skin" gradientUnits="userSpaceOnUse" x1="125" y1="80" x2="285" y2="270"><stop stop-color="#8b81bb"/><stop offset=".3" stop-color="#edf2f0"/><stop offset=".65" stop-color="#bdc9d1"/><stop offset="1" stop-color="#6a708b"/></linearGradient><linearGradient id="${uid}-gear" gradientUnits="userSpaceOnUse" x1="125" y1="60" x2="295" y2="295"><stop stop-color="#252d3c"/><stop offset=".5" stop-color="#757f96"/><stop offset="1" stop-color="#222736"/></linearGradient><radialGradient id="${uid}-floor"><stop stop-color="#aaa3da" stop-opacity=".12"/><stop offset="1" stop-color="#a4a4dc" stop-opacity="0"/></radialGradient></defs><ellipse cx="210" cy="315" rx="148" ry="28" fill="url(#${uid}-floor)"/><ellipse cx="210" cy="309" rx="135" ry="23" fill="none" stroke="#a5a3c6" stroke-opacity=".15"/>${props}${limb('R')}${arm('R')}${line(hip,j.waist||mix(hip,sh,.3),39,'gear')}${line(j.waist||mix(hip,sh,.3),sh,46)}${line(j.shoulderL,j.shoulderR,32)}${line(sh,j.neck,18)}${line(j.neck,j.head,13)}${limb('L')}${arm('L')}<ellipse cx="${hc[0]}" cy="${hc[1]}" rx="13.5" ry="18" fill="url(#${uid}-skin)" transform="rotate(${headangle} ${hc.join(' ')})"/><path d="M${hc[0]+7} ${hc[1]-2}l6 5-7 2" fill="#d6dce2"/>`;
  }
  return {render,dispose:()=>svg.remove()};
}

export function mountExerciseDemos(root=document) {
  const host=root.querySelector('[data-exercise-demo]');
  if(!host)return ()=>{};
  const descriptor=getExerciseDemo(host.dataset.exerciseDemo);
  if(!descriptor)return ()=>{};
  host.querySelector('.demo-loading')?.remove();
  let disposed=false,raf=0,last=0,elapsed=0,visible=true,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  let variant=host.dataset.variant||descriptor.variants?.[0]?.id||'default';
  const media=matchMedia('(prefers-reduced-motion: reduce)'),toggle=root.querySelector('[data-demo-toggle]'),phaseNode=root.querySelector('[data-demo-phase]');
  const variantButtons=[...root.querySelectorAll('[data-demo-variant]')];
  host.classList.add('exercise-demo-stage');
  let visual=makeThree(host,descriptor)||makeFallback(host);
  host.dataset.renderer=visual.canvas?'webgl':'svg';
  const cycle=Math.max(Number(descriptor.cycleSeconds||descriptor.durationSeconds||(descriptor.durationMs/1000))||5.8,3);
  function state(){
    host.dataset.demoState=playing?'playing':'paused';
    if(toggle){
      toggle.setAttribute('aria-label',playing?'Pause exercise illustration':'Play exercise illustration');toggle.setAttribute('aria-pressed',String(playing));
      toggle.innerHTML=playing?'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><span>Pause</span>':'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7Z"/></svg><span>Play</span>';
    }
    variantButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.demoVariant===variant)));
    host.dispatchEvent(new CustomEvent('exercise-demo-state',{bubbles:true,detail:{playing,variant}}));
  }
  function draw(){
    if(disposed)return;
    const pose=getExercisePose(descriptor.id,(elapsed/cycle)%1,variant);
    if(!pose)return;
    try{visual.render(pose);}catch{
      visual.canvas?.removeEventListener('webglcontextlost',onContextLost);visual.dispose();visual=makeFallback(host);host.dataset.renderer='svg';visual.render(pose);
    }
    const label=pose.phaseLabel||'Controlled movement';
    if(host.dataset.phase!==label){host.dataset.phase=label;if(phaseNode)phaseNode.textContent=label;}
    host.style.setProperty('--demo-progress',String((elapsed/cycle)%1));
  }
  function frame(time){
    raf=0;if(disposed||!playing||!visible||document.hidden){last=0;return;}
    if(!last)last=time;
    if(time-last>=1000/24){elapsed+=Math.min((time-last)/1000,.12);last=time;draw();}
    raf=requestAnimationFrame(frame);
  }
  function schedule(){if(!disposed&&playing&&visible&&!document.hidden&&!raf){last=0;raf=requestAnimationFrame(frame);}}
  function pauseFrame(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
  function onToggle(){playing=!playing;state();if(playing)schedule();else pauseFrame();}
  const onVariant=e=>{variant=e.currentTarget.dataset.demoVariant;host.dataset.variant=variant;elapsed=0;state();draw();};
  const onVisibility=()=>{if(document.hidden)pauseFrame();else{draw();schedule();}};
  const onPreference=()=>{if(media.matches){playing=false;state();pauseFrame();}};
  const onContextLost=e=>{
    if(disposed)return;e.preventDefault();
    const old=visual;old.canvas?.removeEventListener('webglcontextlost',onContextLost);visual=makeFallback(host);host.dataset.renderer='svg';old.dispose();draw();
  };
  toggle?.addEventListener('click',onToggle);variantButtons.forEach(b=>b.addEventListener('click',onVariant));
  document.addEventListener('visibilitychange',onVisibility);media.addEventListener('change',onPreference);
  visual.canvas?.addEventListener('webglcontextlost',onContextLost);
  const resize=new ResizeObserver(()=>draw());resize.observe(host);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;if(visible){draw();schedule();}else pauseFrame();},{threshold:.01});intersection.observe(host);
  state();draw();schedule();
  return ()=>{
    disposed=true;pauseFrame();resize.disconnect();intersection.disconnect();
    toggle?.removeEventListener('click',onToggle);variantButtons.forEach(b=>b.removeEventListener('click',onVariant));
    document.removeEventListener('visibilitychange',onVisibility);media.removeEventListener('change',onPreference);
    visual.canvas?.removeEventListener('webglcontextlost',onContextLost);visual.dispose();
    host.style.removeProperty('--demo-progress');
  };
}
