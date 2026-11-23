/* Run and gait-transition acceptance: node tools/validate-avatar-locomotion.mjs */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AVATAR_DEFAULTS,buildAvatarMesh} from '../src/avatar-geometry.js';
import {avatarWalkPose} from '../src/avatar-walk.js';
import {AVATAR_POSE_CONTROLS,poseAvatarMesh,resolveAvatarPose} from '../src/avatar-pose.js';
import {
  AVATAR_GAIT_NAMES,AVATAR_LOCOMOTION_DEFAULTS,normalizeAvatarLocomotionOptions,
  avatarLocomotionPhase,avatarLocomotionBlend,avatarLocomotionPose,
} from '../src/avatar-locomotion.js';
import {composeAvatarPose} from '../src/avatar-pose-control.js';
import {avatarBounds,buildAvatarView,clipAvatarMesh} from '../src/avatar-render.js';
import {AVATAR_PLOT_DEFAULTS,plotAvatar} from '../src/avatar-plot.js';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const near=(a,b,label,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<=epsilon,label+': '+a+' ≈ '+b);
const distance=(a,b)=>Math.hypot(...a.map((value,k)=>value-b[k]));
const span=values=>Math.max(...values)-Math.min(...values);
const covariance=(a,b)=>{const ma=a.reduce((s,v)=>s+v,0)/a.length,mb=b.reduce((s,v)=>s+v,0)/b.length;return a.reduce((s,v,i)=>s+(v-ma)*(b[i]-mb),0)/a.length;};
const settings={poseMode:'Stand / walk / run',gaitFrom:'Standing',gaitTo:'Running',gaitBlend:1,gaitTransition:'Manual',gaitMotion:'Manual',gaitPhase:0,gaitSpeed:1,gaitStride:1,gaitArmSwing:1,gaitGround:true};
const context={W:210,H:297,size:260,margin:12,pen:0};
const phases=[0,.083,.19,.25,.37,.5,.625,.77,.91];
const gaits=['Standing','Walking','Running'];
const metrics=[];
let checks=0;
function sameMesh(a,b,label,epsilon=1e-10){
  assert.equal(a.vertices.length,b.vertices.length,label+': same vertex layout');
  let error=0;for(let i=0;i<a.vertices.length;i++)error=Math.max(error,Math.abs(a.vertices[i]-b.vertices[i]));
  assert.ok(error<=epsilon,label+': largest skin difference '+error);checks++;
}
function inspect(mesh,rest,label){
  assert.equal(mesh.kind,'mesh',label+': full mesh');
  assert.equal(mesh.tri,rest.tri,label+': retained face count');
  assert.equal(mesh.indices,rest.indices,label+': retained connectivity');
  assert.ok(mesh.vertices.every(Number.isFinite),label+': finite posed skin');
  assert.ok(mesh.poseJoints,label+': posed skeleton');
  for(const [name,joint] of Object.entries(mesh.poseJoints))near(distance(joint.head,joint.tail),distance(joint.restHead,joint.restTail),label+': fixed '+name+' bone length',1e-7);
  const frame=mesh.poseFrameBounds;
  assert.ok(frame&&mesh.vertices.every((v,i)=>v>=frame.min[i%3]-1e-7&&v<=frame.max[i%3]+1e-7),label+': common frame contains actual skin');checks++;
}
function inspectPaths(drawing,label){
  assert.ok(drawing.paths.length,label+': visible centerlines');
  assert.ok(drawing.paths.reduce((sum,path)=>sum+path.pts.length,0)<=110000,label+': path budget');
  for(const path of drawing.paths){
    assert.ok(path.pts.length>=2,label+': complete stroke');
    for(const q of path.pts)assert.ok(q.length===2&&q.every(Number.isFinite)&&q[0]>=context.margin-1e-6&&q[0]<=context.W-context.margin+1e-6&&q[1]>=context.margin-1e-6&&q[1]<=context.H-context.margin+1e-6,label+': finite in-margin paper coordinates');
  }
  checks++;
}
function sample(rest,phase,patch={}){return composeAvatarPose(rest,{...settings,...patch,gaitPhase:phase});}
function pure(rest,gait,phase,patch={}){return sample(rest,phase,{gaitFrom:gait,gaitTo:gait,...patch});}
function flexion(mesh,side){
  const thigh=mesh.poseJoints['thigh_'+side],calf=mesh.poseJoints['calf_'+side];
  const a=thigh.tail.map((v,k)=>v-thigh.head[k]),b=calf.tail.map((v,k)=>v-calf.head[k]);
  return Math.acos(Math.max(-1,Math.min(1,a.reduce((sum,v,k)=>sum+v*b[k],0)/(Math.hypot(...a)*Math.hypot(...b)))));
}
function elbowFlexion(mesh,side){
  const arm=mesh.poseJoints['upperarm_'+side],forearm=mesh.poseJoints['lowerarm_'+side];
  const a=arm.tail.map((v,k)=>v-arm.head[k]),b=forearm.tail.map((v,k)=>v-forearm.head[k]);
  return Math.acos(Math.max(-1,Math.min(1,a.reduce((sum,v,k)=>sum+v*b[k],0)/(Math.hypot(...a)*Math.hypot(...b)))));
}
function torsoLean(mesh){const a=mesh.poseJoints.spine_01.head,b=mesh.poseJoints.spine_03.tail;return Math.atan2(Math.abs(b[1]-a[1]),b[2]-a[2]);}
function regionDisplacement(rest,a,b,predicate){
  let sum=0,count=0;for(let i=0;i<rest.vertices.length;i+=3)if(predicate(rest.vertices.slice(i,i+3))){sum+=distance(a.vertices.slice(i,i+3),b.vertices.slice(i,i+3))**2;count++;}
  assert.ok(count>10,'a visible anatomical region is sampled');return Math.sqrt(sum/count);
}

