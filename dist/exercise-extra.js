/* Public movement studies for exercises recorded outside the prescribed rotation.
   Aliases are deliberately exact. Equipment marked as an illustrated variation
   describes this teaching model, never an inference about a historical workout. */
// Animation timing only: these values never prescribe or record a training tempo.
const motionCadence={
  'db-shoulder-press':[2.2,'lift'], 'db-lateral-raise':[1.9,'lift'], 'db-shrug':[1.8,'lift'],
  'bent-over-db-row':[2.2,'lift'], 'face-pull':[2.0,'lift'], 'single-arm-cable-fly':[2.0,'lift'],
  'single-arm-db-overhead-extension':[1.9,'lift'], 'single-arm-preacher-curl':[2.0,'lift'],
  'hammer-preacher-curl':[2.0,'lift'], 'behind-body-cable-curl':[2.0,'lift'],
  'single-arm-cable-pulldown':[2.2,'lift'], 'db-curl':[1.9,'lift'], 'rdl-example':[2.4,'lower'],
  'wrist-curl':[2.0,'balanced','wrist'], 'wrist-extension':[2.0,'balanced','wrist'],
  'hammer-forearm-curl':[1.9,'lift'], 'rope-pushdown':[1.9,'lift'],
  'triceps-pushdown-example':[1.9,'lift'], 'rope-overhead-extension':[1.9,'lift'],
  'cable-crossover-example':[2.0,'lift'], 'scapular-cable-fly':[2.0,'lift']
};
const define=(id,name,focus,equipment,muscles,cues,aliases=[],extra={})=>{
  const [cycleSeconds,firstHalf,kind='rep']=motionCadence[id];
  const cadence=Object.freeze(kind==='rep'?{kind,firstHalf,firstHalfFraction:firstHalf==='lower'?.6:.4}:{kind});
  return Object.freeze({id,name,focus,equipment,muscles:Object.freeze(muscles),cues:Object.freeze(cues),aliases:Object.freeze(aliases),...extra,durationMs:cycleSeconds*1000,cycleSeconds,cadence});
};

