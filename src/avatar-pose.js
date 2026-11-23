/** FK posing of the authored MakeHuman skin; anatomy and the bind frame stay fixed. */
import RIG from './assets/avatar-makehuman-rig.js';
import {getAvatarBindData,refineAvatarPoseSurface} from './avatar-geometry.js';

const control=(key,label,group,min,max)=>({key,label,group,min,max,offsetMin:min-max,offsetMax:max-min,step:1,def:0});
export const AVATAR_POSE_CONTROLS=Object.freeze([
  control('torsoBend','Torso bend °','Torso',-40,65),control('torsoSide','Torso side bend °','Torso',-40,40),control('torsoTwist','Torso twist °','Torso',-70,70),
  control('pelvisTilt','Pelvis tilt °','Torso',-25,25),control('pelvisSide','Pelvis weight shift °','Torso',-20,20),
  control('headTurn','Head turn °','Head',-85,85),control('headNod','Head nod °','Head',-45,55),control('headTilt','Head tilt °','Head',-40,40),
  ...['left','right'].flatMap(side=>{const group=side==='left'?'Left arm':'Right arm',label=side==='left'?'Left':'Right';return[
    control(side+'ArmRaise',label+' arm side raise °',group,-55,155),control(side+'ArmForward',label+' arm forward °',group,-65,155),control(side+'ArmTwist',label+' arm twist °',group,-95,95),
    control(side+'Elbow',label+' elbow bend °',group,-15,135),control(side+'Wrist',label+' wrist bend °',group,-55,55),
  ];}),
  ...['left','right'].flatMap(side=>{const group=side==='left'?'Left leg':'Right leg',label=side==='left'?'Left':'Right';return[
    control(side+'LegForward',label+' hip forward °',group,-45,115),control(side+'LegSide',label+' hip side °',group,-25,65),control(side+'LegTwist',label+' leg turn °',group,-55,55),
    control(side+'Knee',label+' knee bend °',group,0,135),control(side+'Ankle',label+' ankle flex °',group,-35,45),
  ];}),
]);
export const AVATAR_POSE_DEFAULTS=Object.freeze({preset:'Rest',...Object.fromEntries(AVATAR_POSE_CONTROLS.map(c=>[c.key,0]))});
const preset=values=>Object.freeze({...values});
export const AVATAR_POSE_PRESETS=Object.freeze({
  Rest:preset({}),
  Relaxed:preset({leftArmRaise:-40,rightArmRaise:-40,leftElbow:-9,rightElbow:-9,leftWrist:-3,rightWrist:-3,leftLegSide:-2,rightLegSide:-2}),
  Contrapposto:preset({pelvisSide:-6,torsoSide:6,torsoTwist:-5,headTurn:9,headTilt:-3,leftArmRaise:-40,rightArmRaise:-37,leftElbow:-5,rightElbow:8,leftLegSide:-3,rightLegSide:5,leftKnee:0,rightKnee:11,rightAnkle:7}),
  Reach:preset({leftArmRaise:112,leftArmForward:12,leftElbow:3,leftWrist:4,rightArmRaise:-38,rightElbow:-5,torsoSide:-8,torsoTwist:-9,headTurn:18,headNod:-13,rightKnee:5}),
  'Hands on hips':preset({leftArmRaise:-10,rightArmRaise:-10,leftArmForward:20,rightArmForward:20,leftArmTwist:90,rightArmTwist:-90,leftElbow:20,rightElbow:20,leftWrist:-35,rightWrist:-35,torsoTwist:3,headTurn:-8}),
  Seated:preset({leftArmRaise:-36,rightArmRaise:-36,leftArmForward:28,rightArmForward:28,leftElbow:18,rightElbow:18,leftLegForward:92,rightLegForward:92,leftLegSide:3,rightLegSide:3,leftKnee:92,rightKnee:92,leftAnkle:-2,rightAnkle:-2,torsoBend:5}),
  'Mid-step':preset({leftArmRaise:-38,rightArmRaise:-38,leftArmForward:-20,rightArmForward:24,leftElbow:12,rightElbow:22,leftLegForward:25,rightLegForward:-17,leftKnee:9,rightKnee:35,leftAnkle:8,rightAnkle:-12,torsoBend:4,torsoTwist:-6,headTurn:4}),
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,d=0)=>Number.isFinite(+v)?+v:d;
const identity=()=>[0,0,0,1];
const add=(a,b)=>a.map((v,k)=>v+b[k]);
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a);return l>1e-12?scale(a,1/l):[1,0,0];};
const qUnit=q=>{const l=Math.hypot(...q);return l>1e-12?scale(q,1/l):identity();};
const qConj=q=>[-q[0],-q[1],-q[2],q[3]];
const qMul=(a,b)=>[
  a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
  a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2],
];
const qRotate=(q,p)=>{const u=q.slice(0,3),uv=cross(u,p),uuv=cross(u,uv);return p.map((v,k)=>v+2*(q[3]*uv[k]+uuv[k]));};
const qAxis=(axis,degrees)=>{const a=unit(axis),angle=degrees*Math.PI/360,s=Math.sin(angle);return[a[0]*s,a[1]*s,a[2]*s,Math.cos(angle)];};
const qEuler=(x,y,z)=>qUnit(qMul(qAxis([0,0,1],z),qMul(qAxis([0,1,0],y),qAxis([1,0,0],x))));
/** Unit quaternion shortest-arc interpolation, including antipodal encodings. */
export function poseQuaternionSlerp(from,to,amount){
  const a=qUnit(from),t=clamp(number(amount),0,1);let b=qUnit(to),cos=dot(a,b);
  if(cos<0){b=scale(b,-1);cos=-cos;}
  if(cos>.9995)return qUnit(a.map((v,k)=>v+(b[k]-v)*t));
  const angle=Math.acos(clamp(cos,-1,1)),sin=Math.sin(angle),u=Math.sin((1-t)*angle)/sin,v=Math.sin(t*angle)/sin;
  return qUnit(a.map((n,k)=>n*u+b[k]*v));
}
export function normalizeAvatarPose(values={}){
  const result={...AVATAR_POSE_DEFAULTS,preset:Object.hasOwn(AVATAR_POSE_PRESETS,values.preset)?values.preset:'Rest',resolved:true};
  for(const c of AVATAR_POSE_CONTROLS)result[c.key]=clamp(number(values[c.key],0),c.min,c.max);
  if(values.rotations)result.rotations=Object.fromEntries(Object.entries(values.rotations).filter(([,q])=>Array.isArray(q)&&q.length===4&&q.every(Number.isFinite)).map(([key,q])=>[key,qUnit(q)]));
  if(values.transition)result.transition=values.transition;
  return result;
}
export function resolveAvatarPose(name='Rest',offsets={}){
  if(name&&typeof name==='object')return name.resolved?normalizeAvatarPose(name):resolveAvatarPose(name.preset||name.posePreset||'Rest',name);
  const presetName=Object.hasOwn(AVATAR_POSE_PRESETS,name)?name:'Rest',base=AVATAR_POSE_PRESETS[presetName],result={preset:presetName};
  for(const c of AVATAR_POSE_CONTROLS)result[c.key]=number(base[c.key])+number(offsets[c.key]);
  if(offsets.rotations)result.rotations=offsets.rotations;
  return normalizeAvatarPose(result);
}
const resolved=value=>typeof value==='string'?resolveAvatarPose(value):resolveAvatarPose(value||{});
/** Joint rotations are slerped on the morphed bind rig when the pose is applied. */
export function interpolateAvatarPose(from,to,amount,options={}){
  const a=resolved(from),b=resolved(to),raw=clamp(number(amount),0,1),t=String(options.easing||'Smooth').toLowerCase()==='linear'?raw:raw*raw*(3-2*raw);
  if(t<=0)return a;if(t>=1)return b;
  const out={preset:a.preset,resolved:true};for(const c of AVATAR_POSE_CONTROLS)out[c.key]=a[c.key]+(b[c.key]-a[c.key])*t;
  out.transition={from:a,to:b,amount:t};return out;
}
const RIG_CACHE=new WeakMap(),COARSE_CACHE=new WeakMap(),POSE_CACHE=new WeakMap();
function endpoint(bind,definition){
  if(definition.strategy==='CUBE'&&bind.joints[definition.cube_name])return [...bind.joints[definition.cube_name]];
  if(definition.strategy==='MEAN'&&definition.vertex_indices?.length){const out=[0,0,0];for(const id of definition.vertex_indices)for(let k=0;k<3;k++)out[k]+=bind.sourcePositions[id*3+k]/definition.vertex_indices.length;return out;}
  return bind.sourceToCanonical(definition.fallback||[0,0,0]);
}
function rigFor(mesh){
  if(RIG_CACHE.has(mesh))return RIG_CACHE.get(mesh);
  const bind=getAvatarBindData(mesh),bones=RIG.bones.map(bone=>({...bone,head:endpoint(bind,bone.head),tail:endpoint(bind,bone.tail)}));
  const named=Object.fromEntries(bones.map(b=>[b.name,b])),result={bind,bones,named};RIG_CACHE.set(mesh,result);return result;
}
function localRotations(rig,p){
  if(p.transition){const a=localRotations(rig,resolved(p.transition.from)),b=localRotations(rig,resolved(p.transition.to));return a.map((q,i)=>poseQuaternionSlerp(q,b[i],p.transition.amount));}
  return rig.bones.map(bone=>{
    if(p.rotations?.[bone.name])return qUnit(p.rotations[bone.name]);
    const name=bone.name;
    if(name==='pelvis')return qEuler(p.pelvisTilt,p.pelvisSide,0);
    if(name.startsWith('spine_')){const share=name==='spine_01'?.30:.35;return qEuler(p.torsoBend*share,p.torsoSide*share,p.torsoTwist*share);}
    if(name==='neck_01'||name==='head'){const share=name==='neck_01'?.30:.70;return qEuler(p.headNod*share,p.headTilt*share,p.headTurn*share);}
    const side=name.endsWith('_l')?'left':name.endsWith('_r')?'right':null;if(!side)return identity();const sign=side==='left'?1:-1;
    const upper=rig.named['upperarm_'+(sign===1?'l':'r')],thigh=rig.named['thigh_'+(sign===1?'l':'r')];
    if(name.startsWith('clavicle_'))return qEuler(-p[side+'ArmForward']*.12,-sign*p[side+'ArmRaise']*.14,0);
    if(name.startsWith('upperarm_')){
      const swing=qEuler(-p[side+'ArmForward']*.88,-sign*p[side+'ArmRaise']*.86,0),twist=qAxis(sub(bone.tail,bone.head),p[side+'ArmTwist']);return qMul(swing,twist);
    }
    if(name.startsWith('lowerarm_')||name.startsWith('hand_')){const axis=cross(unit(sub(upper.tail,upper.head)),[0,-1,0]);return qAxis(axis,p[side+(name.startsWith('lowerarm_')?'Elbow':'Wrist')]);}
    if(name.startsWith('thigh_'))return qMul(qEuler(-p[side+'LegForward'],-sign*p[side+'LegSide'],0),qAxis(sub(bone.tail,bone.head),-sign*p[side+'LegTwist']));
    if(name.startsWith('calf_'))return qAxis(cross(unit(sub(thigh.tail,thigh.head)),[0,1,0]),p[side+'Knee']);
    if(name.startsWith('foot_'))return qAxis([1,0,0],-p[side+'Ankle']);
    return identity();
  });
}
function transformsFor(rig,p){
  const locals=localRotations(rig,p),global=[],joints={},rotations={};
  rig.bones.forEach((bone,i)=>{
    const parent=bone.parent>=0?global[bone.parent]:{q:identity(),t:[0,0,0]},q=qUnit(qMul(parent.q,locals[i])),head=add(qRotate(parent.q,bone.head),parent.t),t=sub(head,qRotate(q,bone.head));
    const dual=scale(qMul([...t,0],q),.5);global.push({q,t,dual});
    joints[bone.name]={head,tail:add(qRotate(q,bone.tail),t),parent:bone.parentName||null,restHead:[...bone.head],restTail:[...bone.tail]};rotations[bone.name]=[...q];
  });return {global,joints,rotations};
}
function skinPoint(position,sourceId,transforms){
  const qr=[0,0,0,0],qd=[0,0,0,0];let reference=null;
  for(let slot=0;slot<RIG.influences;slot++){
    const offset=sourceId*RIG.influences+slot,w=RIG.weights[offset];if(w<=0)continue;
    const transform=transforms[RIG.boneIndices[offset]],sign=reference&&dot(reference,transform.q)<0?-1:1;
    if(!reference)reference=transform.q;
    for(let k=0;k<4;k++){qr[k]+=transform.q[k]*w*sign;qd[k]+=transform.dual[k]*w*sign;}
  }
  const n=Math.hypot(...qr)||1;for(let k=0;k<4;k++){qr[k]/=n;qd[k]/=n;}
  const projection=dot(qr,qd);for(let k=0;k<4;k++)qd[k]-=qr[k]*projection;
  const translation=qMul(qd,qConj(qr)),rotated=qRotate(qr,position);return rotated.map((v,k)=>v+2*translation[k]);
}
function boundsOf(positions){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],positions[i+k]);max[k]=Math.max(max[k],positions[i+k]);}return {min,max,center:min.map((v,k)=>(v+max[k])/2),dims:min.map((v,k)=>max[k]-v)};}
function poseKey(p,options){return JSON.stringify([p,options.ground!==false]);}
function coarseFor(mesh,pose,options={}){
  const p=resolved(pose),key=poseKey(p,options);let cache=COARSE_CACHE.get(mesh);if(!cache){cache=new Map();COARSE_CACHE.set(mesh,cache);}if(cache.has(key))return cache.get(key);
  const rig=rigFor(mesh),transforms=transformsFor(rig,p),positions=new Float64Array(rig.bind.positions.length);
  let footMin=Infinity;
  const footIds=new Set(rig.bones.map((b,i)=>b.name.startsWith('foot_')?i:-1).filter(i=>i>=0));
  for(let id=0;id<positions.length/3;id++){
    const sourceId=rig.bind.sourceVertexIds[id],q=skinPoint(rig.bind.positions.slice(id*3,id*3+3),sourceId,transforms.global);positions.set(q,id*3);
    let footWeight=0;for(let slot=0;slot<RIG.influences;slot++){const offset=sourceId*RIG.influences+slot;if(footIds.has(RIG.boneIndices[offset]))footWeight+=RIG.weights[offset];}if(footWeight>.45)footMin=Math.min(footMin,q[2]);
  }
  const zero=!p.transition&&!p.rotations&&AVATAR_POSE_CONTROLS.every(c=>p[c.key]===0);
  const groundShift=!zero&&options.ground!==false&&Number.isFinite(footMin)?-.5-footMin:0;
  if(Math.abs(groundShift)>1e-12){for(let i=2;i<positions.length;i+=3)positions[i]+=groundShift;for(const joint of Object.values(transforms.joints)){joint.head[2]+=groundShift;joint.tail[2]+=groundShift;}}
  const out={positions,bounds:boundsOf(positions),joints:transforms.joints,rotations:transforms.rotations,pose:p,groundShift};cache.set(key,out);while(cache.size>5)cache.delete(cache.keys().next().value);return out;
}
function landmarksFor(restMesh,joints,bounds){
  const meanZ=names=>names.reduce((sum,name)=>sum+joints[name].head[2]/names.length,0);
  const waist=joints.spine_02.head[2],chest=joints.spine_03.tail[2],ankle=meanZ(['foot_l','foot_r']);
  const result={...restMesh.landmarks,ground:bounds.min[2],crown:bounds.max[2],waist,chest,hip:joints.pelvis.head[2],knee:meanZ(['calf_l','calf_r']),ankle,shoulder:meanZ(['upperarm_l','upperarm_r']),chin:joints.head.head[2]-.035,bustCut:waist+(chest-waist)*.64,feetCut:ankle+.024};
  result.bust=result.bustCut+.5;result.feet=result.feetCut+.5;return result;
}
/** Joint-only forward kinematics; useful for pose guides without skinning. */
export function avatarPoseSkeleton(restMesh,pose){const result=transformsFor(rigFor(restMesh),resolved(pose));return {joints:result.joints,rotations:result.rotations};}
function regionBounds(positions,indices,cut,above){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  const include=p=>{for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}};
  for(let i=0;i<indices.length;i+=3){
    const points=[0,1,2].map(k=>Array.from(positions.slice(indices[i+k]*3,indices[i+k]*3+3)));
    for(let k=0;k<3;k++){
      const a=points[k],b=points[(k+1)%3],inside=above?a[2]>=cut:a[2]<=cut;
      if(inside)include(a);
      if((a[2]-cut)*(b[2]-cut)<0){const t=(cut-a[2])/(b[2]-a[2]);include(a.map((v,j)=>v+(b[j]-v)*t));}
    }
  }
  return Number.isFinite(min[0])?{min,max}:null;
}
/** Bounds sampling skips subdivision and large flattened triangle buffers. */
export function poseAvatarBounds(restMesh,pose,options={}){
  const coarse=coarseFor(restMesh,pose,options),poseLandmarks=landmarksFor(restMesh,coarse.joints,coarse.bounds);
  const indices=rigFor(restMesh).bind.indices;
  return {...coarse.bounds,poseLandmarks,groundShift:coarse.groundShift,regionBounds:{Bust:regionBounds(coarse.positions,indices,poseLandmarks.bustCut,true),Feet:regionBounds(coarse.positions,indices,poseLandmarks.feetCut,false)}};
}
export function avatarPoseFrame(restMesh){
  const rig=rigFor(restMesh),pelvis=rig.named.pelvis.head;let reach=0;
  for(const bone of rig.bones){let length=0,current=bone;while(current&&current.parent>=0){length+=Math.hypot(...sub(current.tail,current.head));current=rig.bones[current.parent];}reach=Math.max(reach,length);}
  const radius=Math.max(.72,reach*.85);return {min:[pelvis[0]-radius,pelvis[1]-radius,-.55],max:[pelvis[0]+radius,pelvis[1]+radius,pelvis[2]+radius]};
}
/** Pose in the immutable anatomy mesh's bind coordinates. No frame-wise fitting. */
export function poseAvatarMesh(restMesh,pose=AVATAR_POSE_DEFAULTS,options={}){
  if(!restMesh?.vertices||!restMesh?.indices)throw new Error('Avatar posing needs a full anatomy mesh.');
  const p=resolved(pose),key=poseKey(p,options);let cache=POSE_CACHE.get(restMesh);if(!cache){cache=new Map();POSE_CACHE.set(restMesh,cache);}if(cache.has(key))return cache.get(key);
  const coarse=coarseFor(restMesh,p,options),zero=!p.transition&&!p.rotations&&AVATAR_POSE_CONTROLS.every(c=>p[c.key]===0),positions=zero&&Math.abs(coarse.groundShift)<1e-9?restMesh.vertices:refineAvatarPoseSurface(restMesh,coarse.positions),indices=restMesh.indices;
  const v=positions===restMesh.vertices?restMesh.v:new Array(indices.length*3);
  const poseJoints=Object.fromEntries(Object.entries(coarse.joints).map(([name,joint])=>[name,{...joint,head:[...joint.head],tail:[...joint.tail]}]));
  let groundShift=coarse.groundShift;
  if(!zero&&options.ground!==false){
    let minimum=Infinity;for(let i=2;i<positions.length;i+=3)minimum=Math.min(minimum,positions[i]);
    const extra=-.5-minimum;groundShift+=extra;
    if(Math.abs(extra)>1e-12){for(let i=2;i<positions.length;i+=3)positions[i]+=extra;for(const joint of Object.values(poseJoints)){joint.head[2]+=extra;joint.tail[2]+=extra;}}
  }
  // Flatten after the final floor correction so triangles and indexed vertices agree.
  if(v!==restMesh.v)for(let i=0;i<indices.length;i++)for(let k=0;k<3;k++)v[i*3+k]=positions[indices[i]*3+k];
  const bounds=boundsOf(positions),sourceBounds=restMesh.sourceBounds||{min:[...restMesh.bounds.min],max:[...restMesh.bounds.max]};
  const poseLandmarks=landmarksFor(restMesh,poseJoints,bounds);
  const out={...restMesh,v,vertices:positions,indices,dims:bounds.dims,bounds,sourceBounds,cutReferenceBounds:sourceBounds,poseLandmarks,pose:p,poseJoints,poseRotations:coarse.rotations,poseFrameBounds:avatarPoseFrame(restMesh),groundShift,
    metadata:{...restMesh.metadata,pose:p.preset,posed:true,skinning:'dual quaternion',grounded:options.ground!==false}};
  Object.defineProperty(out,'restMesh',{value:restMesh,enumerable:false});cache.set(key,out);while(cache.size>4)cache.delete(cache.keys().next().value);return out;
}