assert.deepEqual([...AVATAR_GAIT_NAMES],gaits,'three requested gait states');
assert.ok(AVATAR_LOCOMOTION_DEFAULTS,'defaults exposed');
for(const values of [{gaitSpeed:Infinity,gaitBlend:NaN,gaitStride:-1e8,gaitArmSwing:Infinity},{gaitSpeed:1e8,gaitBlend:1e8,gaitPhase:Infinity}]){
  const result=normalizeAvatarLocomotionOptions(values);
  assert.ok(Object.values(result).every(value=>typeof value!=='number'||Number.isFinite(value)),'invalid numeric inputs are finite');
}
checks++;
near(avatarLocomotionPhase({...settings,gaitPhase:.37,gaitSpeed:5},{frameIdx:27,frameCount:96}),.37,'manual phase ignores timeline and speed');
near(avatarLocomotionPhase({...settings,gaitPhase:1}),0,'cycle phase one is exact origin');
for(const speed of [1,2,3,6]){
  const values={...settings,gaitMotion:'Timeline',gaitSpeed:speed};
  near(avatarLocomotionPhase(values,{frameIdx:0,frameCount:96}),0,'timeline origin');
  const end=avatarLocomotionPhase(values,{frameIdx:95,frameCount:96});
  assert.ok(end>0&&end<1,'timeline omits duplicate cycle endpoint at '+speed+'×');
  if(speed>1)near(avatarLocomotionPhase(values,{frameIdx:96/speed,frameCount:96}),0,'whole-speed cycles repeat');
  near(avatarLocomotionPhase(values,{frameIdx:24/speed,frameCount:96}),.25,'speed changes cadence at a shared phase');checks++;
}
near(avatarLocomotionBlend({...settings,gaitBlend:.37},{frameIdx:22,frameCount:97}),.37,'manual gait blend is exact');
for(const cycle of ['One-way','Ping-pong']){
  const values={...settings,gaitTransition:'Timeline',gaitCycle:cycle};
  near(avatarLocomotionBlend(values,{frameIdx:0,frameCount:97}),0,'transition begins at A');
  near(avatarLocomotionBlend(values,{frameIdx:96,frameCount:97}),cycle==='One-way'?1:0,'transition ends at expected endpoint');
  if(cycle==='Ping-pong')near(avatarLocomotionBlend(values,{frameIdx:48,frameCount:97}),1,'ping-pong reaches B exactly');checks++;
}

