/* Walk acceptance checks: node tools/validate-avatar-walk.mjs */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AVATAR_DEFAULTS,buildAvatarMesh} from '../src/avatar-geometry.js';
import {AVATAR_POSE_CONTROLS,poseAvatarMesh} from '../src/avatar-pose.js';
import {AVATAR_WALK_DEFAULTS,normalizeAvatarWalkOptions,avatarWalkPhase,avatarWalkPose} from '../src/avatar-walk.js';
import {composeAvatarPose} from '../src/avatar-pose-control.js';
import {avatarBounds,buildAvatarView,clipAvatarMesh} from '../src/avatar-render.js';
import {AVATAR_PLOT_DEFAULTS,plotAvatar} from '../src/avatar-plot.js';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const near=(a,b,label,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<=epsilon,label+': '+a+' ≈ '+b);
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const span=values=>Math.max(...values)-Math.min(...values);
const covariance=(a,b)=>{const ma=a.reduce((s,v)=>s+v,0)/a.length,mb=b.reduce((s,v)=>s+v,0)/b.length;return a.reduce((s,v,i)=>s+(v-ma)*(b[i]-mb),0)/a.length;};
const phases=[0,.083,.19,.25,.37,.5,.625,.77,.91];
const settings={poseMode:'Walk cycle',walkMotion:'Manual',walkSpeed:1,walkStride:1,walkArmSwing:1,walkGround:true};
const context={W:210,H:297,size:260,margin:12,pen:0};
const metrics=[];
let checks=0;
function sameMesh(a,b,label,epsilon=1e-10){
  assert.equal(a.v.length,b.v.length,label+': same topology');
  let error=0;for(let i=0;i<a.v.length;i++)error=Math.max(error,Math.abs(a.v[i]-b.v[i]));
  assert.ok(error<=epsilon,label+': largest skin displacement '+error);checks++;
}
function inspect(mesh,rest,label){
  assert.equal(mesh.kind,'mesh',label+': mesh output');
  assert.equal(mesh.tri,rest.tri,label+': retained triangle count');
  assert.equal(mesh.indices,rest.indices,label+': unchanged skin connectivity');
  assert.ok(mesh.vertices.every(Number.isFinite),label+': finite skinned positions');
  assert.ok(mesh.poseJoints,label+': actual articulated rig');
  for(const [name,joint] of Object.entries(mesh.poseJoints)){
    near(distance(joint.head,joint.tail),distance(joint.restHead,joint.restTail),label+': '+name+' bone length',1e-7);
  }
  checks++;
}
function inspectPaths(drawing,label){
  assert.ok(drawing.paths.length,label+': visible drawing');
  assert.ok(drawing.paths.reduce((sum,p)=>sum+p.pts.length,0)<=110000,label+': bounded path budget');
  for(const p of drawing.paths){
    assert.ok(p.pts.length>=2,label+': complete centerline');
    for(const q of p.pts)assert.ok(q.length===2&&q.every(Number.isFinite)&&q[0]>=context.margin-1e-6&&q[0]<=context.W-context.margin+1e-6&&q[1]>=context.margin-1e-6&&q[1]<=context.H-context.margin+1e-6,label+': finite in-margin millimetre paths');
  }
  checks++;
}
function sample(rest,phase,patch={}){return composeAvatarPose(rest,{...settings,...patch,walkPhase:phase});}
function direct(rest,phase,patch={}){return poseAvatarMesh(rest,avatarWalkPose(phase,{...settings,...patch}),{ground:patch.walkGround!==false});}
function limbMotion(rest,patch={}){
  const sampled=Array.from({length:16},(_,i)=>direct(rest,i/16,patch));
  const hipFoot=side=>sampled.map(m=>m.poseJoints['foot_'+side].head[1]-m.poseJoints.pelvis.head[1]);
  const shoulderHand=side=>sampled.map(m=>m.poseJoints['hand_'+side].head[1]-m.poseJoints['upperarm_'+side].head[1]);
  return {sampled,feetLeft:hipFoot('l'),feetRight:hipFoot('r'),handsLeft:shoulderHand('l'),handsRight:shoulderHand('r')};
}

