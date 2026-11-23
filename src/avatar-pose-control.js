/* Shared pose endpoints, clock and steady framing for the node and review. */
import {AVATAR_POSE_CONTROLS,AVATAR_POSE_PRESETS,resolveAvatarPose,interpolateAvatarPose,poseAvatarMesh,poseAvatarBounds} from './avatar-pose.js';
import {normalizeAvatarWalkOptions,avatarWalkPhase,avatarWalkPose} from './avatar-walk.js';
import {normalizeAvatarLocomotionOptions,avatarLocomotionPhase,avatarLocomotionBlend,avatarLocomotionPose} from './avatar-locomotion.js';
const ENVELOPES=new WeakMap(),COMPOSITIONS=new WeakMap();
const WALK_ENVELOPES=new WeakMap(),WALK_COMPOSITIONS=new WeakMap();
const GAIT_ENVELOPES=new WeakMap(),GAIT_COMPOSITIONS=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,d=0)=>Number.isFinite(+v)?+v:d;
export const AVATAR_POSE_OFFSET_CONTROLS=Object.freeze(AVATAR_POSE_CONTROLS.map(c=>({...c,label:c.label.replace(' °',' offset °'),min:c.min-c.max,max:c.max-c.min})));
export const AVATAR_POSE_NAMES=Object.freeze(Object.keys(AVATAR_POSE_PRESETS));
export const AVATAR_POSE_PLAYBACK_DEFAULTS=Object.freeze({posePreset:'Rest',poseTarget:'Rest',poseBlend:0,poseMotion:'Manual',poseCycle:'Ping-pong',poseEasing:'Smooth',poseGround:false,poseEdit:'Start A',poseArea:'Torso'});
export function avatarPoseEndpoints(parameters={}){
  const offsets=side=>Object.fromEntries(AVATAR_POSE_OFFSET_CONTROLS.map(c=>[c.key,clamp(number(parameters['pose'+side+'_'+c.key]),c.min,c.max)]));
  return {from:resolveAvatarPose(parameters.posePreset||'Rest',offsets('A')),to:resolveAvatarPose(parameters.poseTarget||'Rest',offsets('B'))};
}
export function avatarPoseProgress(parameters={},context={}){
  if(parameters.poseMotion!=='Timeline')return clamp(number(parameters.poseBlend),0,1);
  const count=Math.max(1,Math.floor(number(context.frameCount,1))),index=clamp(Math.floor(number(context.frameIdx)),0,count-1);
  const t=count>1?index/(count-1):0;
  return parameters.poseCycle==='One-way'?t:1-Math.abs(1-2*t);
}
function transitionEnvelope(restMesh,from,to,options){
  let entries=ENVELOPES.get(restMesh);if(!entries){entries=new Map();ENVELOPES.set(restMesh,entries);}
  const key=JSON.stringify([from,to,options.ground]);if(entries.has(key))return entries.get(key);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],cuts={Bust:[Infinity,-Infinity],Feet:[Infinity,-Infinity]},regions=Object.fromEntries(['Bust','Feet'].map(name=>[name,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}]));
  // Sampling is independent of the displayed time. A small geometric guard
  // encloses the curved trajectories between samples without per-frame refits.
  for(let step=0;step<=8;step++){
    const pose=interpolateAvatarPose(from,to,step/8,{easing:'Linear'}),bounds=poseAvatarBounds(restMesh,pose,options);
    for(let k=0;k<3;k++){min[k]=Math.min(min[k],bounds.min[k]);max[k]=Math.max(max[k],bounds.max[k]);}
    for(const name of ['Bust','Feet'])if(bounds.regionBounds?.[name])for(let k=0;k<3;k++){regions[name].min[k]=Math.min(regions[name].min[k],bounds.regionBounds[name].min[k]);regions[name].max[k]=Math.max(regions[name].max[k],bounds.regionBounds[name].max[k]);}
    for(const [name,landmark] of [['Bust','bustCut'],['Feet','feetCut']]){const value=bounds.poseLandmarks?.[landmark]??restMesh.landmarks?.[landmark];if(Number.isFinite(value)){cuts[name][0]=Math.min(cuts[name][0],value);cuts[name][1]=Math.max(cuts[name][1],value);}}
  }
  const guard=.025,result={min:min.map(v=>v-guard),max:max.map(v=>v+guard),cutRanges:Object.fromEntries(Object.entries(cuts).map(([name,range])=>[name,[range[0]-guard,range[1]+guard]])),regions:Object.fromEntries(Object.entries(regions).filter(([,b])=>Number.isFinite(b.min[0])).map(([name,b])=>[name,{min:b.min.map(v=>v-guard),max:b.max.map(v=>v+guard)}]))};
  entries.set(key,result);while(entries.size>4)entries.delete(entries.keys().next().value);return result;
}
export function composeAvatarPose(restMesh,parameters={},context={}){
  if(parameters.poseMode==='Stand / walk / run')return composeAvatarLocomotion(restMesh,parameters,context);
  if(parameters.poseMode==='Walk cycle')return composeAvatarWalk(restMesh,parameters,context);
  const {from,to}=avatarPoseEndpoints(parameters);
  const ground=parameters.poseGround===true;
  const active=ground||[from,to].some(p=>AVATAR_POSE_CONTROLS.some(c=>p[c.key]!==0));
  if(!active)return restMesh;
  const blend=avatarPoseProgress(parameters,context),easing=parameters.poseEasing==='Linear'?'Linear':'Smooth';
  let cached=COMPOSITIONS.get(restMesh);if(!cached){cached=new Map();COMPOSITIONS.set(restMesh,cached);}
  const key=JSON.stringify([from,to,blend,easing,ground]);if(cached.has(key))return cached.get(key);
  const resolved=interpolateAvatarPose(from,to,blend,{easing}),posed=poseAvatarMesh(restMesh,resolved,{ground});
  const frame=transitionEnvelope(restMesh,from,to,{ground});
  const result={...posed,poseFrameBounds:frame,poseCutFrameRanges:frame.cutRanges,cutReferenceLandmarks:restMesh.landmarks,
    metadata:{...posed.metadata,poseStart:from.preset,poseEnd:to.preset,poseBlend:blend,poseEasing:easing}};
  Object.defineProperty(result,'restMesh',{value:restMesh,enumerable:false});
  cached.set(key,result);while(cached.size>5)cached.delete(cached.keys().next().value);return result;
}