const bodies={};
const baseline={Male:'ee2b6fd15fa20b960e9ea50bc398a328413981bf503344a33b870eac71c83d4c',Female:'1ce1cc37f0280b54f70e88d271325c37ac606546b77602b0a91f93abd250bc59'};
for(const preset of ['Male','Female']){
  const rest=buildAvatarMesh({...AVATAR_DEFAULTS,preset},{quality:'draft'}),before=hash(rest.v);bodies[preset]=rest;
  assert.equal(before,baseline[preset],preset+': source anatomy remains exact');
  assert.equal(composeAvatarPose(rest,{}),rest,preset+': legacy rest identity');
  assert.equal(composeAvatarPose(rest,{gaitStride:1.5,gaitBlend:.75,gaitPhase:.4}),rest,preset+': dormant gait settings do not activate the rig');checks++;
  const standing=pure(rest,'Standing',0);
  for(const phase of [.19,.47,.83,1])sameMesh(standing,pure(rest,'Standing',phase),preset+' phase-independent standing '+phase);
  sameMesh(standing,poseAvatarMesh(rest,resolveAvatarPose('Relaxed'),{ground:true}),preset+' standing is relaxed pose');
  for(const phase of [0,.19,.37,.77]){
    const oldWalk=poseAvatarMesh(rest,avatarWalkPose(phase,{walkStride:1,walkArmSwing:1}),{ground:true});
    sameMesh(pure(rest,'Walking',phase),oldWalk,preset+' walking endpoint preserves previous gait '+phase);
    sameMesh(sample(rest,phase,{gaitBlend:0}),standing,preset+' transition starts standing '+phase);
    sameMesh(sample(rest,phase,{gaitBlend:.5}),oldWalk,preset+' stand-to-run midpoint is walking '+phase);
    sameMesh(sample(rest,phase,{gaitBlend:1}),pure(rest,'Running',phase),preset+' transition reaches running '+phase);
  }
  for(const blend of [0,.23,.5,.71,1]){
    const zero=sample(rest,0,{gaitBlend:blend}),one=sample(rest,1,{gaitBlend:blend}),epsilon=.0001;
    sameMesh(zero,one,preset+' exact cycle seam at blend '+blend);
    const beforeSeam=sample(rest,1-epsilon,{gaitBlend:blend}),afterSeam=sample(rest,epsilon,{gaitBlend:blend});
    let velocityDifference=0;for(let i=0;i<zero.vertices.length;i++)velocityDifference=Math.max(velocityDifference,Math.abs((zero.vertices[i]-beforeSeam.vertices[i])/epsilon-(afterSeam.vertices[i]-zero.vertices[i])/epsilon));
    assert.ok(velocityDifference<.04,preset+': phase velocity is continuous at blend '+blend+', difference '+velocityDifference);checks++;
    metrics.push({body:preset,blend,seamVelocityDifference:velocityDifference});
  }
  const running=Array.from({length:12},(_,i)=>pure(rest,'Running',i/12));
  const walking=Array.from({length:12},(_,i)=>pure(rest,'Walking',i/12));
  const lift=running.map(m=>avatarBounds(m).min[2]+.5);
  assert.ok(Math.min(...lift)>-1e-6,preset+': runner never sinks below floor');
  assert.ok(Math.max(...lift)>.01,preset+': running includes a real airborne phase');
  assert.ok(Math.min(...lift)<.003,preset+': runner returns to floor contact');checks++;
  for(const side of ['l','r']){
    assert.ok(Math.max(...running.map(m=>flexion(m,side)))>Math.max(...walking.map(m=>flexion(m,side)))+.2,preset+': running has distinct knee recovery');
    const arms=running.map(m=>m.poseJoints['hand_'+side].head[1]-m.poseJoints['upperarm_'+side].head[1]);
    const legs=running.map(m=>m.poseJoints['foot_'+side].head[1]-m.poseJoints.pelvis.head[1]);
    assert.ok(covariance(arms,legs)<-.0001,preset+': running arms counter the same-side legs');
    assert.ok(span(legs)>.08,preset+': real running stride');checks++;
    assert.ok(running.reduce((sum,m)=>sum+elbowFlexion(m,side),0)/running.length>walking.reduce((sum,m)=>sum+elbowFlexion(m,side),0)/walking.length+.5,preset+': running elbows are visibly more bent');checks++;
  }
  assert.ok(running.reduce((sum,m)=>sum+torsoLean(m),0)/running.length>walking.reduce((sum,m)=>sum+torsoLean(m),0)/walking.length+.05,preset+': running torso leans farther forward');checks++;
  // Relative limb paths observe the pose controls without being affected by
  // grounding or the common root flight translation.
  const raw=(phase,patch={})=>poseAvatarMesh(rest,avatarLocomotionPose(phase,{...settings,gaitFrom:'Running',gaitTo:'Running',...patch}),{ground:false});
  const strideSamples=length=>Array.from({length:12},(_,i)=>{const m=raw(i/12,{gaitStride:length});return m.poseJoints.foot_l.head[1]-m.poseJoints.pelvis.head[1];});
  assert.ok(span(strideSamples(1.25))>span(strideSamples(.45))*1.8,preset+': stride control grows actual running leg travel');
  assert.ok(span(strideSamples(0))<1e-9,preset+': zero stride stops running legs');checks++;
  const noSwing=raw(.31,{gaitArmSwing:0}),wideSwing=raw(.31,{gaitArmSwing:1.5});
  near(distance(noSwing.poseJoints.foot_l.tail,wideSwing.poseJoints.foot_l.tail),0,preset+': arm swing leaves running legs unchanged',1e-7);
  assert.ok(distance(noSwing.poseJoints.hand_l.head,wideSwing.poseJoints.hand_l.head)>.015,preset+': arm swing changes the actual running hand');checks++;
  for(const blend of [.17,.68])sameMesh(sample(rest,.317,{gaitBlend:blend}),sample(rest,.317,{gaitFrom:'Running',gaitTo:'Standing',gaitBlend:1-blend}),preset+' transition can reverse without changing its poses');
  const free=pure(rest,'Running',.19,{gaitGround:false}),grounded=pure(rest,'Running',.19),shift=grounded.vertices[2]-free.vertices[2];
  for(let i=0;i<free.vertices.length;i++)near(grounded.vertices[i]-free.vertices[i],i%3===2?shift:0,preset+': grounding retains root flight and only translates the body',1e-7);checks++;
  sameMesh(pure(rest,'Running',0,{gaitGround:false}),pure(rest,'Running',1,{gaitGround:false}),preset+' ungrounded running seam');
  for(const phase of phases){inspect(sample(rest,phase,{gaitBlend:.73}),rest,preset+' mixed gait '+phase);inspect(pure(rest,'Running',phase),rest,preset+' run '+phase);}
  assert.equal(hash(rest.v),before,preset+': transitions do not mutate source anatomy');checks++;
}