assert.ok(AVATAR_WALK_DEFAULTS&&typeof AVATAR_WALK_DEFAULTS==='object','walk defaults exposed');
for(const values of [{walkSpeed:Infinity,walkStride:NaN,walkArmSwing:-1e8},{walkSpeed:1e8,walkStride:1e8,walkArmSwing:Infinity}]){
  const normalized=normalizeAvatarWalkOptions(values);
  assert.ok(Object.values(normalized).every(value=>typeof value!=='number'||Number.isFinite(value)),'invalid numeric inputs remain finite');
}
checks++;
near(avatarWalkPhase({walkMotion:'Manual',walkPhase:.37,walkSpeed:5},{frameIdx:33,frameCount:64}),.37,'manual walk phase is independent of speed and timeline');
near(avatarWalkPhase({walkMotion:'Manual',walkPhase:1}),0,'phase one is exact cycle start');
for(const speed of [1,2,3,6]){
  const timeline={walkMotion:'Timeline',walkSpeed:speed};
  near(avatarWalkPhase(timeline,{frameIdx:0,frameCount:96}),0,'timeline starts at cycle origin');
  const end=avatarWalkPhase(timeline,{frameIdx:95,frameCount:96});
  assert.ok(end>0&&end<1,'last frame precedes origin rather than duplicating it at speed '+speed);
  if(speed>1)near(avatarWalkPhase(timeline,{frameIdx:96/speed,frameCount:96}),0,'each whole speed multiple has a full repeat');
  near(avatarWalkPhase(timeline,{frameIdx:24/speed,frameCount:96}),.25,'speed changes cadence without changing gait shape');
  checks++;
}
near(avatarWalkPhase({walkMotion:'Timeline',walkSpeed:1},{frameIdx:0,frameCount:1}),0,'single-frame clock is finite and starts at contact');checks++;
near(avatarWalkPhase({walkMotion:'Timeline',walkSpeed:2,walkPhase:.13},{frameIdx:12,frameCount:96}),.38,'saved walk phase provides a stable timeline offset');checks++;

