/** Public, procedural exercise illustrations. These are technique guides, never logged performance. */
import {extraExerciseDemos,getExtraExercisePose} from './exercise-extra.js';
const define = (id,name,focus,equipment,muscles,cues,extra={}) => Object.freeze({id,name,focus,equipment,muscles:Object.freeze(muscles),cues:Object.freeze(cues),durationMs:5600,cycleSeconds:(extra.durationMs||5600)/1000,...extra});
export const exerciseDemos = Object.freeze([
  define('dips','Dips','Chest · triceps','Stable parallel bars',['chest','triceps'],['Use a stable, rated setup; keep shoulders down.','Lower only through a comfortable, controlled range.','Press the bars away without bouncing or swinging.']),
  define('incline-db-press','Incline DB Press','Upper chest · triceps','Incline bench · dumbbells',['chest','shoulders','triceps'],['Set a modest incline and plant both feet.','Keep wrists stacked over elbows; lower with control.','Press upward without shrugging or flaring the ribs.']),
  define('cable-fly','Cable Fly','Chest','Two chest-height pulleys',['chest'],['Set the handles around chest height.','Keep a soft, steady elbow bend as the arms arc together.','Return slowly; avoid pulling the shoulders behind a comfortable range.']),
  define('cable-lateral-raise','Cable Lateral Raise','Side delts','Low pulley · single handle',['shoulders'],['Stand tall with the cable crossing in front.','Lead out with the upper arm; keep a soft elbow.','Stop around shoulder height and lower without swinging.']),
  define('cable-triceps-pressdown','Cable Triceps Pressdown','Triceps','High pulley · bar',['triceps'],['Keep upper arms beside the torso.','Straighten the elbows without leaning your body onto the bar.','Return the forearms slowly while the upper arms stay still.']),
  define('neck-circuit','Neck Circuit','Controlled neck motion','Light manual resistance',['neck'],['Use only light resistance and a small, comfortable range.','Move slowly through flexion, extension and each side.','Keep the torso still; no neck bridges or forced end ranges.'],{durationMs:16000,variants:[{id:'circuit',label:'Full circuit'},{id:'flexion',label:'Flexion'},{id:'extension',label:'Extension'},{id:'lateral',label:'Each side'}]}),
  define('pull-ups','Pull-ups','Lats · biceps','Overhead pull-up bar',['back','biceps'],['Start from a comfortable overhead hang with an overhand grip.','Draw elbows down to lift your chest toward the bar.','Lower smoothly; keep the legs quiet and avoid kipping.']),
  define('v-bar-pulldown','V-bar Pulldown','Lats · biceps','High pulley · neutral V handle',['back','biceps'],['Sit tall with a close, neutral grip.','Draw the handle toward the upper chest with elbows down.','Let the arms lengthen slowly without rocking the torso.']),
  define('one-arm-cable-row','One-arm Cable Row','Back · biceps','Mid-height pulley · single handle',['back','biceps'],['Use a stable stance and keep the torso square.','Pull the elbow toward the hip without twisting.','Reach forward under control; repeat on the other side.']),
  define('cable-rear-delt-fly','Cable Rear-Delt Fly','Rear delts · upper back','Two shoulder-height pulleys',['shoulders','back'],['Hold the opposite handles with a soft elbow bend.','Open the arms out in a broad arc at shoulder level.','Keep shoulders relaxed and bring the handles back slowly.']),
  define('hammer-curl','Hammer Curl','Biceps · forearms','Dumbbells · neutral grip',['biceps','forearms'],['Keep palms facing in and elbows beside your ribs.','Curl without swinging the shoulders or bending the wrists.','Lower the dumbbells slowly to the start.']),
  define('wrist-flexion-extension','Wrist Flexion + Extension','Forearms','Light dumbbells · bench',['forearms'],['Support the forearms on the thighs; let hands clear the knees.','Use palms up for flexion and palms down for extension.','Move only at the wrists through a small, controlled range.'],{durationMs:10000,variants:[{id:'both',label:'Both movements'},{id:'flexion',label:'Flexion'},{id:'extension',label:'Extension'}]}),
  define('bulgarian-split-squat','Bulgarian Split Squat','Quads · glutes','Stable bench · dumbbells',['quads','glutes'],['Rest the rear foot on a stable, low support.','Lower mostly through the front leg; let the knee follow the toes.','Push through the front foot and keep the pelvis level.']),
  define('single-leg-db-rdl','Single-leg DB RDL','Hamstrings · glutes','Dumbbells',['hamstrings','glutes'],['Keep a soft bend in the standing knee.','Hinge at the hip as the other leg reaches behind; keep hips square.','Stop before the back rounds, then drive the hip forward.']),
  define('step-up','Step-up','Quads · glutes','Stable platform · dumbbells',['quads','glutes'],['Place the whole lead foot on a stable platform.','Drive through that foot to stand tall with a level pelvis.','Step down slowly instead of dropping onto the trailing leg.']),
  define('cable-hamstring-curl','Cable Hamstring Curl','Hamstrings','Low pulley · ankle cuff',['hamstrings'],['Attach the cuff securely and use light support for balance.','Keep the working thigh still while the heel curls behind.','Lower slowly; avoid arching the back or lifting the hip.']),
  define('single-leg-calf-raise','Single-leg Calf Raise','Calves','Stable step · dumbbell · hand support',['calves'],['Keep the ball of the working foot supported and use light hand support.','Rise through the toes without rolling the ankle outward.','Lower the heel slowly through a comfortable range; change sides.']),
  define('cable-crunch','Cable Crunch','Abs','High pulley · rope',['abs'],['Kneel securely and hold the rope beside your head.','Curl the ribs toward the pelvis while the hips stay fairly still.','Uncurl slowly; avoid yanking the rope with the arms.']),
  define('weighted-deficit-push-up','Weighted/Deficit Push-up','Chest · triceps','Stable push-up blocks',['chest','triceps'],['This illustration shows the deficit option on stable handles.','Keep head, trunk and legs aligned as the elbows bend.','Use a comfortable depth and press through the whole hand.'],{variants:[{id:'deficit',label:'Deficit option'}]}),
  define('flat-db-press','Flat DB Press','Chest · triceps','Flat bench · dumbbells',['chest','triceps'],['Plant both feet and keep the upper back supported.','Lower with forearms near vertical and elbows comfortably angled.','Press upward smoothly without bouncing or clashing the weights.']),
  define('single-arm-cable-shoulder-press','Single-arm Cable Shoulder Press','Shoulders · triceps','Low pulley · single handle',['shoulders','triceps'],['Brace your trunk with the handle at shoulder level.','Press overhead without leaning sideways or flaring the ribs.','Lower smoothly; repeat on the other arm.']),
  define('overhead-cable-triceps-extension','Overhead Cable Triceps Extension','Triceps','Low pulley behind · rope',['triceps'],['Face away from the pulley with upper arms beside the head.','Straighten the elbows while keeping the upper arms steady.','Bend the elbows slowly; use a comfortable shoulder position.']),
  define('chin-ups','Chin-ups','Lats · biceps','Overhead bar · underhand grip',['back','biceps'],['Use an underhand grip around shoulder width.','Lift by drawing the elbows down without craning the neck.','Lower under control and keep the legs quiet.']),
  define('lat-pulldown','Lat Pulldown','Lats · upper back','High pulley · wide bar',['back','biceps'],['Use a comfortable overhand grip and keep the torso steady.','Bring the bar in front toward the upper chest.','Control the return overhead; never pull behind the neck.']),
  define('straight-arm-pulldown','Straight-arm Pulldown','Lats','High pulley · bar',['back'],['Use a small hip hinge and a soft, fixed elbow bend.','Sweep the bar toward your thighs without turning it into a pressdown.','Return upward slowly while keeping the ribs controlled.']),
  define('cable-curl','Cable Curl','Biceps','Low pulley · bar',['biceps'],['Keep upper arms near your sides and wrists neutral.','Curl by bending the elbows without leaning back.','Lower slowly until the arms are comfortably lengthened.']),
  define('farmer-hold-dead-hang','Farmer Hold / Dead Hang','Grip · forearms','Dumbbells or a secure overhead bar',['forearms'],['Choose the farmer hold or dead hang; these are static holds.','Keep a firm grip, steady breathing and a comfortable shoulder position.','Stop before grip failure compromises control of the equipment.'],{durationMs:6000,variants:[{id:'farmer-hold',label:'Farmer hold'},{id:'dead-hang',label:'Dead hang'}]}),
  define('reverse-db-lunge','Reverse DB Lunge','Quads · glutes','Dumbbells',['quads','glutes'],['Step one foot back while keeping the front foot planted.','Lower under control and let the front knee track with the toes.','Push through the front foot to return; repeat on the other side.']),
  define('db-rdl','DB RDL','Hamstrings · glutes','Dumbbells',['hamstrings','glutes'],['Soften the knees, then push the hips back.','Keep the dumbbells close as the torso hinges with a long spine.','Stop at your available hamstring range; stand by driving the hips forward.']),
  define('single-leg-hip-thrust','Single-leg Hip Thrust','Glutes','Stable bench · dumbbell',['glutes','hamstrings'],['Support the upper back on a stable bench and plant one foot.','Lift the hips while the free leg stays bent; keep the pelvis level.','Finish with ribs down rather than arching the lower back.']),
  define('cable-leg-extension','Cable Leg Extension','Quads','Low pulley · ankle cuff · bench',['quads'],['Sit with the thigh supported and cuff secured at the ankle.','Straighten the working knee without lifting the thigh.','Bend the knee slowly against the cable; change legs.']),
  define('hanging-leg-raise','Hanging Leg Raise','Abs · hip flexors','Secure overhead bar',['abs'],['Start from a still, comfortable hang.','Raise the legs with control and a small curl of the pelvis.','Lower without swinging; shorten the range if control is lost.']),
  ...extraExerciseDemos.map(d=>Object.freeze({...d,cycleSeconds:d.durationMs/1000}))
]);