function walkEnvelope(restMesh,options,offsets){
  let entries=WALK_ENVELOPES.get(restMesh);if(!entries){entries=new Map();WALK_ENVELOPES.set(restMesh,entries);}
  const key=JSON.stringify([options.walkStride,options.walkArmSwing,options.walkGround,offsets]);
  if(entries.has(key))return entries.get(key);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],cuts={Bust:[Infinity,-Infinity],Feet:[Infinity,-Infinity]};
  const regions=Object.fromEntries(['Bust','Feet'].map(name=>[name,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}]));
  for(let step=0;step<16;step++){
    const bounds=poseAvatarBounds(restMesh,avatarWalkPose(step/16,options,offsets),{ground:options.walkGround});
    for(let k=0;k<3;k++){min[k]=Math.min(min[k],bounds.min[k]);max[k]=Math.max(max[k],bounds.max[k]);}
    for(const name of ['Bust','Feet'])if(bounds.regionBounds?.[name])for(let k=0;k<3;k++){
      regions[name].min[k]=Math.min(regions[name].min[k],bounds.regionBounds[name].min[k]);
      regions[name].max[k]=Math.max(regions[name].max[k],bounds.regionBounds[name].max[k]);
    }
    for(const [name,landmark] of [['Bust','bustCut'],['Feet','feetCut']]){const value=bounds.poseLandmarks?.[landmark]??restMesh.landmarks?.[landmark];if(Number.isFinite(value)){cuts[name][0]=Math.min(cuts[name][0],value);cuts[name][1]=Math.max(cuts[name][1],value);}}
  }
  const guard=.025,frame={min:min.map(v=>v-guard),max:max.map(v=>v+guard),
    cutRanges:Object.fromEntries(Object.entries(cuts).map(([name,range])=>[name,[range[0]-guard,range[1]+guard]])),
    regions:Object.fromEntries(Object.entries(regions).filter(([,b])=>Number.isFinite(b.min[0])).map(([name,b])=>[name,{min:b.min.map(v=>v-guard),max:b.max.map(v=>v+guard)}]))};
  entries.set(key,frame);while(entries.size>4)entries.delete(entries.keys().next().value);return frame;
}