const baseline={Male:'ee2b6fd15fa20b960e9ea50bc398a328413981bf503344a33b870eac71c83d4c',Female:'1ce1cc37f0280b54f70e88d271325c37ac606546b77602b0a91f93abd250bc59'};
const bodies={};
for(const preset of ['Male','Female']){
  const rest=buildAvatarMesh({...AVATAR_DEFAULTS,preset},{quality:'draft'}),before=hash(rest.v);
  bodies[preset]=rest;
  assert.equal(before,baseline[preset],preset+': canonical anatomy remains unchanged');
  assert.equal(composeAvatarPose(rest,{}),rest,preset+': legacy default identity');
  assert.equal(composeAvatarPose(rest,{walkStride:1.5,walkArmSwing:0,walkPhase:.6}),rest,preset+': dormant walk parameters do not activate posing');checks++;
  for(const patch of [{walkStride:.45,walkArmSwing:.2},{walkStride:1,walkArmSwing:1},{walkStride:1.5,walkArmSwing:1.5},{walkStride:0,walkArmSwing:0}]){
    const seam0=direct(rest,0,patch),seam1=direct(rest,1,patch),epsilon=.0001;
    sameMesh(seam0,seam1,preset+' exact cyclic skin '+JSON.stringify(patch));
    const beforeSeam=direct(rest,1-epsilon,patch),afterSeam=direct(rest,epsilon,patch);
    let jump=0,speed=0;
    for(let i=0;i<seam0.vertices.length;i++){
      const incoming=(seam0.vertices[i]-beforeSeam.vertices[i])/epsilon,outgoing=(afterSeam.vertices[i]-seam0.vertices[i])/epsilon;
      jump=Math.max(jump,Math.abs(incoming-outgoing));speed=Math.max(speed,Math.abs(incoming),Math.abs(outgoing));
    }
    assert.ok(jump<.025,preset+': velocity remains continuous across grounded seam, largest difference '+jump);checks++;
    metrics.push({body:preset,...patch,seamVelocityDifference:jump,largestPhaseVelocity:speed});
  }
  for(const phase of phases){
    const mesh=sample(rest,phase);inspect(mesh,rest,preset+' walk '+phase);
    near(avatarBounds(mesh).min[2],-.5,preset+': ground remains steady at '+phase,5e-6);
    const e=mesh.poseFrameBounds;
    assert.ok(mesh.vertices.every((value,i)=>value>=e.min[i%3]-1e-7&&value<=e.max[i%3]+1e-7),preset+': common cycle envelope contains actual skin at '+phase);checks++;
  }
  const normal=limbMotion(rest),short=limbMotion(rest,{walkStride:.4}),long=limbMotion(rest,{walkStride:1.3}),stillArms=limbMotion(rest,{walkArmSwing:0});
  for(const side of ['Left','Right']){
    assert.ok(covariance(normal['feet'+side],normal['hands'+side])<-.0001,preset+': same-side arm counter-swings against leg');
    assert.ok(span(long['feet'+side])>span(short['feet'+side])*1.8,preset+': stride length grows the actual foot path');
    assert.ok(span(normal['hands'+side])>span(stillArms['hands'+side])+.04,preset+': arm swing control changes hand travel independently');checks++;
  }
  assert.ok(covariance(normal.feetLeft,normal.feetRight)<-.0001,preset+': legs alternate rather than march together');checks++;
  for(const side of ['l','r']){
    const feet=normal.sampled.map(m=>m.poseJoints['foot_'+side].tail[2]);
    assert.ok(span(feet)>.02,preset+': swing foot lifts over contact height');
    const flex=normal.sampled.map(m=>{const thigh=m.poseJoints['thigh_'+side],calf=m.poseJoints['calf_'+side],a=thigh.tail.map((v,k)=>v-thigh.head[k]),b=calf.tail.map((v,k)=>v-calf.head[k]);return Math.acos(Math.max(-1,Math.min(1,a.reduce((s,v,k)=>s+v*b[k],0)/(Math.hypot(...a)*Math.hypot(...b)))));});
    assert.ok(span(flex)>.25&&Math.max(...flex)<2.4,preset+': swing bends the knee without hyperextension');checks++;
  }
  const zeroStride=limbMotion(rest,{walkStride:0}),noSwing=direct(rest,.37,{walkArmSwing:0}),swinging=direct(rest,.37,{walkArmSwing:1.5});
  assert.ok(span(zeroStride.feetLeft)<1e-9&&span(zeroStride.feetRight)<1e-9,preset+': zero stride stops leg travel');
  for(const side of ['l','r'])near(distance(noSwing.poseJoints['foot_'+side].tail,swinging.poseJoints['foot_'+side].tail),0,preset+': arm swing preserves leg movement',1e-7);checks++;
  const free=direct(rest,.37,{walkGround:false}),grounded=direct(rest,.37,{walkGround:true});
  const shift=grounded.vertices[2]-free.vertices[2];
  for(let i=0;i<free.vertices.length;i++)near(grounded.vertices[i]-free.vertices[i],i%3===2?shift:0,preset+': grounding is a complete-body translation',1e-7);
  sameMesh(direct(rest,0,{walkGround:false}),direct(rest,1,{walkGround:false}),preset+' ungrounded loop seam');checks++;
  assert.equal(hash(rest.v),before,preset+': the cycle never rewrites source anatomy');checks++;
}