export const extraExerciseDemos=Object.freeze([
  define('db-shoulder-press','Dumbbell Shoulder Press','Shoulders · triceps','Dumbbells · standing variation',['shoulders','triceps'],['Keep your ribs over the pelvis and plant both feet.','Press upward with wrists stacked over the elbows.','Lower smoothly to a comfortable shoulder-level position.'],['DB Shoulder Press']),
  define('db-lateral-raise','Dumbbell Lateral Raise','Side delts','Dumbbells · illustrated variation',['shoulders'],['Stand tall with a small, steady elbow bend.','Raise the upper arms out to around shoulder height.','Lower slowly without shrugging or swinging.'],['DB Lateral Raise','Lateral Raise','Lateral raises']),
  define('db-shrug','Dumbbell Shrug','Upper traps','Dumbbells · illustrated variation',['back','shoulders'],['Let the dumbbells hang beside your thighs.','Raise the shoulders straight up while keeping the neck relaxed.','Lower under control; avoid rolling the shoulders.'],['Shrugs','Dumbbell Shrugs']),
  define('bent-over-db-row','Bent-over Dumbbell Row','Upper back · biceps','Dumbbells · bilateral hinged variation',['back','biceps'],['Hinge at the hips and hold a steady, long spine.','Draw the elbows back as the shoulder blades move together.','Lower the weights without rounding or jerking the trunk.'],['Dumbbell rows (shoulder-blade focus)','Dumbbell Row','DB Row']),
  define('face-pull','Face Pull','Rear delts · upper back','High pulley · rope',['shoulders','back'],['Set the rope around upper-chest to face height.','Pull toward the face, separating the hands and opening the elbows.','Return slowly without leaning back or lifting the shoulders.']),
  define('single-arm-cable-fly','Single-arm Cable Fly','Chest','Chest-height pulley · single handle',['chest'],['Stand firmly and keep your torso facing forward.','Sweep one arm across the chest with a soft, fixed elbow bend.','Return slowly and repeat on the other side.']),
  define('single-arm-db-overhead-extension','Single-arm Dumbbell Overhead Triceps Extension','Triceps','One dumbbell',['triceps'],['Hold the upper arm beside your head in a comfortable position.','Bend the elbow to lower the dumbbell behind the head.','Straighten the elbow without arching or moving the upper arm.'],['Single-arm Behind-the-Head Triceps Extension','Single-arm Behind-the-Head Triceps Extension (DB)']),
  define('single-arm-preacher-curl','Single-arm Preacher Curl','Biceps','Dumbbell · preacher bench',['biceps'],['Rest the upper arm on the angled pad and keep the shoulder quiet.','Curl the dumbbell without lifting the arm off the pad.','Lower slowly; avoid forcing the elbow into a hard lockout.']),
  define('hammer-preacher-curl','Hammer Preacher Curl','Biceps · forearms','Dumbbell · preacher bench · neutral grip',['biceps','forearms'],['Support the upper arm on the pad with the palm facing inward.','Curl without twisting the wrist or lifting the shoulder.','Lower under control through a comfortable elbow range.'],['Hammer preacher curls']),
  define('behind-body-cable-curl','Single-arm Behind-the-Body Cable Curl','Biceps','Low pulley behind · single handle',['biceps'],['Face away from a low pulley with the arm slightly behind your body.','Keep the upper arm still as the elbow bends.','Return slowly without rolling the shoulder forward.']),
  define('single-arm-cable-pulldown','Single-arm Cable Pulldown','Lats · biceps','High pulley · single handle · seated variation',['back','biceps'],['Sit tall with one hand on the overhead handle.','Pull the elbow down toward your side without twisting.','Let the arm lengthen smoothly; repeat on the other side.']),
  define('db-curl','Dumbbell Curl','Biceps','Dumbbells · illustrated variation',['biceps'],['Keep your upper arms near your ribs and palms facing forward.','Bend the elbows without swinging or leaning back.','Lower slowly with the wrists straight.'],['Biceps curl','Biceps curls','Bicep curl','Bicep curls','Curls','Light bicep burnout curls (pump)']),
  define('rdl-example','Romanian Deadlift','Hamstrings · glutes','Dumbbells · illustrated variation',['hamstrings','glutes'],['This example uses dumbbells; the historical record did not specify equipment.','Keep a soft knee bend and hinge by pushing the hips back.','Keep the weights close and stand through the hips without rounding.'],['RDL']),
  define('wrist-curl','Wrist Curl','Forearms','Light dumbbells · palms up',['forearms'],['Support the forearms and let the hands clear the knees.','Keep palms up; move only at the wrists through a small range.','Return slowly without lifting the forearms.']),
  define('wrist-extension','Wrist Extension','Forearms','Light dumbbells · palms down',['forearms'],['Support the forearms and let the hands clear the knees.','Keep palms down and raise the backs of the hands gently.','Lower under control; avoid using the elbows.']),
  define('hammer-forearm-curl','Hammer Forearm Curl','Forearms · biceps','Dumbbells · neutral grip',['forearms','biceps'],['Keep the palms facing inward and elbows beside the body.','Curl without moving the upper arms or bending the wrists.','Lower slowly rather than swinging the weights.']),
  define('rope-pushdown','Triceps Rope Pushdown','Triceps','High pulley · rope',['triceps'],['Hold the rope with palms facing inward and elbows beside your ribs.','Straighten the elbows and gently separate the rope ends.','Return slowly while keeping the upper arms still.'],['Triceps Rope Pushdowns']),
  define('triceps-pushdown-example','Triceps Pushdown','Triceps','High pulley · bar · illustrated variation',['triceps'],['This example uses a bar; use the attachment recorded for your own session.','Keep elbows beside your torso as you straighten the arms.','Return slowly without leaning on the attachment.']),
  define('rope-overhead-extension','Triceps Rope Overhead Extension','Triceps','Low pulley behind · rope',['triceps'],['Face away from the pulley with your upper arms beside your head.','Straighten the elbows while keeping the ribs controlled.','Bend the elbows slowly through a comfortable shoulder position.']),
  define('cable-crossover-example','Cable Crossover','Chest','Chest-height pulleys · illustrated variation',['chest'],['This example uses chest-height handles and a stable stance.','Keep a soft elbow bend as the handles arc together in front.','Return under control without forcing the shoulders behind you.']),
  define('scapular-cable-fly','Shoulder-height Cable Reverse Fly','Rear delts · shoulder-blade control','Two shoulder-height pulleys',['shoulders','back'],['Keep a soft elbow bend and the torso still.','Open the arms as the shoulder blades move together gently.','Return slowly without shrugging or forcing the end range.'],['Shoulder-height cable reverse fly / scapular retraction movement'])
]);