const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[–—−]/g,'-').replace(/[^a-z0-9]+/g,' ').trim();
const byId = new Map(exerciseDemos.map(d=>[d.id,d]));
const byName = new Map(exerciseDemos.flatMap(d=>[d.name,...(d.aliases||[])].map(name=>[normalize(name),d])));
const extraIds=new Set(extraExerciseDemos.map(d=>d.id));
// Deliberate aliases only. A custom movement never receives a loosely guessed demonstration.
for (const [alias,id] of [['Dumbbell Romanian Deadlift','db-rdl'],['Dumbbell RDL','db-rdl'],['Single leg dumbbell RDL','single-leg-db-rdl'],['Pull up','pull-ups'],['Pull ups','pull-ups'],['Chin up','chin-ups'],['Chin ups','chin-ups']]) byName.set(normalize(alias),byId.get(id));
export const getExerciseDemo = id => byId.get(id) || null;
export const findExerciseDemo = name => byName.get(normalize(name)) || null;

const PI = Math.PI;
const mix = (a,b,t)=>a+(b-a)*t;
const add = (a,b)=>a.map((v,i)=>v+b[i]);
const sub = (a,b)=>a.map((v,i)=>v-b[i]);
const mul = (a,k)=>a.map(v=>v*k);
const dot = (a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const length = a=>Math.hypot(...a);
const unit = a=>mul(a,1/(length(a)||1));
const blend = (a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
const sides = [['L',-1],['R',1]];
// Two-bone IK keeps the mannequin's limb lengths fixed rather than stretching at the endpoints.
function jointBetween(start,end,a,b,bend){
  const delta=sub(end,start),actual=length(delta),dir=unit(delta),d=clamp(actual,Math.abs(a-b)+.0001,a+b-.0001);
  const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  let normal=sub(bend,mul(dir,dot(bend,dir)));
  if(length(normal)<.001)normal=sub([1,0,0],mul(dir,dir[0]));
  return add(add(start,mul(dir,along)),mul(unit(normal),height));
}
function body(hip=[0,.96,0],lean=0){
  const axis=[0,Math.cos(lean),Math.sin(lean)],at=h=>add(hip,mul(axis,h));
  const j={waist:at(.08),chest:at(.34),neck:at(.61),head:at(.76)};
  for(const [s,n] of sides){j['hip'+s]=add(hip,[n*.13,0,0]);j['shoulder'+s]=add(at(.49),[n*.23,0,0]);}
  return j;
}
function arm(j,s,end,bend=[0,0,1]){
  const shoulder=j['shoulder'+s],delta=sub(end,shoulder),d=length(delta);
  // All authored targets fit the limb. Guard tiny numeric overshoots near full extension.
  const wrist=d>.5599?add(shoulder,mul(delta,.5599/d)):end;
  j['elbow'+s]=jointBetween(shoulder,wrist,.29,.27,bend);j['wrist'+s]=wrist;
}
function leg(j,s,end,bend=[0,0,1]){
  const hip=j['hip'+s],delta=sub(end,hip),d=length(delta);
  const ankle=d>.8699?add(hip,mul(delta,.8699/d)):end;
  j['knee'+s]=jointBetween(hip,ankle,.435,.435,bend);j['ankle'+s]=ankle;j['toe'+s]=add(ankle,[0,-.045,.16]);
}
function standing(hip=[0,.96,0],lean=0){
  const j=body(hip,lean);
  for(const [s,n] of sides){leg(j,s,[n*.14,.09,0]);arm(j,s,add(j['shoulder'+s],[n*.015,-.548,.025]),[n,0,.3]);}
  return j;
}
function seated(hip=[0,.61,0],lean=0){
  const j=body(hip,lean);
  for(const [s,n] of sides){j['knee'+s]=[n*.15,.56,.43];j['ankle'+s]=[n*.15,.125,.43];j['toe'+s]=[n*.15,.08,.60];arm(j,s,[n*.27,.84,.28],[n,0,1]);}
  return j;
}
const bar=(from,to,radius=.018,extra={})=>({kind:'bar',from,to,radius,...extra});
const cable=(from,to)=>({kind:'cable',from,to,radius:.003});
const box=(position,size,extra={})=>({kind:'box',position,size,...extra});
const bench=(position=[0,.50,-.10],size=[.55,.12,.8],rotation=[0,0,0])=>({kind:'bench',position,size,rotation});
const dumbbell=(point,axis=[1,0,0])=>({kind:'dumbbell',from:add(point,mul(axis,-.13)),to:add(point,mul(axis,.13)),radius:.018});
function palm(j,s){const wrist=j['wrist'+s];return j['hand'+s]?blend(wrist,j['hand'+s],.5):add(wrist,mul(unit(sub(wrist,j['elbow'+s])),.045));}
function weights(j,axis=[1,0,0]){return sides.map(([s])=>dumbbell(palm(j,s),axis));}
function rack(height=2.06,width=1.12,z=0){return [bar([-width/2,height,z],[width/2,height,z],.024,{support:true})];}
function pulley(p,hand){return [bar([p[0],.04,p[2]],[p[0],2.05,p[2]],.025),cable(p,hand)];}
function feetOnFloor(j,z=.46){for(const [s,n]of sides)leg(j,s,[n*.23,.09,z]);}
function restArm(j,s){const n=s==='L'?-1:1;arm(j,s,add(j['shoulder'+s],[n*.02,-.548,.03]),[n,0,.3]);}
function downWeights(j){for(const [s,n]of sides)arm(j,s,add(j['shoulder'+s],[n*.015,-.548,0]),[n,0,.25]);return weights(j);}
function hanging(w=0,grip=.39){
  const j=body([0,1.0+.36*w,0],.015);
  for(const [s,n]of sides){arm(j,s,[n*grip,2.01,.01],[n,-.5,.25]);leg(j,s,[n*.13,.24+.36*w,-.32],[0,0,.8]);j['toe'+s]=add(j['ankle'+s],[0,-.04,.15]);}
  return j;
}
function curls(w,mode='hammer'){
  const j=standing(),a=mix(.10,2.35,w);
  for(const [s,n]of sides){const e=[n*.25,1.17,.03];j['elbow'+s]=e;j['wrist'+s]=add(e,[0,-.27*Math.cos(a),.27*Math.sin(a)]);}
  return {j,props:mode==='hammer'?weights(j,[0,0,1]):[bar(j.wristL,j.wristR),...pulley([0,.1,.85],blend(j.wristL,j.wristR,.5))]};
}

/** phase is one complete controlled loop, normalized to [0,1). Positions are metres, y up, z forward. */
export function getExercisePose(id,phase=0,variant){
  const demo=getExerciseDemo(id);if(!demo)return null;
  if(extraIds.has(id))return getExtraExercisePose(id,phase,variant,getExercisePose);
  const p=((Number.isFinite(phase)?phase:0)%1+1)%1,w=.5-.5*Math.cos(p*2*PI);
  let j,props=[],camera=[2.65,1.8,3.75],target=[0,1.0,0],phaseLabel=p<.5?'Move with control':'Return slowly',headRotation=[0,0,0],grip='neutral',handRoll=null;
  switch(id){
    case 'dips':{
      j=body([0,1.08-.27*w,0],.10);
      for(const [s,n]of sides){arm(j,s,[n*.36,1.04,.015],[0,0,-1]);leg(j,s,[n*.13,.36-.27*w,-.39],[0,0,1]);props.push(bar([n*.36,1.04,-.45],[n*.36,1.04,.45],.027,{support:true}));}
      phaseLabel=p<.5?'Lower with control':'Press upward';camera=[3.1,1.6,3.7];break;
    }
    case 'incline-db-press':
    case 'flat-db-press':{
      const incline=id==='incline-db-press';
      j=body([0,incline?.59:.67,.05],incline?-PI/3:-PI/2);feetOnFloor(j,.53);
      for(const [s,n]of sides){const sh=j['shoulder'+s];arm(j,s,[n*mix(.47,.15,w),sh[1]+mix(.10,.53,w),sh[2]+mix(.06,0,w)],[n,-1,.1]);}
      props=[bench([0,incline?.65:.50,-.24],[.55,.12,1.30],incline?[PI/6,0,0]:[0,0,0]),...weights(j)];
      target=[0,.78,-.12];camera=[2.6,1.8,3.5];phaseLabel=p<.5?'Press upward':'Lower with control';break;
    }
    case 'cable-fly':
    case 'cable-rear-delt-fly':{
      const rear=id==='cable-rear-delt-fly';j=standing();const a=rear?mix(1.98,.12,w):mix(.15,1.96,w);
      for(const [s,n]of sides){const sh=j['shoulder'+s],hand=[sh[0]+n*.51*Math.cos(a),sh[1]-.035,sh[2]+.51*Math.sin(a)];arm(j,s,hand,[n,-.3,-.2]);props.push(...pulley([rear?-n*1.0:n*1.0,1.42,rear?.90:-.35],j['wrist'+s]));}
      phaseLabel=p<.5?(rear?'Open the arms':'Bring the handles together'):'Return slowly';camera=[2.65,1.9,3.9];break;
    }
    case 'cable-lateral-raise':{
      j=standing();const a=mix(.08,PI/2,w),sh=j.shoulderR;
      arm(j,'R',[sh[0]+.53*Math.sin(a),sh[1]-.53*Math.cos(a),.035],[0,0,.5]);
      arm(j,'L',[-.34,1.04,-.02],[-1,0,0]);props=pulley([-.70,.12,.15],j.wristR);
      phaseLabel=p<.5?'Raise to shoulder level':'Lower slowly';break;
    }
    case 'cable-triceps-pressdown':{
      j=standing();const a=mix(2.05,.12,w);
      for(const [s,n]of sides){j['elbow'+s]=[n*.23,1.17,.055];j['wrist'+s]=add(j['elbow'+s],[0,-.27*Math.cos(a),.27*Math.sin(a)]);}
      props=[bar(j.wristL,j.wristR),...pulley([0,2.04,.65],blend(j.wristL,j.wristR,.5))];
      phaseLabel=p<.5?'Straighten the elbows':'Bend the elbows slowly';camera=[2.8,1.8,3.7];break;
    }
    case 'neck-circuit':{
      j=standing();let mode=variant||'circuit',local=p;if(mode==='lateral')local=(p*2)%1;
      if(!['flexion','extension','lateral'].includes(mode)){const segment=Math.min(3,Math.floor(p*4));mode=['flexion','extension','lateral-left','lateral-right'][segment];local=(p*4)%1;}
      const small=.5-.5*Math.cos(local*2*PI),a=.23*small;
      const lateral=mode.startsWith('lateral');
      if(lateral){const side=mode==='lateral-left'?-1:mode==='lateral-right'?1:(p<.5?-1:1);const angle=side*a;headRotation=[0,0,-angle];j.head=add(j.neck,[Math.sin(angle)*.15,Math.cos(angle)*.15,0]);const s=side<0?'L':'R';const resting=add(j['shoulder'+s],[side*.015,-.548,.025]);arm(j,s,blend(resting,add(j.head,[side*.105,.005,0]),small),[side,0,.8]);phaseLabel=angle<0?'Gentle left lateral flexion':'Gentle right lateral flexion';}
      else{const angle=(mode==='flexion'?1:-1)*a;headRotation=[angle,0,0];j.head=add(j.neck,[0,Math.cos(angle)*.15,Math.sin(angle)*.15]);const resting=add(j.shoulderR,[.015,-.548,.025]);arm(j,'R',blend(resting,add(j.head,[.07,0,mode==='flexion'?.105:-.105]),small),[1,0,.6]);phaseLabel=mode==='flexion'?'Gentle neck flexion':'Gentle neck extension';}
      camera=[2.1,1.65,3.05];target=[0,1.36,0];break;
    }
    case 'pull-ups':
    case 'chin-ups':{
      j=hanging(w,id==='chin-ups'?.25:.40);props=rack();grip=id==='chin-ups'?'supinated':'pronated';
      phaseLabel=p<.5?'Pull the elbows down':'Lower with control';target=[0,1.2,0];camera=[2.7,1.9,4];break;
    }
    case 'v-bar-pulldown':
    case 'lat-pulldown':{
      const close=id==='v-bar-pulldown';j=seated([0,.61,0],-.08);
      for(const [s,n]of sides)arm(j,s,[n*(close?.14:.46),mix(1.62,1.13,w),mix(.14,.21,w)],[n,-1,.15]);
      const middle=blend(j.wristL,j.wristR,.5);props=[bench([0,.53,-.05],[.55,.12,.65]),...pulley([0,2.04,.45],middle)];
      if(close){props.push(bar(j.wristL,add(middle,[0,-.07,.02])),bar(add(middle,[0,-.07,.02]),j.wristR));}else props.push(bar(j.wristL,j.wristR));
      phaseLabel=p<.5?'Pull toward the upper chest':'Lengthen the arms slowly';grip=close?'neutral':'pronated';target=[0,.99,.1];break;
    }
    case 'one-arm-cable-row':{
      j=standing([0,.96,0],.10);arm(j,'R',[.25,mix(1.23,1.16,w),mix(.57,.015,w)],[.6,-.4,-1]);arm(j,'L',[-.24,.99,.27],[-1,0,.5]);
      props=pulley([.36,1.14,1.06],j.wristR);phaseLabel=p<.5?'Draw the elbow toward the hip':'Reach forward slowly';camera=[3.6,1.75,3.3];break;
    }
    case 'hammer-curl':
    case 'cable-curl':{
      const result=curls(w,id==='hammer-curl'?'hammer':'cable');j=result.j;props=result.props;grip=id==='hammer-curl'?'neutral':'supinated';phaseLabel=p<.5?'Curl without swinging':'Lower with control';break;
    }
    case 'wrist-flexion-extension':{
      j=seated([0,.61,0],.10);const mode=variant||'both';let extension=mode==='extension',local=p;
      if(mode==='both'){extension=p>=.5;local=(p*2)%1;}
      const turning=mode==='both'?clamp((local-.7)/.3,0,1):0;const smooth=turning*turning*(3-2*turning);
      const a=Math.sin((mode==='both'?Math.min(local/.7,1):local)*2*PI)*.38;
      handRoll=extension?PI/2-PI*smooth:-PI/2+PI*smooth;
      for(const [s,n]of sides){j['elbow'+s]=[n*.24,.84,.18];j['wrist'+s]=[n*.24,.84,.45];j['hand'+s]=[n*.24,.84+.115*Math.sin(a),.45+.115*Math.cos(a)];}
      props=[bench([0,.53,-.04],[.60,.12,.6]),...weights(j)];grip=extension?'pronated':'supinated';phaseLabel=turning>0?(extension?'Turn the palms up':'Turn the palms down'):(extension?'Palms down · wrist extension':'Palms up · wrist flexion');
      target=[0,.84,.18];camera=[1.6,1.36,2.1];break;
    }
    case 'bulgarian-split-squat':{
      j=body([0,.88-.26*w,.12+.035*w],.10);leg(j,'L',[-.14,.09,.42]);leg(j,'R',[.14,.47,-.48],[0,0,1]);j.toeR=[.14,.43,-.62];
      props=[bench([0,.39,-.56],[.78,.16,.42]),...downWeights(j)];phaseLabel=p<.5?'Lower through the front leg':'Drive through the front foot';camera=[3.8,1.75,3.25];break;
    }
    case 'single-leg-db-rdl':{
      const a=.04+1.12*w;j=body([0,.95-.035*w,-.09*w],a);leg(j,'L',[-.13,.09,0]);
      const hip=j.hipR;leg(j,'R',add(hip,[0,-.855*Math.cos(a),-.855*Math.sin(a)]),[0,0,1]);j.toeR=add(j.ankleR,[0,-.06,-.14]);props=downWeights(j);
      phaseLabel=p<.5?'Hinge as the free leg reaches back':'Stand through the supporting hip';camera=[3.8,1.65,3.0];break;
    }
    case 'step-up':{
      j=body([0,.88+.34*w,.04+.22*w],.055);leg(j,'L',[-.14,.43,.36]);leg(j,'R',[.14,.09+.34*w,-.16+.44*w],[0,0,1]);props=[box([0,.175,.40],[.64,.35,.58]),...downWeights(j)];
      phaseLabel=p<.5?'Drive through the lead foot':'Step down with control';target=[0,1.0,.12];camera=[3.55,1.8,3.8];break;
    }
    case 'cable-hamstring-curl':{
      j=standing();const a=1.7*w;j.kneeR=[.14,.525,0];j.ankleR=[.14,.525-.435*Math.cos(a),-.435*Math.sin(a)];j.toeR=add(j.ankleR,[0,-.08,-.12]);
      arm(j,'L',[-.60,1.24,.02],[-1,0,.4]);props=[...pulley([.14,.13,.94],j.ankleR),bar([-.60,.05,.02],[-.60,1.32,.02],.024),{kind:'cuff',position:j.ankleR,radius:.065}];
      phaseLabel=p<.5?'Curl the heel behind':'Lower the foot slowly';camera=[3.7,1.65,3.3];break;
    }
    case 'single-leg-calf-raise':{
      const rise=.085*w;j=body([0,1.075+rise,0],0);leg(j,'L',[-.13,.215+rise,0]);j.toeL=[-.13,.145,.14];leg(j,'R',[.14,.48+rise,-.15],[0,0,1]);
      arm(j,'L',[-.62,1.3+rise,.01],[-1,0,.2]);restArm(j,'R');props=[box([-.13,.05,.08],[.40,.1,.36]),bar([-.63,.04,.02],[-.63,1.5,.02]),dumbbell(j.wristR)];
      phaseLabel=p<.5?'Rise through the toes':'Lower the heel slowly';target=[0,1.02,0];camera=[3.4,1.75,3.6];break;
    }
    case 'cable-crunch':{
      j=body([0,.47,0],.10+.55*w);
      for(const [s,n]of sides){j['knee'+s]=[n*.15,.09,.21];j['ankle'+s]=[n*.15,.09,-.225];j['toe'+s]=[n*.15,.045,-.385];arm(j,s,add(j.neck,[n*.15,-.015,.06]),[n,0,.2]);}
      // Upper-trunk flexion and a tucked head, rather than pulling down with the arms.
      j.chest=add(j.waist,[0,.25-.035*w,.06+.12*w]);j.head=add(j.neck,[0,.15-.035*w,.035+.055*w]);headRotation=[.15+.25*w,0,0];
      props=pulley([0,2.05,-.52],blend(j.wristL,j.wristR,.5));props.push(bar(j.wristL,j.wristR,.012));phaseLabel=p<.5?'Curl the ribs toward the pelvis':'Uncurl slowly';target=[0,.85,0];camera=[3.6,1.6,3.0];break;
    }
    case 'weighted-deficit-push-up':{
      j=body([0,.48-.19*w,-.20],1.12+.21*w);
      for(const [s,n]of sides){leg(j,s,[n*.13,.10,-.96],[0,1,0]);j['toe'+s]=[n*.13,.045,-.85];arm(j,s,[n*.34,.225,.36],[n,-1,-.2]);j['hand'+s]=[n*.34,.19,.45];props.push(box([n*.34,.09,.36],[.17,.18,.27]));}
      grip='pronated';phaseLabel=p<.5?'Lower between the supports':'Press upward as one unit';camera=[3.7,1.55,3.4];target=[0,.50,-.10];break;
    }
    case 'single-arm-cable-shoulder-press':{
      j=standing();arm(j,'R',[mix(.40,.25,w),mix(1.45,1.995,w),mix(.10,.025,w)],[1,0,.05]);restArm(j,'L');props=pulley([.67,.12,-.44],j.wristR);
      phaseLabel=p<.5?'Press overhead':'Lower to shoulder level';target=[0,1.10,0];camera=[2.9,1.9,4.0];break;
    }
    case 'overhead-cable-triceps-extension':{
      j=standing();const a=mix(1.15,PI-.04,w);
      for(const [s,n]of sides){j['elbow'+s]=[n*.20,1.73,0];j['wrist'+s]=add(j['elbow'+s],[0,-.27*Math.cos(a),-.27*Math.sin(a)]);}
      props=pulley([0,.12,-.86],blend(j.wristL,j.wristR,.5));props.push(bar(j.wristL,j.wristR,.012));phaseLabel=p<.5?'Straighten the elbows overhead':'Bend the elbows slowly';camera=[3.5,1.9,3.5];target=[0,1.10,0];break;
    }
    case 'straight-arm-pulldown':{
      j=standing([0,.96,-.06],.13);const a=mix(.62,2.75,w);
      for(const [s,n]of sides){const sh=j['shoulder'+s];arm(j,s,[n*.17,sh[1]+.535*Math.cos(a),sh[2]+.535*Math.sin(a)],[n,-.3,0]);}
      props=[bar(j.wristL,j.wristR),...pulley([0,2.04,1.0],blend(j.wristL,j.wristR,.5))];phaseLabel=p<.5?'Sweep toward the thighs':'Return overhead slowly';camera=[3.5,1.9,3.6];break;
    }
    case 'farmer-hold-dead-hang':{
      if(variant==='dead-hang'){j=hanging(0,.38);props=rack();phaseLabel='Static dead hang · keep the legs quiet';target=[0,1.17,0];camera=[2.7,1.9,4];}
      else{j=standing();props=weights(j);phaseLabel='Static farmer hold · stand tall and breathe';}
      // Intentional static hold: the loop never invents repetitions for a timed exercise.
      break;
    }
    case 'reverse-db-lunge':{
      j=body([0,.95-.29*w,-.03*w],.055);leg(j,'L',[-.13,.09,.19]);leg(j,'R',[.13,.09,-.10-.55*w],[0,0,1]);props=downWeights(j);
      phaseLabel=p<.5?'Step back and lower':'Drive through the front foot';camera=[3.8,1.8,3.35];break;
    }
    case 'db-rdl':{
      j=body([0,.95-.03*w,-.20*w],.04+1.25*w);for(const [s,n]of sides)leg(j,s,[n*.15,.09,0]);props=downWeights(j);
      phaseLabel=p<.5?'Push the hips back':'Stand through the hips';target=[0,.9,0];camera=[3.9,1.6,3.2];break;
    }
    case 'single-leg-hip-thrust':{
      const hipY=mix(.34,.61,w),lean=-Math.acos((.56-hipY)/.49);j=body([0,hipY,0],lean);
      leg(j,'R',[.14,.09,.56],[0,1,.6]);j.kneeL=[-.13,hipY+.24,.35];j.ankleL=[-.13,hipY-.15,.54];j.toeL=add(j.ankleL,[0,-.04,.16]);
      j.head=add(blend(j.shoulderL,j.shoulderR,.5),[0,.115,-.13]);j.neck=add(blend(j.shoulderL,j.shoulderR,.5),[0,.055,-.06]);
      arm(j,'L',[-.21,hipY+.09,0],[-1,1,0]);arm(j,'R',[.21,hipY+.09,0],[1,1,0]);
      props=[bench([0,.44,-.55],[1.0,.24,.48]),dumbbell([0,hipY+.12,0])];phaseLabel=p<.5?'Lift the hips with a level pelvis':'Lower under control';camera=[3.8,1.55,3.4];target=[0,.57,0];break;
    }
    case 'cable-leg-extension':{
      j=seated();const a=mix(.0,1.44,w);j.ankleR=[.15,.56-.435*Math.cos(a),.43+.435*Math.sin(a)];j.toeR=add(j.ankleR,[0,-.015,.16]);
      for(const [s,n]of sides)arm(j,s,[n*.31,.65,.03],[n,0,1]);
      props=[bench([0,.53,.05],[.65,.12,.70]),...pulley([.15,.10,-.72],j.ankleR),{kind:'cuff',position:j.ankleR,radius:.065}];phaseLabel=p<.5?'Straighten the working knee':'Bend the knee slowly';target=[0,.80,.20];camera=[3.5,1.5,3.3];break;
    }
    case 'hanging-leg-raise':{
      j=body([0,1.0+.03*w,0],-.045*w);
      for(const [s,n]of sides){arm(j,s,[n*.39,2.01,0],[n,-.2,.2]);const a=1.48*w;leg(j,s,[n*.13,1+.03*w-.855*Math.cos(a),.855*Math.sin(a)],[0,0,1]);}
      props=rack();phaseLabel=p<.5?'Raise without swinging':'Lower slowly to a still hang';target=[0,1.13,.14];camera=[3.6,1.85,3.65];break;
    }
  }
  // Hands follow the forearms unless a wrist-specific movement authored an articulated palm.
  for(const [s]of sides){if(!j['hand'+s])j['hand'+s]=add(j['wrist'+s],mul(unit(sub(j['wrist'+s],j['elbow'+s])),.09));}
  return {joints:j,props,camera,target,phaseLabel,headRotation,grip,handRoll,variant:variant||demo.variants?.[0]?.id||null};
}