export function composeAvatarWalk(restMesh,parameters={},context={}){
  const options=normalizeAvatarWalkOptions(parameters),phase=avatarWalkPhase(parameters,context);
  const offsets=Object.fromEntries(AVATAR_POSE_OFFSET_CONTROLS.map(c=>[c.key,clamp(number(parameters['poseA_'+c.key]),c.min,c.max)]));
  let cached=WALK_COMPOSITIONS.get(restMesh);if(!cached){cached=new Map();WALK_COMPOSITIONS.set(restMesh,cached);}
  const key=JSON.stringify([options.walkStride,options.walkArmSwing,options.walkGround,offsets,phase]);if(cached.has(key))return cached.get(key);
  const pose=avatarWalkPose(phase,options,offsets),posed=poseAvatarMesh(restMesh,pose,{ground:options.walkGround});
  const frame=walkEnvelope(restMesh,options,offsets),result={...posed,poseFrameBounds:frame,poseCutFrameRanges:frame.cutRanges,cutReferenceLandmarks:restMesh.landmarks,
    metadata:{...posed.metadata,poseMode:'Walk cycle',walkPhase:phase,walkStride:options.walkStride,walkArmSwing:options.walkArmSwing,walkGround:options.walkGround}};
  Object.defineProperty(result,'restMesh',{value:restMesh,enumerable:false});
  cached.set(key,result);while(cached.size>8)cached.delete(cached.keys().next().value);return result;
}