const PI=Math.PI, sides=[['L',-1],['R',1]],add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),mix=(a,b,t)=>a+(b-a)*t;
const norm=a=>Math.hypot(...a),unit=a=>mul(a,1/(norm(a)||1)),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),mid=(a,b)=>a.map((v,i)=>(v+b[i])*.5);
function joint(start,end,a,b,bend){const d0=sub(end,start),length=Math.min(norm(d0),a+b-.0001),dir=unit(d0),along=(a*a-b*b+length*length)/(2*length),height=Math.sqrt(Math.max(0,a*a-along*along));let normal=sub(bend,mul(dir,dot(bend,dir)));if(norm(normal)<.001)normal=sub([1,0,0],mul(dir,dir[0]));return add(add(start,mul(dir,along)),mul(unit(normal),height));}
function arm(j,s,end,bend=[0,0,1]){const sh=j['shoulder'+s],delta=sub(end,sh),wrist=norm(delta)>.5599?add(sh,mul(unit(delta),.5599)):end;j['elbow'+s]=joint(sh,wrist,.29,.27,bend);j['wrist'+s]=wrist;}
function rest(j,s){const n=s==='L'?-1:1;arm(j,s,add(j['shoulder'+s],[n*.015,-.548,.025]),[n,0,.3]);}
function complete(pose){const j=pose.joints;for(const [s]of sides)if(!j['hand'+s])j['hand'+s]=add(j['wrist'+s],mul(unit(sub(j['wrist'+s],j['elbow'+s])),.09));return pose;}
const bar=(from,to,radius=.018,extra={})=>({kind:'bar',from,to,radius,...extra});
const cable=(from,to)=>({kind:'cable',from,to,radius:.003});
const dumbbell=(p,axis=[1,0,0])=>({kind:'dumbbell',from:add(p,mul(axis,-.13)),to:add(p,mul(axis,.13)),radius:.018});
const pulley=(p,hand)=>[bar([p[0],.04,p[2]],[p[0],2.05,p[2]],.025),cable(p,hand)];
const bench=(position,size,rotation=[0,0,0])=>({kind:'bench',position,size,rotation});
function dropHands(j){delete j.handL;delete j.handR;}
function rope(j,anchor){const end=add(mid(j.wristL,j.wristR),[0,.13,-.03]);return [...pulley(anchor,end),bar(end,j.wristL,.012),bar(end,j.wristR,.012)];}
const ownIds=new Set(extraExerciseDemos.map(d=>d.id));