const body=bodies.Female;
// Crossfade derivative checks observe actual skin around the Walking junction,
// rather than assuming angle interpolation or any particular easing formula.
for(const phase of [.137,.37,.683]){
  const epsilon=.0001,a=sample(body,phase,{gaitBlend:.5-epsilon}),mid=sample(body,phase,{gaitBlend:.5}),b=sample(body,phase,{gaitBlend:.5+epsilon});
  let movement=0,velocityDifference=0;
  for(let i=0;i<mid.vertices.length;i++){movement=Math.max(movement,Math.abs(a.vertices[i]-b.vertices[i]));velocityDifference=Math.max(velocityDifference,Math.abs((mid.vertices[i]-a.vertices[i])/epsilon-(b.vertices[i]-mid.vertices[i])/epsilon));}
  assert.ok(movement<.001,'gait blend has no position pop while passing Walking');
  assert.ok(velocityDifference<.04,'gait blend passes Walking smoothly, derivative difference '+velocityDifference);checks++;
}
let bodyFrame,bustFrame,feetFrame;const retained=new Map();
for(const [phase,blend] of [[.083,0],[.19,.17],[.37,.43],[.625,.5],[.77,.67],[.91,.86],[0,1]]){
  const mesh=sample(body,phase,{gaitBlend:blend});retained.set(phase+':'+blend,hash(mesh.vertices));
  for(const [name,viewOptions] of [['body',{frame:'body'}],['bust',{mode:'Bust',frame:'selection'}],['feet',{mode:'Feet',frame:'selection'}]]){
    const view=buildAvatarView(mesh,{...viewOptions,yaw:31});
    if(name==='body'){if(bodyFrame)assert.deepEqual(view.referenceBounds,bodyFrame,'whole-body camera frame stays fixed during phase AND blend');else bodyFrame=view.referenceBounds;}
    if(name==='bust'){if(bustFrame)assert.deepEqual(view.referenceBounds,bustFrame,'bust camera frame stays fixed during phase AND blend');else bustFrame=view.referenceBounds;}
    if(name==='feet'){if(feetFrame)assert.deepEqual(view.referenceBounds,feetFrame,'feet camera frame stays fixed during phase AND blend');else feetFrame=view.referenceBounds;}
    if(name!=='body'){
      assert.ok(view.mesh.tri,'anatomical '+name+' remains visible');
      const frame=mesh.poseFrameBounds.regions[name==='bust'?'Bust':'Feet'];
      assert.ok(view.mesh.v.every((value,i)=>value>=frame.min[i%3]-1e-7&&value<=frame.max[i%3]+1e-7),'common selected '+name+' frame contains retained skin');
    }
  }
  near(clipAvatarMesh(mesh,{mode:'Bust'}).cutRange[0],mesh.poseLandmarks.bustCut,'bust cuts follow moving anatomy');
  near(clipAvatarMesh(mesh,{mode:'Feet'}).cutRange[1],mesh.poseLandmarks.feetCut,'feet cuts follow moving anatomy and flight');
  near(clipAvatarMesh(mesh,{mode:'Band',cut:.49,band:.12}).cutRange[0],-.07,'manual cuts retain rest reference',1e-7);checks++;
}
for(const [key,value] of [...retained].reverse()){
  const [phase,blend]=key.split(':').map(Number);assert.equal(hash(sample(body,phase,{gaitBlend:blend}).vertices),value,'random seeking restores exact gait skin');
}
checks++;
const art=sample(body,.317,{gaitBlend:.83}),artHash=hash(art.vertices);
assert.equal(sample(body,.317,{gaitBlend:.83,gaitSpeed:5,plotStyle:'Hatching',styleSeed:203,yaw:127,cutMode:'Feet'}),art,'camera, style, drawing seed and speed reuse same phase/blend mesh');checks++;
for(const style of ['Brush','Contours','Hatching','Contours + hatching']){
  inspectPaths(plotAvatar(art,{yaw:27},{...AVATAR_PLOT_DEFAULTS,style},context),'running '+style);
  assert.equal(hash(art.vertices),artHash,style+': drawing leaves full gait mesh immutable');
}
for(const [mode,style] of [['Bust','Brush'],['Feet','Contours']])inspectPaths(plotAvatar(art,{mode,frame:'selection',yaw:35},{...AVATAR_PLOT_DEFAULTS,style},context),'running '+mode+' '+style);
for(const [preset,changes] of [['Male',{armLength:120,legLength:125,footLength:120}],['Female',{hips:125,torsoLength:120,armThickness:130,headSize:115}]]){
  const altered=buildAvatarMesh({...AVATAR_DEFAULTS,preset,...changes},{quality:'draft'}),mesh=sample(altered,.625,{gaitBlend:.83});
  inspect(mesh,altered,preset+' adjusted anatomy run');
  assert.notEqual(hash(mesh.vertices),hash(sample(bodies[preset],.625,{gaitBlend:.83}).vertices),'body-part edits remain visible in locomotion');
  sameMesh(sample(altered,0),sample(altered,1),preset+' adjusted running seam');
}
const seeded=buildAvatarMesh({...AVATAR_DEFAULTS,preset:'Female',seed:138,variation:70},{quality:'draft'});
assert.notEqual(hash(sample(seeded,.317,{gaitBlend:.83}).vertices),artHash,'anatomy seed still changes locomotion shape');
assert.equal(hash(seeded.vertices),hash(buildAvatarMesh({...AVATAR_DEFAULTS,preset:'Female',seed:138,variation:70},{quality:'draft'}).vertices),'anatomy seed is deterministic');checks++;
const headOffset=sample(body,.317,{gaitBlend:.83,poseA_headTurn:20}),armOffset=sample(body,.317,{gaitBlend:.83,poseA_leftElbow:20});
assert.ok(regionDisplacement(body,art,headOffset,p=>p[2]>.4)>.003,'independent head offset changes visible head skin');
near(distance(art.poseJoints.foot_l.tail,headOffset.poseJoints.foot_l.tail),0,'head offset retains running feet',1e-7);
assert.ok(distance(art.poseJoints.hand_l.tail,armOffset.poseJoints.hand_l.tail)>.01,'left elbow offset changes running arm');
near(distance(art.poseJoints.hand_r.tail,armOffset.poseJoints.hand_r.tail),0,'left elbow offset preserves opposite arm',1e-7);checks++;

