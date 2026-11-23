/* Pose acceptance checks: node tools/validate-avatar-pose.mjs */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AVATAR_DEFAULTS,buildAvatarMesh} from '../src/avatar-geometry.js';
import {
  AVATAR_POSE_DEFAULTS,AVATAR_POSE_CONTROLS,AVATAR_POSE_PRESETS,
  normalizeAvatarPose,resolveAvatarPose,interpolateAvatarPose,
  poseAvatarMesh,poseQuaternionSlerp,
} from '../src/avatar-pose.js';
import {avatarBounds,buildAvatarView,clipAvatarMesh} from '../src/avatar-render.js';
import {plotAvatar,AVATAR_PLOT_DEFAULTS} from '../src/avatar-plot.js';
import RIG from '../src/assets/avatar-makehuman-rig.js';
import {composeAvatarPose,avatarPoseProgress,avatarPoseEndpoints,AVATAR_POSE_PLAYBACK_DEFAULTS} from '../src/avatar-pose-control.js';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const near=(actual,expected,label,epsilon=1e-8)=>assert.ok(Math.abs(actual-expected)<=epsilon,label+': '+actual+' ≈ '+expected);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const subtract=(a,b)=>a.map((value,k)=>value-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,value,k)=>sum+value*b[k],0);
const presets=Object.keys(AVATAR_POSE_PRESETS);
const posed=(mesh,name='Rest',offsets={},ground=false)=>poseAvatarMesh(mesh,resolveAvatarPose(name,offsets),{ground});
const stats=[];
let checks=0;
function inspect(mesh,rest,label){
  assert.equal(mesh.kind,'mesh',label+': real mesh');
  assert.equal(mesh.tri,rest.tri,label+': retained triangle topology');
  assert.equal(mesh.v.length,rest.v.length,label+': retained vertex layout');
  assert.ok(mesh.v.every(Number.isFinite),label+': finite coordinates');
  if(mesh.indices&&rest.indices){
    assert.equal(hash(mesh.indices),hash(rest.indices),label+': unchanged face connectivity');
    let weldError=0;for(let i=0;i<mesh.indices.length;i++)for(let k=0;k<3;k++)weldError=Math.max(weldError,Math.abs(mesh.v[i*3+k]-mesh.vertices[mesh.indices[i]*3+k]));
    near(weldError,0,label+': welded skin coordinates',1e-12);
  }
  let volume=0,minArea=Infinity;
  for(let i=0;i<mesh.v.length;i+=9){
    const a=mesh.v.slice(i,i+3),b=mesh.v.slice(i+3,i+6),c=mesh.v.slice(i+6,i+9);
    const area=Math.hypot(...cross(subtract(b,a),subtract(c,a)))/2;
    assert.ok(area>1e-15,label+': noncollapsed triangle '+i/9);
    minArea=Math.min(minArea,area);volume+=dot(a,cross(b,c))/6;
  }
  assert.ok(volume>1e-5,label+': consistently outward noncollapsed volume');
  const joints=mesh.poseJoints;
  assert.ok(joints&&Object.keys(joints).length>10,label+': articulated joints exposed');
  for(const [name,joint] of Object.entries(joints)){
    assert.ok([joint.head,joint.tail,joint.restHead,joint.restTail].every(p=>p?.length===3&&p.every(Number.isFinite)),label+': finite '+name+' joints');
    near(distance(joint.head,joint.tail),distance(joint.restHead,joint.restTail),label+': fixed '+name+' bone length',1e-7);
  }
  checks++;
  return {triangles:mesh.tri,volume,minArea,bones:Object.keys(joints).length};
}
function changeIn(rest,next,predicate){
  let count=0,sum=0,max=0;
  for(let i=0;i<rest.v.length;i+=3){
    const p=rest.v.slice(i,i+3);if(!predicate(p))continue;
    const d=distance(p,next.v.slice(i,i+3));sum+=d*d;max=Math.max(max,d);count++;
  }
  assert.ok(count>10,'independent anatomical region sampled');
  return {rms:Math.sqrt(sum/count),max,count};
}
// Authored four-weight skin has a few tiny cross-limb influences. At a 240 mm
// body these limits allow <0.24 mm at one vertex and <0.012 mm RMS, while the
// opposite skeleton below must remain exactly fixed.
function unchanged(rest,next,predicate,label,tolerance=.001){
  const movement=changeIn(rest,next,predicate);
  assert.ok(movement.max<tolerance&&movement.rms<.00005,label+': displacement '+movement.max+' / RMS '+movement.rms);checks++;
}
function moves(rest,next,predicate,label,minimum=.005){
  const movement=changeIn(rest,next,predicate);
  assert.ok(movement.rms>minimum,label+': RMS displacement '+movement.rms);checks++;
}
function matchingPositions(a,b,label,epsilon=1e-9){
  assert.equal(a.v.length,b.v.length,label+': same layout');
  let max=0;for(let i=0;i<a.v.length;i++)max=Math.max(max,Math.abs(a.v[i]-b.v[i]));
  assert.ok(max<epsilon,label+': maximum coordinate error '+max);checks++;
}
function checkPaths(drawing,label,ctx){
  assert.ok(drawing.paths.length,label+': visible drawing');
  assert.ok(drawing.paths.reduce((n,p)=>n+p.pts.length,0)<=110000,label+': point budget');
  for(const path of drawing.paths){
    assert.ok(path.pts.length>=2,label+': drawable stroke');
    for(const p of path.pts)assert.ok(p.length===2&&p.every(Number.isFinite)&&p[0]>=ctx.margin-1e-6&&p[0]<=ctx.W-ctx.margin+1e-6&&p[1]>=ctx.margin-1e-6&&p[1]<=ctx.H-ctx.margin+1e-6,label+': finite in-margin mm path');
  }
  checks++;
}