const body=bodies.Female,phase=.317;
const retained=new Map();let bodyFrame,bustFrame,feetFrame;
for(const t of phases){
  const mesh=sample(body,t),views=[['body',{frame:'body'}],['bust',{mode:'Bust',frame:'selection'}],['feet',{mode:'Feet',frame:'selection'}]];
  retained.set(t,hash(mesh.v));
  for(const [name,options] of views){
    const view=buildAvatarView(mesh,{...options,yaw:31});
    if(name==='body'){if(bodyFrame)assert.deepEqual(view.referenceBounds,bodyFrame,'full body scale is fixed through the gait');else bodyFrame=view.referenceBounds;}
    if(name==='bust'){if(bustFrame)assert.deepEqual(view.referenceBounds,bustFrame,'automatic bust scale is fixed through the gait');else bustFrame=view.referenceBounds;}
    if(name==='feet'){if(feetFrame)assert.deepEqual(view.referenceBounds,feetFrame,'automatic feet scale is fixed through the gait');else feetFrame=view.referenceBounds;}
    if(name!=='body'){
      assert.ok(view.mesh.tri,'anatomical '+name+' stays visible at '+t);
      const frame=mesh.poseFrameBounds.regions[name==='bust'?'Bust':'Feet'];
      assert.ok(view.mesh.v.every((value,i)=>value>=frame.min[i%3]-1e-7&&value<=frame.max[i%3]+1e-7),'local '+name+' envelope contains cut skin at unsampled phase '+t);
    }
  }
  const bust=clipAvatarMesh(mesh,{mode:'Bust'}),feet=clipAvatarMesh(mesh,{mode:'Feet'});
  near(bust.cutRange[0],mesh.poseLandmarks.bustCut,'bust slice follows moving torso');
  near(feet.cutRange[1],mesh.poseLandmarks.feetCut,'feet slice follows moving ankles');
  const manual=clipAvatarMesh(mesh,{mode:'Band',cut:.49,band:.12});
  near(manual.cutRange[0],-.07,'manual cut remains in rest anatomy coordinates',1e-7);checks++;
}
for(const t of [...phases].reverse())assert.equal(hash(sample(body,t).v),retained.get(t),'arbitrary seeking returns identical skin at '+t);checks++;
const artwork=sample(body,phase),artHash=hash(artwork.v);
assert.equal(sample(body,phase,{walkSpeed:5,styleSeed:902,plotStyle:'Hatching',yaw:172,cutMode:'Feet'}),artwork,'speed, styles, seeds, camera and slicing reuse the same phase mesh');checks++;
for(const style of ['Brush','Contours','Hatching','Contours + hatching']){
  const drawing=plotAvatar(artwork,{yaw:27},{...AVATAR_PLOT_DEFAULTS,style},context);
  inspectPaths(drawing,'walking '+style);
  assert.equal(hash(artwork.v),artHash,style+': plotting keeps walk geometry immutable');
}
for(const [mode,style] of [['Bust','Brush'],['Feet','Contours']])inspectPaths(plotAvatar(artwork,{mode,frame:'selection',yaw:35},{...AVATAR_PLOT_DEFAULTS,style},context),'walking '+mode+' '+style);
const reviewRest=buildAvatarMesh({...AVATAR_DEFAULTS,preset:'Female',seed:43},{quality:'review'}),reviewWalk=sample(reviewRest,.19);
inspect(reviewWalk,reviewRest,'Review-quality walking skin');
inspectPaths(plotAvatar(reviewWalk,{yaw:30},{...AVATAR_PLOT_DEFAULTS,style:'Contours',penWidth:.35},context),'Review-quality 0.35 mm walking contours');
const seeded=buildAvatarMesh({...AVATAR_DEFAULTS,preset:'Female',seed:138,variation:70},{quality:'draft'});
assert.notEqual(hash(sample(seeded,phase).v),artHash,'anatomy seed still changes the walking body');
assert.equal(hash(seeded.v),hash(buildAvatarMesh({...AVATAR_DEFAULTS,preset:'Female',seed:138,variation:70},{quality:'draft'}).v),'seeded source stays deterministic');checks++;
for(const [preset,changes] of [['Male',{armLength:120,legLength:125,footLength:120}],['Female',{hips:125,torsoLength:120,armThickness:130,headSize:115}]]){
  const altered=buildAvatarMesh({...AVATAR_DEFAULTS,preset,...changes},{quality:'draft'}),mesh=sample(altered,.625);
  inspect(mesh,altered,preset+' adjusted anatomy walk');
  assert.notEqual(hash(mesh.v),hash(sample(bodies[preset],.625).v),'body-part edits remain visible after gait skinning');
  sameMesh(sample(altered,0),sample(altered,1),preset+' adjusted anatomy cyclic seam');
}
const beforeOffset=sample(body,phase),headOffset=sample(body,phase,{poseA_headTurn:20}),armOffset=sample(body,phase,{poseA_leftElbow:20});
let headMovement=0,headVertices=0;
for(let i=0;i<body.vertices.length;i+=3)if(body.vertices[i+2]>.4){headMovement+=distance(beforeOffset.vertices.slice(i,i+3),headOffset.vertices.slice(i,i+3))**2;headVertices++;}
assert.ok(Math.sqrt(headMovement/headVertices)>.003,'head A offset still adjusts visible head skin while walking');
near(distance(beforeOffset.poseJoints.foot_l.tail,headOffset.poseJoints.foot_l.tail),0,'head offset preserves gait feet',1e-7);
assert.ok(distance(beforeOffset.poseJoints.hand_l.tail,armOffset.poseJoints.hand_l.tail)>.01,'left-arm A offset still adjusts walk');
near(distance(beforeOffset.poseJoints.hand_r.tail,armOffset.poseJoints.hand_r.tail),0,'left arm offset preserves opposite arm',1e-7);checks++;

