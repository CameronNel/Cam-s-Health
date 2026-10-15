/* Public, local movement studies. Illustrations never represent a logged set. */
import * as T from './vendor/three.js';
import {exerciseDemos,getExerciseDemo,getExercisePose,exercisePhaseAt} from './exercise-catalogue.js';
import {createExerciseAnatomy} from './exercise-anatomy.js';

const UP = new T.Vector3(0, 1, 0);
const v = p => new T.Vector3(...p);
const mid = (a,b) => a.map((n,i)=>(n+b[i])/2);
const mix = (a,b,t) => a.map((n,i)=>n+(b[i]-n)*t);
let illustrationSerial = 0;

const demoAngles=new Set(['front','side','rear','three-quarter']);
const unilateralSides={
  'cable-lateral-raise':'right','one-arm-cable-row':'right','bulgarian-split-squat':'left',
  'single-leg-db-rdl':'left','step-up':'left','cable-hamstring-curl':'right',
  'single-leg-calf-raise':'left','single-arm-cable-shoulder-press':'right',
  'reverse-db-lunge':'left','single-leg-hip-thrust':'right','cable-leg-extension':'right',
  'single-arm-cable-fly':'right','single-arm-cable-pulldown':'right',
  'single-arm-preacher-curl':'right','hammer-preacher-curl':'right',
  'single-arm-db-overhead-extension':'right','behind-body-cable-curl':'right'
};
/** The authored working side is explicit; a bilateral movement is never relabelled. */
export const exerciseDemoWorkingSide=id=>unilateralSides[id]||null;
export function normalizeDemoControls(value={}){
  return {angle:demoAngles.has(value.angle)?value.angle:'three-quarter',side:value.side==='left'?'left':'right',speed:[.5,1,1.5].includes(Number(value.speed))?Number(value.speed):1,overlay:value.overlay===true||value.overlay==='true'};
}
export function exerciseDemoCamera(pose,angle='three-quarter',side='right'){
  const camera=pose.camera||[2.9,1.8,3.9],target=pose.target||[0,.91,0];
  const radius=Math.hypot(camera[0]-target[0],camera[2]-target[2]);
  if(angle==='front')return [target[0],camera[1],target[2]+radius];
  if(angle==='rear')return [target[0],camera[1],target[2]-radius];
  if(angle==='side')return [target[0]+(side==='left'?-radius:radius),camera[1],target[2]];
  return [target[0]+(side==='left'?-1:1)*Math.abs(camera[0]-target[0]),camera[1],camera[2]];
}
const mirrorPoint=p=>[-p[0],p[1],p[2]];
/** Reflection includes every piece of equipment, including its local rotation. */
export function reflectExercisePose(pose){
  return {...pose,joints:Object.fromEntries(Object.entries(pose.joints).map(([key,p])=>[key,mirrorPoint(p)])),
    camera:pose.camera?mirrorPoint(pose.camera):undefined,
    target:pose.target?mirrorPoint(pose.target):undefined,
    headRotation:pose.headRotation?[pose.headRotation[0],-pose.headRotation[1],-pose.headRotation[2]]:undefined,
    props:pose.props.map(prop=>({...prop,...Object.fromEntries(['from','to','position'].filter(key=>prop[key]).map(key=>[key,mirrorPoint(prop[key])])),...(prop.rotation?{rotation:[prop.rotation[0],-prop.rotation[1],-prop.rotation[2]]}:{})}))};
}
export function projectExercisePoint(point,camera,target,width,height){
  const eye=v(camera),forward=v(target).sub(eye).normalize(),right=new T.Vector3().crossVectors(forward,UP).normalize(),up=new T.Vector3().crossVectors(right,forward).normalize(),rel=v(point).sub(eye);
  const z=rel.dot(forward),scale=(height/2)/Math.tan(16*Math.PI/180)/Math.max(z,.05);
  return [width/2+rel.dot(right)*scale,height/2-rel.dot(up)*scale,z];
}
function displayExercisePose(pose,controls={}){
  const displayed=controls.mirrored?reflectExercisePose(pose):pose;
  return {...displayed,camera:exerciseDemoCamera(displayed,controls.angle,controls.side)};
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

function makeProps(scene) {
  const group=new T.Group();scene.add(group);
  const chrome=new T.MeshPhysicalMaterial({color:0x9299a4,metalness:.93,roughness:.23,clearcoat:.4});
  const rubber=new T.MeshPhysicalMaterial({color:0x313643,metalness:.25,roughness:.45,clearcoat:.23});
  const pad=new T.MeshStandardMaterial({color:0x252b38,metalness:.08,roughness:.72});
  const cableMat=new T.MeshStandardMaterial({color:0x8994a8,metalness:.7,roughness:.35});
  const pipe=new T.CylinderGeometry(1,1,1,24),sphere=new T.SphereGeometry(1,20,12),box=new T.BoxGeometry(1,1,1);
  group.userData.disposableGeometries=[pipe,sphere,box];
  group.userData.disposableMaterials=[chrome,rubber,pad,cableMat];
  let signature=null,entries=[],bucket=null;const cached=new Map();
  const add=(geo,mat)=>{const m=new T.Mesh(geo,mat);m.castShadow=true;bucket.add(m);return m;};
  function reset(props){
    bucket=new T.Group();group.add(bucket);entries=props.map(p=>{
      if(p.kind==='dumbbell')return {rod:add(pipe,chrome),plates:[add(pipe,rubber),add(pipe,rubber)],rings:[add(pipe,chrome),add(pipe,chrome)]};
      if(p.kind==='bench')return {pad:add(box,pad),under:add(box,chrome),legs:[add(pipe,chrome),add(pipe,chrome)]};
      if(p.kind==='box')return {box:add(box,pad),edge:add(box,chrome)};
      if(p.kind==='cable')return {wire:add(pipe,cableMat),pulley:add(sphere,chrome),handle:add(pipe,rubber)};
      return {rod:add(pipe,p.kind==='cuff'?rubber:chrome),supports:p.support?[add(pipe,chrome),add(pipe,chrome)]:[]};
    });
  }
  return props=>{
    const next=props.map(p=>p.kind+(p.support?'s':'')).join(',');
    if(next!==signature){if(bucket)bucket.visible=false;signature=next;const saved=cached.get(next);if(saved){bucket=saved.bucket;entries=saved.entries;bucket.visible=true;}else{reset(props);cached.set(next,{bucket,entries});}}
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

let viewerSerial=0,preparedVisual=null,preparing=null,preparationState='cold',preparationGeneration=0,activeViewer=null;
const seedExercise='db-shoulder-press';

function disposeScene(scene){
  const geometries=new Set(),materials=new Set();
  scene?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));o.userData.disposableGeometries?.forEach(g=>geometries.add(g));o.userData.disposableMaterials?.forEach(m=>materials.add(m));});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