assert.equal(RIG.source.license,'CC0-1.0','authored graphical rig has retained licence metadata');
assert.equal(RIG.vertexCount,13380,'weights match source skin topology');
assert.equal(RIG.influences,4,'bounded four-influence skinning');
for(let vertex=0;vertex<RIG.vertexCount;vertex++){
  let sum=0;for(let k=0;k<RIG.influences;k++){const offset=vertex*RIG.influences+k;assert.ok(RIG.boneIndices[offset]<RIG.bones.length&&RIG.weights[offset]>=0,'valid skin weights');sum+=RIG.weights[offset];}
  near(sum,1,'normalized skin weights',1e-6);
}
for(let id=0;id<RIG.bones.length;id++){
  const seen=new Set();let parent=id;while(parent>=0){assert.ok(parent<RIG.bones.length&&!seen.has(parent),'acyclic valid bone hierarchy');seen.add(parent);parent=RIG.bones[parent].parent;}
}
checks++;

// Direct mathematical tests use physical orientations, independently of any
// chosen neck/limb joint limits or named pose preset.
const radians=degrees=>degrees*Math.PI/180;
const yaw=degrees=>[0,0,Math.sin(radians(degrees)/2),Math.cos(radians(degrees)/2)];
const rotateX=q=>[1-2*(q[1]*q[1]+q[2]*q[2]),2*(q[0]*q[1]+q[3]*q[2]),2*(q[0]*q[2]-q[3]*q[1])];
const short=poseQuaternionSlerp(yaw(170),yaw(-170),.5);
near(Math.hypot(...short),1,'slerp remains unit');
assert.ok(rotateX(short)[0]<-.999,'170 to -170 passes through 180 on the shortest arc');checks++;
const q=yaw(63),opposite=q.map(value=>-value);
for(const t of [0,.17,.5,.83,1]){
  const result=poseQuaternionSlerp(q,opposite,t);
  assert.ok(Math.abs(dot(result,q))>1-1e-9,'equivalent quaternion signs have no spin or collapse');checks++;
}
assert.ok(AVATAR_POSE_CONTROLS.length>=20,'independent controls cover requested body parts');
assert.equal(new Set(AVATAR_POSE_CONTROLS.map(c=>c.key)).size,AVATAR_POSE_CONTROLS.length,'unique pose keys');
for(const name of ['Rest','Relaxed','Contrapposto','Reach','Hands on hips','Seated','Mid-step'])assert.ok(presets.includes(name),'natural pose preset '+name);
assert.ok(Object.keys(AVATAR_POSE_DEFAULTS).length>=20,'default pose covers each independent joint control');
const invalid=normalizeAvatarPose({headTurn:Infinity,leftKnee:NaN,torsoTwist:1e8,rightElbow:-1e8});
for(const control of AVATAR_POSE_CONTROLS)assert.ok(Number.isFinite(invalid[control.key])&&invalid[control.key]>=control.min&&invalid[control.key]<=control.max,'safe range '+control.key);
checks++;
const baseline={
  Male:'ee2b6fd15fa20b960e9ea50bc398a328413981bf503344a33b870eac71c83d4c',
  Female:'1ce1cc37f0280b54f70e88d271325c37ac606546b77602b0a91f93abd250bc59',
};
const bodies={};
for(const preset of ['Male','Female']){
  const body=buildAvatarMesh({...AVATAR_DEFAULTS,preset},{quality:'draft'}),before=hash(body.v);
  assert.equal(before,baseline[preset],preset+': anatomy coordinates unchanged from before posing');checks++;
  const identity=posed(body);
  matchingPositions(body,identity,preset+': Rest is exact identity');
  for(const name of presets){
    const mesh=posed(body,name);
    stats.push({body:preset,pose:name,...inspect(mesh,body,preset+' '+name)});
  }
  assert.equal(hash(body.v),before,preset+': presets never mutate source body');checks++;
  const arm=posed(body,'Rest',{leftArmRaise:55,leftElbow:30});
  moves(body,arm,p=>p[0]>.20&&p[2]>.0,preset+': left arm independently moves');
  unchanged(body,arm,p=>p[0]<-.23&&p[2]<.30,preset+': opposite arm stays in place');
  unchanged(body,arm,p=>p[2]<-.25,preset+': arm edits preserve legs');
  for(const name of ['upperarm_r','lowerarm_r','hand_r']){near(distance(arm.poseJoints[name].head,arm.poseJoints[name].restHead),0,preset+': opposite '+name+' head is fixed',1e-10);near(distance(arm.poseJoints[name].tail,arm.poseJoints[name].restTail),0,preset+': opposite '+name+' tail is fixed',1e-10);}
  const right=posed(body,'Rest',{rightArmForward:45,rightElbow:65});
  moves(body,right,p=>p[0]<-.20&&p[2]>.0,preset+': right arm independently moves');
  unchanged(body,right,p=>p[0]>.23&&p[2]<.30,preset+': right arm does not move left arm');
  const head=posed(body,'Rest',{headTurn:40,headNod:15});
  moves(body,head,p=>p[2]>.39,preset+': head independently moves');
  unchanged(body,head,p=>p[2]<.2,preset+': head edits preserve torso and limbs');
  const torso=posed(body,'Rest',{torsoTwist:25,torsoBend:12});
  moves(body,torso,p=>p[2]>.25,preset+': torso carries upper body');
  unchanged(body,torso,p=>p[2]<-.3,preset+': torso edits preserve planted lower legs');
  const leg=posed(body,'Rest',{leftLegForward:35,leftKnee:65,leftAnkle:10});
  moves(body,leg,p=>p[0]>.03&&p[2]<-.25,preset+': left leg independently moves');
  unchanged(body,leg,p=>p[0]<-.03&&p[2]<-.3,preset+': leg edit preserves opposite foot');
  unchanged(body,leg,p=>p[2]>.25,preset+': leg edit preserves head and shoulders');
  for(const side of ['left','right']){
    const suffix=side==='left'?'l':'r',elbow=posed(body,'Rest',{[side+'Elbow']:65}),knee=posed(body,'Rest',{[side+'Knee']:65});
    const forearm=elbow.poseJoints['lowerarm_'+suffix],calf=knee.poseJoints['calf_'+suffix];
    near(distance(forearm.head,forearm.restHead),0,preset+': elbow pivots at fixed upper-arm endpoint',1e-7);
    assert.ok(forearm.tail[1]<forearm.restTail[1]-.03,preset+': positive elbow flexes the hand forward');
    near(distance(calf.head,calf.restHead),0,preset+': knee pivots at fixed thigh endpoint',1e-7);
    assert.ok(calf.tail[1]>calf.restTail[1]+.03,preset+': positive knee flexes lower leg backward');checks++;
  }
  const legRight=posed(body,'Rest',{rightLegSide:20,rightKnee:40});
  moves(body,legRight,p=>p[0]<-.03&&p[2]<-.25,preset+': right leg independently moves');
  unchanged(body,legRight,p=>p[0]>.03&&p[2]<-.3,preset+': right leg preserves left foot');
  for(const name of ['thigh_l','calf_l','foot_l']){near(distance(legRight.poseJoints[name].head,legRight.poseJoints[name].restHead),0,preset+': opposite '+name+' head is fixed',1e-10);near(distance(legRight.poseJoints[name].tail,legRight.poseJoints[name].restTail),0,preset+': opposite '+name+' tail is fixed',1e-10);}
  bodies[preset]=body;
}