const {default:avatar}=await import('../src/defs/nodes/avatar3d.js');
const defaults=Object.fromEntries(avatar.params.map(p=>[p.key,p.def]));
for(const key of ['gaitFrom','gaitTo','gaitBlend','gaitTransition','gaitCycle','gaitMotion','gaitPhase','gaitSpeed','gaitStride','gaitArmSwing','gaitGround'])assert.ok(avatar.params.some(p=>p.key===key),'node exposes '+key);
assert.equal(new Set(avatar.params.map(p=>p.key)).size,avatar.params.length,'node parameter keys remain unique');
assert.deepEqual(avatar.outs.map(p=>p.type),['paths','paths','mesh'],'unchanged three-port order');checks++;
function runNode(patch={},clock={}){
  const parameters={...defaults,...settings,gaitPhase:.317,gaitBlend:.83,...patch},before=hash(parameters);
  const output=avatar.compute([undefined],parameters,{W:context.W,H:context.H,frameCount:97,frameIdx:0,...clock});
  assert.equal(hash(parameters),before,'node preserves saved settings');
  assert.equal(output.length,3,'three node outputs');inspectPaths(output[0],'locomotion node '+JSON.stringify(patch));
  assert.ok(output[1].paths.length,'silhouette reference visible');return output;
}
const node=runNode(),nodeHash=hash(node[2].vertices);
for(const patch of [{plotStyle:'Hatching'},{view:'Back'},{view:'Manual',yaw:79,pitch:12,roll:5},{cutMode:'Bust'},
  {cutMode:'Feet',framing:'Selected region'},{cutMode:'Band',cutPosition:'Manual',cutHeight:45},{styleSeed:805},{motion:'Timeline',animation:'Rotating bust'}]){
  assert.equal(hash(runNode(patch,{frameIdx:27})[2].vertices),nodeHash,'styles/camera/cuts retain complete locomotion mesh');checks++;
}
const clock={frameIdx:29,frameCount:97},timeline={gaitMotion:'Timeline',gaitTransition:'Timeline',gaitCycle:'One-way',gaitSpeed:3,gaitPhase:0};
const timed=runNode(timeline,clock),manual=runNode({...timeline,gaitMotion:'Manual',gaitTransition:'Manual',gaitPhase:avatarLocomotionPhase({...settings,...timeline},clock),gaitBlend:avatarLocomotionBlend({...settings,...timeline},clock)});
sameMesh(timed[2],manual[2],'timeline and manually sampled phase/blend agree');
assert.equal(hash(timed[0].paths),hash(manual[0].paths),'timeline and manual drawing agree');checks++;
for(const control of AVATAR_POSE_CONTROLS)assert.ok(avatar.params.some(p=>p.key==='poseA_'+control.key),'independent A joint offsets retained');checks++;
const review=buildAvatarMesh({...AVATAR_DEFAULTS,preset:'Female',seed:43},{quality:'review'}),reviewRun=sample(review,.19,{gaitBlend:.83});
inspect(reviewRun,review,'Review-quality mixed run');
inspectPaths(plotAvatar(reviewRun,{yaw:30},{...AVATAR_PLOT_DEFAULTS,style:'Contours',penWidth:.35},context),'Review-quality 0.35 mm running contours');
console.log(JSON.stringify({checks,loopMetrics:metrics},null,2));
console.log('PASS: '+checks+' Avatar locomotion checks: running flight, stable standing, unchanged walking, smooth cyclic skin and gait transitions, fixed frames, deterministic seeds, node integration and plotting.');