const {default:avatar}=await import('../src/defs/nodes/avatar3d.js');
const defaults=Object.fromEntries(avatar.params.map(p=>[p.key,p.def]));
for(const key of ['poseMode','walkMotion','walkPhase','walkSpeed','walkStride','walkArmSwing'])assert.ok(avatar.params.some(p=>p.key===key),'node exposes '+key);
assert.equal(new Set(avatar.params.map(p=>p.key)).size,avatar.params.length,'walk controls retain unique node keys');
assert.deepEqual(avatar.outs.map(p=>p.type),['paths','paths','mesh'],'existing three port order stays unchanged');checks++;
function runNode(patch={},clock={}){
  const parameters={...defaults,...settings,walkPhase:phase,...patch},before=hash(parameters);
  const result=avatar.compute([undefined],parameters,{W:context.W,H:context.H,frameCount:96,frameIdx:0,...clock});
  assert.equal(hash(parameters),before,'node leaves parameters immutable');
  assert.equal(result.length,3,'three node outputs');
  inspectPaths(result[0],'walk node '+JSON.stringify(patch));
  assert.ok(result[1].paths.length,'reference silhouette visible');
  return result;
}
const node=runNode(),nodeHash=hash(node[2].v);
for(const patch of [{plotStyle:'Hatching'},{view:'Back'},{view:'Manual',yaw:79,pitch:12,roll:5},{cutMode:'Bust'},
  {cutMode:'Feet',framing:'Selected region'},{cutMode:'Band',cutPosition:'Manual',cutHeight:45},
  {styleSeed:805},{motion:'Timeline',animation:'Rotating bust'}]){
  assert.equal(hash(runNode(patch,{frameIdx:27})[2].v),nodeHash,'camera, styles, seeds and cuts keep complete walking mesh '+JSON.stringify(patch));checks++;
}
const clock={frameIdx:17,frameCount:96},timeline={walkMotion:'Timeline',walkSpeed:3,walkPhase:0};
const timelineNode=runNode(timeline,clock),manualNode=runNode({...timeline,walkMotion:'Manual',walkPhase:avatarWalkPhase(timeline,clock)},{frameIdx:59});
sameMesh(timelineNode[2],manualNode[2],'timeline and manually scrubbed walk agree');
assert.equal(hash(timelineNode[0].paths),hash(manualNode[0].paths),'timeline and manual drawing agree');checks++;
for(const control of AVATAR_POSE_CONTROLS)assert.ok(avatar.params.some(p=>p.key==='poseA_'+control.key),'existing A joint offset retained '+control.key);checks++;
console.log(JSON.stringify({checks,loopMetrics:metrics},null,2));
console.log('PASS: '+checks+' Avatar walk checks: cyclic skin and velocity, cadence, independent stride/arm swing, alternating grounded limbs, anatomy controls, deterministic seeking, fixed cut framing and plotting.');