// Proportion edits precede posing, so joint locations must follow the same body
// rather than retaining a fixed skeleton from one default sex or stature.
for(const [preset,changes] of [['Male',{armLength:120,legLength:125,headSize:115}],['Female',{hips:125,chestDepth:120,armThickness:130}]]){
  const body=buildAvatarMesh({...AVATAR_DEFAULTS,preset,...changes},{quality:'draft'});
  inspect(posed(body,'Reach'),body,preset+' adjusted body Reach');
  matchingPositions(body,posed(body),preset+' adjusted body identity');
}
const body=bodies.Female,bodyHash=hash(body.v);
const from=resolveAvatarPose('Relaxed',{headTurn:-20}),to=resolveAvatarPose('Reach',{headTurn:35,rightElbow:35});
const fromHash=hash(from),toHash=hash(to);
matchingPositions(posed(body,'Relaxed',{headTurn:-20}),poseAvatarMesh(body,interpolateAvatarPose(from,to,0,{easing:'Smooth'}),{ground:false}),'transition exact start');
matchingPositions(posed(body,'Reach',{headTurn:35,rightElbow:35}),poseAvatarMesh(body,interpolateAvatarPose(from,to,1,{easing:'Smooth'}),{ground:false}),'transition exact end');
const frames=new Map();
for(const phase of [0,.125,.25,.5,.75,.875,1]){
  const frame=poseAvatarMesh(body,interpolateAvatarPose(from,to,phase,{easing:'Smooth'}),{ground:false});
  frames.set(phase,hash(frame.v));inspect(frame,body,'interpolation '+phase);
}
for(const phase of [1,.5,.125,.875,0,.75,.25])assert.equal(hash(poseAvatarMesh(body,interpolateAvatarPose(from,to,phase,{easing:'Smooth'}),{ground:false}).v),frames.get(phase),'random frame seeks are deterministic at '+phase);
assert.equal(hash(from),fromHash,'interpolation keeps first pose immutable');
assert.equal(hash(to),toHash,'interpolation keeps second pose immutable');
assert.equal(hash(body.v),bodyHash,'animation keeps anatomy immutable');checks++;
const raised=posed(body,'Rest',{leftArmRaise:125,rightArmRaise:125});
assert.ok(avatarBounds(raised).max[2]>.52,'raised-arm fixture extends above standing crown');checks++;
const retained=clipAvatarMesh(raised,{mode:'Full body'});
assert.equal(retained.tri,raised.tri,'full body never slices away raised hands above standing crown');checks++;
const restBounds=avatarBounds(body),cutHeight=.73;
const cut=clipAvatarMesh(raised,{mode:'Bust',cut:cutHeight});
near(cut.cutRange[0],restBounds.min[2]+cutHeight*(restBounds.max[2]-restBounds.min[2]),'cut percentage remains tied to standing body reference');
assert.ok(cut.v.every((value,index)=>index%3!==2||value>=cut.cutRange[0]-1e-8),'posed bust respects 3D plane');checks++;
for(const preset of ['Relaxed','Contrapposto','Reach','Seated','Mid-step']){
  const grounded=posed(body,preset,{},true);
  near(avatarBounds(grounded).min[2],-.5,'grounded '+preset+' keeps the floor',5e-6);checks++;
  const bust=clipAvatarMesh(grounded,{mode:'Bust'}),feet=clipAvatarMesh(grounded,{mode:'Feet'});
  near(bust.cutRange[0],grounded.poseLandmarks.bustCut,'anatomical '+preset+' bust follows posed torso');
  near(feet.cutRange[1],grounded.poseLandmarks.feetCut,'anatomical '+preset+' feet follow posed ankles');checks++;
}