function liftedBounds(bounds,lift){return {min:bounds.min.map((v,k)=>v+(k===2?lift:0)),max:bounds.max.map((v,k)=>v+(k===2?lift:0))};}
function locomotionEnvelope(restMesh,options,offsets){
  let entries=GAIT_ENVELOPES.get(restMesh);if(!entries){entries=new Map();GAIT_ENVELOPES.set(restMesh,entries);}
  // The entire family shares one envelope, so changing a transition's endpoints
  // or scrubbing its blend cannot resize the figure or invalidate this cache.
  const key=JSON.stringify([options.gaitStride,options.gaitArmSwing,options.gaitGround,offsets]);
  if(entries.has(key))return entries.get(key);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],cuts={Bust:[Infinity,-Infinity],Feet:[Infinity,-Infinity]};
  const regions=Object.fromEntries(['Bust','Feet'].map(name=>[name,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}]));
  // Twelve phases at each key gait, plus intermediate blends at four cardinal
  // phases, bound the whole family without repeating skinning for each frame.
  const samples=[...Array.from({length:12},(_,i)=>[i/12,0]),...Array.from({length:12},(_,i)=>[i/12,1]),...Array.from({length:12},(_,i)=>[i/12,2]),...Array.from({length:4},(_,i)=>[i/4,.5]),...Array.from({length:4},(_,i)=>[i/4,1.5])];
  for(const [phase,level] of samples){
    if(level===0&&phase!==0)continue;
    const pose=avatarLocomotionPose(phase,{...options,gaitFrom:'Standing',gaitTo:'Running',gaitBlend:level/2},offsets),lift=pose.locomotion.rootLift;
    const bounds=poseAvatarBounds(restMesh,pose,{ground:options.gaitGround}),shifted=liftedBounds(bounds,lift);
    for(let k=0;k<3;k++){min[k]=Math.min(min[k],shifted.min[k]);max[k]=Math.max(max[k],shifted.max[k]);}
    for(const name of ['Bust','Feet'])if(bounds.regionBounds?.[name]){
      const region=liftedBounds(bounds.regionBounds[name],lift);
      for(let k=0;k<3;k++){regions[name].min[k]=Math.min(regions[name].min[k],region.min[k]);regions[name].max[k]=Math.max(regions[name].max[k],region.max[k]);}
    }
    for(const [name,landmark] of [['Bust','bustCut'],['Feet','feetCut']]){const value=bounds.poseLandmarks?.[landmark];if(Number.isFinite(value)){cuts[name][0]=Math.min(cuts[name][0],value+lift);cuts[name][1]=Math.max(cuts[name][1],value+lift);}}
  }
  const guard=.04,frame={min:min.map(v=>v-guard),max:max.map(v=>v+guard),
    cutRanges:Object.fromEntries(Object.entries(cuts).map(([name,range])=>[name,[range[0]-guard,range[1]+guard]])),
    regions:Object.fromEntries(Object.entries(regions).filter(([,b])=>Number.isFinite(b.min[0])).map(([name,b])=>[name,{min:b.min.map(v=>v-guard),max:b.max.map(v=>v+guard)}]))};
  entries.set(key,frame);while(entries.size>3)entries.delete(entries.keys().next().value);return frame;
}
function liftPosedMesh(mesh,lift){
  if(lift<=1e-12)return mesh;
  const shift=p=>p.map((v,k)=>v+(k===2?lift:0));
  const vertices=Array.from(mesh.vertices),v=Array.from(mesh.v);
  for(let i=2;i<vertices.length;i+=3)vertices[i]+=lift;
  for(let i=2;i<v.length;i+=3)v[i]+=lift;
  const poseJoints=Object.fromEntries(Object.entries(mesh.poseJoints).map(([name,j])=>[name,{...j,head:shift(j.head),tail:shift(j.tail)}]));
  const poseLandmarks=Object.fromEntries(Object.entries(mesh.poseLandmarks).map(([key,value])=>[key,Number.isFinite(value)?value+lift:value]));
  const bounds={...mesh.bounds,...liftedBounds(mesh.bounds,lift),center:shift(mesh.bounds.center)};
  return {...mesh,vertices,v,bounds,poseJoints,poseLandmarks};
}
export function composeAvatarLocomotion(restMesh,parameters={},context={}){
  const options=normalizeAvatarLocomotionOptions(parameters),phase=avatarLocomotionPhase(options,context),blend=avatarLocomotionBlend(options,context);
  const offsets=Object.fromEntries(AVATAR_POSE_OFFSET_CONTROLS.map(c=>[c.key,clamp(number(parameters['poseA_'+c.key]),c.min,c.max)]));
  let cached=GAIT_COMPOSITIONS.get(restMesh);if(!cached){cached=new Map();GAIT_COMPOSITIONS.set(restMesh,cached);}
  const key=JSON.stringify([options.gaitFrom,options.gaitTo,options.gaitStride,options.gaitArmSwing,options.gaitGround,offsets,phase,blend]);if(cached.has(key))return cached.get(key);
  const pose=avatarLocomotionPose(phase,{...options,gaitBlend:blend},offsets),lift=pose.locomotion.rootLift;
  const posed=liftPosedMesh(poseAvatarMesh(restMesh,pose,{ground:options.gaitGround}),lift),frame=locomotionEnvelope(restMesh,options,offsets);
  const result={...posed,poseFrameBounds:frame,poseCutFrameRanges:frame.cutRanges,cutReferenceLandmarks:restMesh.landmarks,
    metadata:{...posed.metadata,poseMode:'Stand / walk / run',gaitFrom:options.gaitFrom,gaitTo:options.gaitTo,gaitPhase:phase,gaitBlend:blend,gaitLevel:pose.locomotion.level,gaitStride:options.gaitStride,gaitArmSwing:options.gaitArmSwing,gaitGround:options.gaitGround,rootLift:lift}};
  Object.defineProperty(result,'restMesh',{value:restMesh,enumerable:false});
  cached.set(key,result);while(cached.size>8)cached.delete(cached.keys().next().value);return result;
}