/** Same pose contract as the main catalogue; basePoseFn prevents a circular import. */
export function getExtraExercisePose(id,phase=0,variant,basePoseFn){
  if(!ownIds.has(id))return null;
  const p=((Number.isFinite(phase)?phase:0)%1+1)%1,w=.5-.5*Math.cos(p*2*PI);
  let pose;
  switch(id){
    case 'rdl-example': return basePoseFn('db-rdl',p,variant);
    case 'wrist-curl': return basePoseFn('wrist-flexion-extension',p,'flexion');
    case 'wrist-extension': return basePoseFn('wrist-flexion-extension',p,'extension');
    case 'hammer-forearm-curl': return basePoseFn('hammer-curl',p,variant);
    case 'triceps-pushdown-example': return basePoseFn('cable-triceps-pressdown',p,variant);
    case 'cable-crossover-example': return basePoseFn('cable-fly',p,variant);
    case 'scapular-cable-fly': return basePoseFn('cable-rear-delt-fly',p,variant);
    case 'rope-pushdown':{
      pose=basePoseFn('cable-triceps-pressdown',p);const j=pose.joints;
      // A little separation at full extension preserves a neutral rope grip.
      for(const [s,n]of sides){j['wrist'+s][0]+=n*.045*w;j['elbow'+s]=joint(j['shoulder'+s],j['wrist'+s],.29,.27,[n,0,1]);}
      dropHands(j);pose.props=rope(j,[0,2.04,.65]);pose.grip='neutral';return complete(pose);
    }
    case 'rope-overhead-extension':{
      pose=basePoseFn('overhead-cable-triceps-extension',p);pose.props=rope(pose.joints,[0,.12,-.86]);pose.grip='neutral';return pose;
    }
    case 'single-arm-cable-fly':{
      pose=basePoseFn('cable-fly',p);rest(pose.joints,'L');dropHands(pose.joints);pose.props=pulley([1,1.42,-.35],pose.joints.wristR);pose.phaseLabel=p<.5?'Sweep across the chest':'Return slowly';return complete(pose);
    }
    case 'single-arm-cable-pulldown':{
      pose=basePoseFn('v-bar-pulldown',p);const j=pose.joints;rest(j,'L');arm(j,'R',[.29,mix(1.64,1.12,w),mix(.13,.21,w)],[1,-1,.15]);dropHands(j);
      pose.camera=[4.4,1.8,1.97];
      pose.props=[bench([0,.53,-.05],[.55,.12,.65]),...pulley([.36,2.04,.45],j.wristR)];pose.phaseLabel=p<.5?'Draw the elbow down':'Lengthen the arm slowly';return complete(pose);
    }
    case 'single-arm-preacher-curl':
    case 'hammer-preacher-curl':{
      pose=basePoseFn('v-bar-pulldown',0);const j=pose.joints;rest(j,'L');
      // The upper arm lies on a sloped pad; elbow position remains fixed.
      const sh=j.shoulderR,angle=PI/4;j.elbowR=add(sh,[0,-.29*Math.cos(angle),.29*Math.sin(angle)]);
      const a=mix(.16,2.15,w);j.wristR=add(j.elbowR,[0,-.27*Math.cos(a),.27*Math.sin(a)]);dropHands(j);
      pose.props=[bench([0,.53,-.05],[.55,.12,.65]),bench(add(mid(sh,j.elbowR),[0,-.035,0]),[.36,.085,.43],[PI/4,0,0]),dumbbell(j.wristR,id==='hammer-preacher-curl'?[0,0,1]:[1,0,0])];
      pose.camera=[2.3,1.45,3.05];pose.target=[.10,.94,.20];pose.grip=id==='hammer-preacher-curl'?'neutral':'supinated';pose.phaseLabel=p<.5?'Curl with the upper arm supported':'Lower without locking the elbow';return complete(pose);
    }
    default:{
      // The bottom position of a hammer curl supplies a fresh, proportioned standing pose.
      pose=basePoseFn('hammer-curl',0);const j=pose.joints;pose.props=[];dropHands(j);
      if(id==='db-shoulder-press'){
        for(const [s,n]of sides)arm(j,s,[n*mix(.40,.25,w),mix(1.47,1.998,w),mix(.10,.025,w)],[n,0,.05]);
        pose.props=sides.map(([s])=>dumbbell(j['wrist'+s]));pose.phaseLabel=p<.5?'Press overhead':'Lower to shoulder level';pose.target=[0,1.10,0];
      }else if(id==='db-lateral-raise'){
        const a=mix(.08,PI/2,w);for(const [s,n]of sides){const sh=j['shoulder'+s];arm(j,s,[sh[0]+n*.53*Math.sin(a),sh[1]-.53*Math.cos(a),.035],[0,0,.5]);}
        pose.props=sides.map(([s])=>dumbbell(j['wrist'+s],[0,0,1]));pose.phaseLabel=p<.5?'Raise to shoulder level':'Lower without shrugging';
      }else if(id==='db-shrug'){
        for(const [s]of sides){j['shoulder'+s][1]+=.065*w;rest(j,s);}pose.props=sides.map(([s])=>dumbbell(j['wrist'+s],[0,0,1]));pose.phaseLabel=p<.5?'Lift the shoulders straight up':'Lower the shoulders slowly';
      }else if(id==='bent-over-db-row'){
        pose=basePoseFn('db-rdl',.36);const q=pose.joints;dropHands(q);
        for(const [s,n]of sides){const sh=q['shoulder'+s];arm(q,s,add(sh,[n*.05,mix(-.54,-.19,w),mix(.0,-.36,w)]),[n*.4,.25,-1]);}
        pose.props=sides.map(([s])=>dumbbell(q['wrist'+s],[0,0,1]));pose.phaseLabel=p<.5?'Pull the elbows back':'Lower with a steady torso';pose.camera=[3.8,1.7,3.2];return complete(pose);
      }else if(id==='face-pull'){
        for(const [s,n]of sides)arm(j,s,[n*mix(.12,.36,w),mix(1.43,1.56,w),mix(.53,.10,w)],[n,-.12,-.5]);pose.props=rope(j,[0,1.62,1.12]);pose.phaseLabel=p<.5?'Pull toward the face and separate the hands':'Reach forward under control';pose.camera=[3.2,1.9,3.8];
      }else if(id==='single-arm-db-overhead-extension'){
        rest(j,'L');j.elbowR=add(j.shoulderR,[0,.29,0]);const a=mix(.78,PI-.04,w);j.wristR=add(j.elbowR,[0,-.27*Math.cos(a),-.27*Math.sin(a)]);
        pose.props=[dumbbell(j.wristR,[0,0,1])];pose.phaseLabel=p<.5?'Straighten the elbow overhead':'Lower behind the head slowly';pose.camera=[3.7,1.9,3.1];pose.target=[0,1.10,0];
      }else if(id==='behind-body-cable-curl'){
        rest(j,'L');j.elbowR=add(j.shoulderR,[0,-Math.sqrt(.29**2-.10**2),-.10]);const a=mix(.10,2.15,w);j.wristR=add(j.elbowR,[0,-.27*Math.cos(a),.27*Math.sin(a)]);
        pose.props=pulley([.32,.12,-.85],j.wristR);pose.grip='supinated';pose.phaseLabel=p<.5?'Curl with the upper arm behind you':'Lower the handle slowly';pose.camera=[3.6,1.75,3.2];
      }else if(id==='db-curl'){
        const a=mix(.10,2.35,w);for(const [s,n]of sides){j['elbow'+s]=add(j['shoulder'+s],[n*.012,-Math.sqrt(.29**2-.012**2),0]);j['wrist'+s]=add(j['elbow'+s],[0,-.27*Math.cos(a),.27*Math.sin(a)]);}
        pose.props=sides.map(([s])=>dumbbell(j['wrist'+s]));pose.grip='supinated';pose.phaseLabel=p<.5?'Curl without swinging':'Lower with control';
      }
      return complete(pose);
    }
  }
}