// Final plotting always receives the posed surface; the four treatments and
// 3D crop must not revert it to the original A-pose or mutate its coordinates.
const artwork=posed(body,'Contrapposto'),artworkHash=hash(artwork.v);
const context={W:210,H:297,size:260,margin:12,pen:0};
for(const style of ['Brush','Contours','Hatching','Contours + hatching']){
  const drawing=plotAvatar(artwork,{yaw:27,rotationEnvelope:'yaw'},{...AVATAR_PLOT_DEFAULTS,style},context);
  checkPaths(drawing,'posed '+style,context);
  assert.equal(hash(artwork.v),artworkHash,style+': plotting preserves pose');
}
const review=buildAvatarMesh({...AVATAR_DEFAULTS,preset:'Female'},{quality:'review'});
inspect(posed(review,'Reach'),review,'Review subdivided Reach');
// The transition envelope is computed for the whole A→B motion, not whichever
// phase happens to be displayed. Check intermediate angles not used to build it.
assert.equal(composeAvatarPose(body,{}),body,'missing/default posing preserves legacy mesh identity');checks++;
const transitionSettings={...AVATAR_POSE_PLAYBACK_DEFAULTS,posePreset:'Relaxed',poseTarget:'Reach',poseEasing:'Smooth',poseGround:false};
let reference,selectionReference,feetReference;
for(const phase of [0,.037,.125,.271,.5,.683,.875,.963,1]){
  const mesh=composeAvatarPose(body,{...transitionSettings,poseBlend:phase});
  const envelope=mesh.poseFrameBounds;
  assert.ok(envelope&&mesh.v.every((value,i)=>value>=envelope.min[i%3]-1e-7&&value<=envelope.max[i%3]+1e-7),'common envelope encloses actual skin at phase '+phase);
  const view=buildAvatarView(mesh,{yaw:31,frame:'body'}),selected=buildAvatarView(mesh,{yaw:31,mode:'Bust',cut:.73,frame:'selection'});
  if(!reference){reference=view.referenceBounds;selectionReference=selected.referenceBounds;}
  else{assert.deepEqual(view.referenceBounds,reference,'body framing does not breathe at phase '+phase);assert.deepEqual(selected.referenceBounds,selectionReference,'bust framing does not breathe at phase '+phase);}
  checks++;
  // A raised arm must not make a feet-only composition tiny. Compare against
  // actual clipped skin, including phases absent from the envelope samples.
  const feetRegion=envelope.regions?.Feet,feet=clipAvatarMesh(mesh,{mode:'Feet'});
  assert.ok(feetRegion&&feet.tri,'feet have a local transition envelope');
  assert.ok(feet.v.every((value,i)=>value>=feetRegion.min[i%3]-1e-7&&value<=feetRegion.max[i%3]+1e-7),'local feet envelope contains actual clipped skin at phase '+phase);
  const feetView=buildAvatarView(mesh,{yaw:31,mode:'Feet',frame:'selection'}).referenceBounds;
  assert.ok(feetView.max[0]-feetView.min[0]<(view.referenceBounds.max[0]-view.referenceBounds.min[0])*.6,'feet framing excludes the raised upper-body arc');
  if(feetReference)assert.deepEqual(feetView,feetReference,'local feet framing does not breathe at phase '+phase);else feetReference=feetView;
  checks++;
}
// Selected cuts share one camera frame even when a manual high slice is empty
// in the seated endpoint. Anatomical cuts can move while their framing stays fixed.
const seatedToReach={posePreset:'Seated',poseTarget:'Reach',poseGround:true,poseEasing:'Smooth'};
const selectedFrames=new Map();let foundEmpty=false,foundVisible=false;
for(const phase of [0,.25,.5,.75,1]){
  const mesh=composeAvatarPose(body,{...seatedToReach,poseBlend:phase});
  for(const [label,options] of [['manual',{mode:'Bust',cut:.85}],['bust',{mode:'Bust'}],['feet',{mode:'Feet'}]]){
    const view=buildAvatarView(mesh,{...options,frame:'selection',yaw:20});
    if(selectedFrames.has(label))assert.deepEqual(view.referenceBounds,selectedFrames.get(label),label+': selection framing stable through grounded seated transition');
    else selectedFrames.set(label,view.referenceBounds);
    if(label==='manual'){foundEmpty ||= view.mesh.tri===0;foundVisible ||= view.mesh.tri>0;}
  }
  checks++;
}
assert.ok(foundEmpty&&foundVisible,'empty-slice framing regression exercises an empty and visible frame');checks++;
const cachedComposition=composeAvatarPose(body,{...transitionSettings,poseBlend:.37});
assert.equal(composeAvatarPose(body,{...transitionSettings,poseBlend:.37,plotStyle:'Hatching',yaw:120}),cachedComposition,'style/camera edits reuse identical composed posed mesh');checks++;
for(const [index,expected] of [[0,0],[12,.25],[24,.5],[48,1]])near(avatarPoseProgress({poseMotion:'Timeline',poseCycle:'One-way'},{frameCount:49,frameIdx:index}),expected,'one-way endpoint clock');
for(const [index,expected] of [[0,0],[12,.5],[24,1],[36,.5],[48,0]])near(avatarPoseProgress({poseMotion:'Timeline',poseCycle:'Ping-pong'},{frameCount:49,frameIdx:index}),expected,'ping-pong endpoint clock');
near(avatarPoseProgress({poseMotion:'Manual',poseBlend:.37},{frameCount:49,frameIdx:48}),.37,'manual pose independent of animation frame');
near(avatarPoseProgress({poseMotion:'Timeline',poseCycle:'One-way'},{frameCount:1,frameIdx:10}),0,'one-frame animation starts at A');checks++;
const seated=avatarPoseEndpoints({posePreset:'Seated',poseA_leftKnee:-92});
near(seated.from.leftKnee,0,'negative endpoint offset can straighten a bent preset');
near(seated.from.rightKnee,92,'independent preset offset preserves opposite knee');checks++;