function makeThree(host,descriptor){
  const canvas=document.createElement('canvas');canvas.className='exercise-demo-canvas';canvas.setAttribute('aria-hidden','true');
  let renderer,scene,environment,anatomy,mountHost=host,disposed=false,resourcesDisposed=false,cancelCompilation=null,width=336,height=300;
  try{
    const context=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});if(!context)return null;
    renderer=new T.WebGLRenderer({canvas,context,alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    scene=new T.Scene();const camera=new T.PerspectiveCamera(32,width/height,.05,30);
    environment=studioEnvironment(renderer);if(environment)scene.environment=environment.texture;
    scene.add(new T.HemisphereLight(0xe4e9ff,0x202333,1.55));
    const key=new T.DirectionalLight(0xf4f8ff,2.65);key.position.set(-2.3,4.4,4);key.castShadow=true;key.shadow.mapSize.set(512,512);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.normalBias=.025;key.shadow.bias=-.0004;scene.add(key);
    const rim=new T.DirectionalLight(0xb0a2df,1.65);rim.position.set(2.6,2,-2.2);scene.add(rim);
    const fill=new T.DirectionalLight(0xc8e4ed,1.1);fill.position.set(-3,1,-1);scene.add(fill);
    const floor=new T.Mesh(new T.CircleGeometry(1.7,64),new T.ShadowMaterial({color:0x05060b,opacity:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;scene.add(floor);
    const ring=new T.Mesh(new T.TorusGeometry(1.13,.0025,6,100),new T.MeshBasicMaterial({color:0x9b9eb9,transparent:true,opacity:.16}));ring.rotation.x=Math.PI/2;ring.position.y=-.019;scene.add(ring);
    const model=new T.Group();scene.add(model);
    anatomy=createExerciseAnatomy(T,model,descriptor.muscles);const updateProps=makeProps(model);
    renderer.setSize(width,height,false);host?.append(canvas);
    function apply(pose,controls={}){
      if(disposed)return;
      const w=Math.max(mountHost?.clientWidth||width,1),h=Math.max(mountHost?.clientHeight||height,1);
      if(width!==w||height!==h){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
      const displayed=displayExercisePose(pose,controls);
      model.scale.x=controls.mirrored?-1:1;
      camera.position.set(...displayed.camera);camera.lookAt(...(displayed.target||[0,.91,0]));
      anatomy.update(pose);updateProps(pose.props||[]);
    }
    function releaseResources(){
      if(resourcesDisposed)return;resourcesDisposed=true;
      anatomy.dispose();disposeScene(scene);environment?.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    }
    const visual={
      canvas,id:++viewerSerial,
      isContextLost:()=>disposed||renderer.getContext().isContextLost(),
      attach(next,description){mountHost=next;next.append(canvas);anatomy.setMuscles?.(description.muscles);},
      detach(){canvas.remove();mountHost=null;},
      render(pose,controls){apply(pose,controls);renderer.render(scene,camera);},
      async prepare(){
        // Build every equipment combination once. Geometry/materials and the body rig
        // stay shared, so navigation needs neither a download nor a new GPU context.
        for(const d of exerciseDemos)for(const variant of d.variants?.map(v=>v.id)||[undefined])updateProps(getExercisePose(d.id,0,variant).props);
        const preview=getExercisePose(descriptor.id,0);apply(preview);
        // One combined setup visits every material's shader before the first preview.
        updateProps([{kind:'dumbbell',from:[-.2,1,0],to:[.2,1,0]},{kind:'bench',position:[0,.5,0],size:[.5,.1,1]},{kind:'cable',from:[1,2,0],to:[1,1,0]},{kind:'bar',from:[-1,2,0],to:[1,2,0],support:true},{kind:'cuff',position:[0,.3,0]}]);
        renderer.compile(scene,camera);
        // A cancellable readiness poll avoids Three's uncancellable compileAsync
        // timer retaining materials after a lost context or a terminal page exit.
        const programs=[...(renderer.info.programs||[])];
        const complete=await new Promise(resolve=>{
          let timer=null,settled=false;
          const finish=ready=>{if(settled)return;settled=true;if(timer!==null)clearTimeout(timer);cancelCompilation=null;resolve(ready);};
          const poll=()=>{
            timer=null;
            if(disposed||renderer.getContext().isContextLost())return finish(false);
            if(programs.every(program=>typeof program.isReady!=='function'||program.isReady()))return finish(true);
            timer=setTimeout(poll,16);
          };
          cancelCompilation=()=>finish(false);poll();
        });
        if(complete&&!disposed&&!mountHost){apply(preview);renderer.render(scene,camera);}
        return complete&&!disposed;
      },
      dispose(){if(disposed)return;disposed=true;cancelCompilation?.();canvas.remove();mountHost=null;releaseResources();}
    };
    return visual;
  }catch{anatomy?.dispose();disposeScene(scene);environment?.dispose();renderer?.dispose();renderer?.forceContextLoss();canvas.remove();return null;}
}

/** Eagerly prepare the single reusable viewer; never starts an animation loop. */
export function preloadExerciseDemos(){
  if(preparing)return preparing;
  if(preparationState==='ready'||preparationState==='fallback')return Promise.resolve(preparationState);
  preparationState='preparing';const generation=++preparationGeneration;
  const job=Promise.resolve().then(async()=>{
    if(generation!==preparationGeneration)return 'cancelled';
    if(!preparedVisual)preparedVisual=makeThree(null,getExerciseDemo(seedExercise));
    const visual=preparedVisual;if(!visual){preparationState='fallback';return preparationState;}
    try{
      const ready=await visual.prepare();
      if(preparedVisual===visual&&generation===preparationGeneration){if(ready&&!visual.isContextLost())preparationState='ready';else invalidateVisual(visual);}
    }catch{
      if(preparedVisual===visual){if(activeViewer)preparationState='cold';else{preparedVisual=null;visual.dispose();preparationState='fallback';}}
    }
    return preparationState;
  }).finally(()=>{if(preparing===job)preparing=null;});
  preparing=job;return job;
}
function acquireVisual(host,descriptor){
  if(preparedVisual?.isContextLost()){invalidateVisual(preparedVisual);}
  if(!preparedVisual&&preparationState!=='fallback')preparedVisual=makeThree(null,descriptor);
  if(preparedVisual){preparedVisual.attach(host,descriptor);host.dataset.viewerId=String(preparedVisual.id);return preparedVisual;}
  return makeFallback(host);
}
function releaseVisual(visual){if(visual===preparedVisual)visual.detach();else visual.dispose();}
function invalidateVisual(visual){if(visual===preparedVisual){preparedVisual=null;preparationState='cold';preparationGeneration++;preparing=null;}visual.dispose();}
export function disposePreparedExerciseViewer(){activeViewer?.();activeViewer=null;const visual=preparedVisual;preparedVisual=null;preparationState='cold';preparationGeneration++;preparing=null;visual?.dispose();}
if(typeof window!=='undefined')window.addEventListener('pagehide',event=>{if(!event.persisted)disposePreparedExerciseViewer();});

// A fully articulated, shaded SVG uses the same movement poses when WebGL is unavailable.
function makeFallback(host) {
  const uid='movement-'+(++illustrationSerial),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 420 360');svg.setAttribute('aria-hidden','true');svg.classList.add('exercise-demo-vector');host.append(svg);
  function render(original,controls={}){
    const pose=displayExercisePose(original,controls),width=host.clientWidth||420,height=host.clientHeight||360;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const j=pose.joints,cam=pose.camera||[2.9,1.8,3.9],tar=pose.target||[0,.91,0],project=p=>projectExercisePoint(p,cam,tar,width,height).slice(0,2),a=p=>project(p).map(n=>n.toFixed(2)).join(','),hip=mid(j.hipL,j.hipR),sh=mid(j.shoulderL,j.shoulderR);
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

function makeFormOverlay(host,descriptor){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),cue=document.createElement('p');
  svg.classList.add('exercise-demo-form');svg.setAttribute('aria-hidden','true');
  cue.className='exercise-demo-form-cue';cue.setAttribute('aria-hidden','true');
  cue.textContent=descriptor.cues[1]||descriptor.cues[0];host.append(svg,cue);
  const lower=descriptor.muscles.some(m=>['quads','hamstrings','glutes','calves'].includes(m));
  const neck=descriptor.muscles.includes('neck'),trunk=!lower&&descriptor.muscles.includes('abs');
  const base=neck?['head','neck']:trunk?['chest','waist']:lower?['hip','knee','ankle']:['shoulder','elbow','wrist'];
  const samples=new Map();let signature='';
  function render(pose,controls,variant){
    svg.toggleAttribute('hidden',!controls.overlay);cue.hidden=!controls.overlay;if(!controls.overlay)return;
    const width=host.clientWidth||336,height=host.clientHeight||300;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const displayed=displayExercisePose(pose,controls),target=displayed.target||[0,.91,0];
    const project=point=>projectExercisePoint(point,displayed.camera,target,width,height);
    const sides=exerciseDemoWorkingSide(descriptor.id)?[exerciseDemoWorkingSide(descriptor.id)]:['left','right'];
    const groups=neck||trunk?[base]:sides.map(side=>base.map(name=>name+(side==='left'?'L':'R')));
    const key=variant||'';
    if(!samples.has(key))samples.set(key,Array.from({length:33},(_,i)=>getExercisePose(descriptor.id,exercisePhaseAt(descriptor.id,i/32),variant)));
    const pointString=points=>points.map(point=>{const p=project(point);return `${p[0].toFixed(1)},${p[1].toFixed(1)}`;}).join(' ');
    const next=[width,height,variant,controls.angle,controls.side,controls.mirrored].join(':');
    if(signature!==next){
      signature=next;svg.replaceChildren();
      for(const joints of groups){
        for(const joint of joints.slice(1)){
          const path=document.createElementNS(ns,'polyline');path.classList.add('demo-joint-path');
          path.setAttribute('points',pointString(samples.get(key).map(sample=>controls.mirrored?mirrorPoint(sample.joints[joint]):sample.joints[joint])));svg.append(path);
        }
        const line=document.createElementNS(ns,'polyline');line.classList.add('demo-joint-link');line.dataset.joints=joints.join(',');svg.append(line);
        for(const joint of joints){const dot=document.createElementNS(ns,'circle');dot.classList.add('demo-joint-marker');dot.setAttribute('r','3');dot.dataset.joint=joint;svg.append(dot);}
      }
    }
    svg.querySelectorAll('[data-joints]').forEach(line=>line.setAttribute('points',pointString(line.dataset.joints.split(',').map(name=>displayed.joints[name]))));
    svg.querySelectorAll('[data-joint]').forEach(dot=>{const p=project(displayed.joints[dot.dataset.joint]);dot.setAttribute('cx',p[0]);dot.setAttribute('cy',p[1]);});
  }
  return {render,dispose(){svg.remove();cue.remove();samples.clear();}};
}

export function mountExerciseDemos(root=document) {
  const host=root.querySelector('[data-exercise-demo]');
  if(!host)return ()=>{};
  const descriptor=getExerciseDemo(host.dataset.exerciseDemo);
  if(!descriptor)return ()=>{};
  host.querySelector('.demo-loading')?.remove();
  let disposed=false,raf=0,last=0,elapsed=0,visible=true,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  let variant=host.dataset.variant||descriptor.variants?.[0]?.id||'default';
  const controls=normalizeDemoControls({angle:host.dataset.demoAngleValue,side:host.dataset.demoSideValue,speed:host.dataset.demoSpeedValue,overlay:host.dataset.demoOverlayValue});
  const workingSide=exerciseDemoWorkingSide(descriptor.id);
  const media=matchMedia('(prefers-reduced-motion: reduce)'),toggle=root.querySelector('[data-demo-toggle]'),phaseNode=root.querySelector('[data-demo-phase]');
  const variantButtons=[...root.querySelectorAll('[data-demo-variant]')],angleButtons=[...root.querySelectorAll('[data-demo-angle]')],sideButtons=[...root.querySelectorAll('[data-demo-side]')];
  const scrub=root.querySelector('[data-demo-scrub]'),speedControl=root.querySelector('[data-demo-speed]'),overlayToggle=root.querySelector('[data-demo-overlay]');
  const sideControls=root.querySelector('[data-demo-side-controls]'),sideLabel=root.querySelector('[data-demo-side-label]');
  if(sideControls)sideControls.hidden=!workingSide;
  sideButtons.forEach(button=>{button.disabled=!workingSide;});
  host.dataset.demoUnilateral=String(!!workingSide);
  host.classList.add('exercise-demo-stage');
  activeViewer?.();
  let visual=acquireVisual(host,descriptor);
  const formOverlay=makeFormOverlay(host,descriptor);
  host.dataset.renderer=visual.canvas?'webgl':'svg';
  const cycle=Math.max(Number(descriptor.cycleSeconds)||2.2,1);
  const savedProgress=Number(host.dataset.demoProgressValue);
  if(Number.isFinite(savedProgress))elapsed=Math.max(0,Math.min(savedProgress,99.999999))/100*cycle;
  host.dataset.cycleSeconds=String(cycle);
  const renderControls=()=>({...controls,mirrored:!!workingSide&&controls.side!==workingSide});
  const progress=()=>((elapsed/cycle)%1+1)%1*100;
  function state(){
    host.dataset.demoState=playing?'playing':'paused';
    host.dataset.workingSide=workingSide?controls.side:'both';
    host.dataset.demoAngleValue=controls.angle;host.dataset.demoSideValue=controls.side;host.dataset.demoSpeedValue=String(controls.speed);host.dataset.demoOverlayValue=String(controls.overlay);
    if(toggle){
      toggle.setAttribute('aria-label',playing?'Pause exercise illustration':'Play exercise illustration');toggle.setAttribute('aria-pressed',String(playing));
      toggle.innerHTML=playing?'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><span>Pause</span>':'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7Z"/></svg><span>Play</span>';
    }
    variantButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.demoVariant===variant)));
    angleButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.demoAngle===controls.angle)));
    sideButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.demoSide===controls.side)));
    if(speedControl)speedControl.value=String(controls.speed);
    if(overlayToggle){overlayToggle.setAttribute('aria-pressed',String(controls.overlay));overlayToggle.classList.toggle('is-active',controls.overlay);}
    if(sideLabel)sideLabel.textContent=workingSide?`${controls.side==='left'?'Left':'Right'} side`:'Both sides';
    host.dispatchEvent(new CustomEvent('exercise-demo-state',{bubbles:true,detail:{playing,variant,...controls,progress:progress()}}));
  }
  function draw(){
    if(disposed)return;
    const pose=getExercisePose(descriptor.id,exercisePhaseAt(descriptor.id,elapsed/cycle),variant);
    if(!pose)return;
    const options=renderControls();
    try{visual.render(pose,options);}catch{
      visual.canvas?.removeEventListener('webglcontextlost',onContextLost);invalidateVisual(visual);visual=makeFallback(host);host.dataset.renderer='svg';visual.render(pose,options);
    }
    formOverlay.render(pose,options,variant);
    const label=pose.phaseLabel||'Controlled movement';
    if(host.dataset.phase!==label){host.dataset.phase=label;if(phaseNode)phaseNode.textContent=label;}
    const position=progress();host.style.setProperty('--demo-progress',String(position/100));host.dataset.demoProgressValue=String(position);
    if(scrub){scrub.value=position.toFixed(1);scrub.setAttribute('aria-valuetext',`${Math.round(position)}% through illustration`);}
  }
  function frame(time){
    raf=0;if(disposed||!playing||!visible||document.hidden){last=0;return;}
    if(!last)last=time;
    if(time-last>=1000/30){elapsed+=(time-last)/1000*controls.speed;last=time;draw();}
    raf=requestAnimationFrame(frame);
  }
  function schedule(){if(!disposed&&playing&&visible&&!document.hidden&&!raf){last=0;raf=requestAnimationFrame(frame);}}
  function pauseFrame(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;}
  function onToggle(){playing=!playing;state();if(playing)schedule();else pauseFrame();}
  const onVariant=e=>{variant=e.currentTarget.dataset.demoVariant;host.dataset.variant=variant;elapsed=0;state();draw();};
  const onAngle=e=>{controls.angle=normalizeDemoControls({angle:e.currentTarget.dataset.demoAngle}).angle;state();draw();};
  const onSide=e=>{if(!workingSide)return;controls.side=e.currentTarget.dataset.demoSide==='left'?'left':'right';state();draw();};
  const onSpeed=()=>{controls.speed=normalizeDemoControls({speed:speedControl.value}).speed;state();last=0;};
  const onScrub=()=>{const value=Number(scrub.value);if(!Number.isFinite(value))return;playing=false;pauseFrame();elapsed=Math.max(0,Math.min(value,99.999999))/100*cycle;draw();state();};
  const onOverlay=()=>{controls.overlay=!controls.overlay;state();draw();};
  const onVisibility=()=>{if(document.hidden)pauseFrame();else{draw();schedule();}};
  const onPreference=()=>{if(media.matches){playing=false;state();pauseFrame();}};
  const onContextLost=e=>{
    if(disposed)return;e.preventDefault();
    const old=visual;old.canvas?.removeEventListener('webglcontextlost',onContextLost);visual=makeFallback(host);host.dataset.renderer='svg';invalidateVisual(old);draw();
  };
  const events=[[toggle,'click',onToggle],[speedControl,'change',onSpeed],[scrub,'input',onScrub],[overlayToggle,'click',onOverlay],...variantButtons.map(b=>[b,'click',onVariant]),...angleButtons.map(b=>[b,'click',onAngle]),...sideButtons.map(b=>[b,'click',onSide])];
  events.forEach(([element,event,handler])=>element?.addEventListener(event,handler));
  document.addEventListener('visibilitychange',onVisibility);media.addEventListener('change',onPreference);
  visual.canvas?.addEventListener('webglcontextlost',onContextLost);
  const resize=new ResizeObserver(()=>draw());resize.observe(host);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;if(visible){draw();schedule();}else pauseFrame();},{threshold:.01});intersection.observe(host);
  state();draw();schedule();
  const cleanup=()=>{
    if(disposed)return;disposed=true;pauseFrame();resize.disconnect();intersection.disconnect();formOverlay.dispose();
    events.forEach(([element,event,handler])=>element?.removeEventListener(event,handler));
    document.removeEventListener('visibilitychange',onVisibility);media.removeEventListener('change',onPreference);
    visual.canvas?.removeEventListener('webglcontextlost',onContextLost);releaseVisual(visual);
    if(activeViewer===cleanup)activeViewer=null;
    host.style.removeProperty('--demo-progress');
  };
  activeViewer=cleanup;return cleanup;
}