const {default:avatar}=await import('../src/defs/nodes/avatar3d.js');
const defaults=Object.fromEntries(avatar.params.map(p=>[p.key,p.def]));
const nodeContext={W:210,H:297,frameCount:49,frameIdx:0};
assert.equal(new Set(avatar.params.map(p=>p.key)).size,avatar.params.length,'all node keys remain unique after pose controls');
assert.deepEqual(avatar.outs.map(p=>p.type),['paths','paths','mesh'],'existing node ports preserved');
for(const endpoint of ['A','B'])for(const control of AVATAR_POSE_CONTROLS){
  const descriptor=avatar.params.find(p=>p.key==='pose'+endpoint+'_'+control.key);
  assert.ok(descriptor,'independent endpoint control '+endpoint+' '+control.key);
  assert.equal(descriptor.showIf({...defaults,poseEdit:endpoint==='A'?'Start A':'End B',poseArea:control.group}),true,'endpoint control applicability');
}
checks++;
function runNode(patch={},clock={}){
  const parameters={...defaults,...patch},before=hash(parameters),output=avatar.compute([undefined],parameters,{...nodeContext,...clock});
  assert.equal(hash(parameters),before,'node does not rewrite source parameters');
  assert.equal(output.length,3,'all three node outputs');
  assert.ok(output[0].paths.length&&output[1].paths.length,'posed node drawing and silhouette visible');
  assert.equal(output[2].kind,'mesh');checks++;
  return output;
}
const restNode=runNode();assert.equal(hash(restNode[2].v),baseline.Male,'new default node retains the pre-pose anatomy');checks++;
const nodePose={posePreset:'Contrapposto',poseTarget:'Reach',poseBlend:.35,poseA_headTurn:12,poseB_rightElbow:25};
const originalNode=runNode(nodePose),posedHash=hash(originalNode[2].v);
assert.notEqual(posedHash,hash(restNode[2].v),'full mesh port carries the pose');checks++;
for(const patch of [{plotStyle:'Contours'},{plotStyle:'Hatching'},{plotStyle:'Contours + hatching'},
  {view:'Back'},{view:'Manual',yaw:79,pitch:12,roll:5},{cutMode:'Bust'},
  {cutMode:'Feet',framing:'Selected region'},{cutMode:'Band',cutPosition:'Manual',cutHeight:45},
  {styleSeed:805},{linePitch:1.3},{motion:'Timeline',animation:'Rotating bust'}]){
  const result=runNode({...nodePose,...patch},{frameIdx:15});
  assert.equal(hash(result[2].v),posedHash,'drawing/camera/cut settings preserve posed mesh '+JSON.stringify(patch));
}
for(const easing of ['Linear','Smooth'])for(const cycle of ['One-way','Ping-pong']){
  const phase=avatarPoseProgress({poseMotion:'Timeline',poseCycle:cycle},{frameCount:49,frameIdx:12});
  const timeline=runNode({...nodePose,poseMotion:'Timeline',poseCycle:cycle,poseEasing:easing},{frameIdx:12});
  const manual=runNode({...nodePose,poseMotion:'Manual',poseBlend:phase,poseEasing:easing},{frameIdx:37});
  assert.equal(hash(timeline[2].v),hash(manual[2].v),'node timeline/manual poses agree '+cycle+' '+easing);
  assert.equal(hash(timeline[0].paths),hash(manual[0].paths),'node timeline/manual artwork agrees '+cycle+' '+easing);checks++;
}
const combinedTimeline=runNode({...nodePose,poseMotion:'Timeline',poseCycle:'One-way',motion:'Timeline',animation:'Turntable'},{frameIdx:12});
const combinedManual=runNode({...nodePose,poseMotion:'Manual',poseBlend:.25,motion:'Manual',animation:'Turntable',phase:12/49});
assert.equal(hash(combinedTimeline[0].paths),hash(combinedManual[0].paths),'pose transition and camera turntable remain independently timed');checks++;
assert.equal(hash(body.v),bodyHash,'node animation never mutates original anatomy');checks++;
console.log(JSON.stringify({checks,presets,examples:stats},null,2));
console.log('PASS: '+checks+' Avatar pose checks: identity, independent limbs, fixed bones, grounded presets, quaternion transitions, deterministic seeking, clipping and plotting.');
