/* Standing, walking and running share one repeatable articulated phase. */
import {AVATAR_POSE_CONTROLS,normalizeAvatarPose,resolveAvatarPose} from './avatar-pose.js';
import {avatarWalkPose} from './avatar-walk.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,d=0)=>Number.isFinite(+v)?+v:d;
const turn=value=>((number(value)%1)+1)%1;
const smooth=value=>value*value*(3-2*value);
const bump=(phase,start,end)=>phase>start&&phase<end?Math.sin(Math.PI*(phase-start)/(end-start))**2:0;
export const AVATAR_GAIT_NAMES=Object.freeze(['Standing','Walking','Running']);
export const AVATAR_LOCOMOTION_DEFAULTS=Object.freeze({gaitFrom:'Standing',gaitTo:'Running',gaitBlend:1,gaitTransition:'Manual',gaitCycle:'Ping-pong',gaitMotion:'Timeline',gaitPhase:0,gaitSpeed:1,gaitStride:1,gaitArmSwing:1,gaitGround:true});
export function normalizeAvatarLocomotionOptions(parameters={}){
  return {
    gaitFrom:AVATAR_GAIT_NAMES.includes(parameters.gaitFrom)?parameters.gaitFrom:'Standing',
    gaitTo:AVATAR_GAIT_NAMES.includes(parameters.gaitTo)?parameters.gaitTo:'Running',
    gaitBlend:clamp(number(parameters.gaitBlend,1),0,1),
    gaitTransition:parameters.gaitTransition==='Timeline'?'Timeline':'Manual',
    gaitCycle:parameters.gaitCycle==='One-way'?'One-way':'Ping-pong',
    gaitMotion:parameters.gaitMotion==='Manual'?'Manual':'Timeline',
    gaitPhase:turn(parameters.gaitPhase),gaitSpeed:clamp(Math.round(number(parameters.gaitSpeed,1)),1,6),
    gaitStride:clamp(number(parameters.gaitStride,1),0,1.5),gaitArmSwing:clamp(number(parameters.gaitArmSwing,1),0,1.5),gaitGround:parameters.gaitGround!==false,
  };
}
export function avatarLocomotionPhase(parameters={},context={}){
  const options=normalizeAvatarLocomotionOptions(parameters);
  if(options.gaitMotion==='Manual')return options.gaitPhase;
  const count=Math.max(1,Math.floor(number(context.frameCount,1))),index=clamp(Math.floor(number(context.frameIdx)),0,count-1);
  return turn(options.gaitPhase+index/count*options.gaitSpeed);
}
export function avatarLocomotionBlend(parameters={},context={}){
  const options=normalizeAvatarLocomotionOptions(parameters);
  if(options.gaitTransition!=='Timeline')return options.gaitBlend;
  const count=Math.max(1,Math.floor(number(context.frameCount,1))),index=clamp(Math.floor(number(context.frameIdx)),0,count-1);
  const t=count>1?index/(count-1):0;
  return smooth(options.gaitCycle==='One-way'?t:1-Math.abs(1-2*t));
}
export function avatarLocomotionLevel(parameters={}){
  const options=normalizeAvatarLocomotionOptions(parameters),from=AVATAR_GAIT_NAMES.indexOf(options.gaitFrom),to=AVATAR_GAIT_NAMES.indexOf(options.gaitTo);
  return from+(to-from)*options.gaitBlend;
}
function runningPose(phase,options){
  const stride=options.gaitStride,swing=options.gaitArmSwing,t=turn(phase),a=t*Math.PI*2,c=Math.cos(a),twice=Math.cos(2*a);
  const angles={pelvisTilt:stride*(4+1.8*twice),pelvisSide:-3*stride*c,torsoBend:11*stride,
    torsoSide:1.6*stride*c,torsoTwist:-7*stride*c,headTurn:3*stride*c,headNod:stride*(-4+.7*twice),headTilt:-.5*stride*c};
  for(const [side,offset] of [['left',0],['right',.5]]){
    const p=turn(t+offset),angle=p*Math.PI*2,cos=Math.cos(angle),sin=Math.sin(angle);
    const recovery=Math.max(0,-sin)**2,stance=Math.max(0,sin)**2;
    const hip=stride*(10+38*cos),knee=stride*(14+78*recovery+12*stance);
    const roll=stride*(9*Math.max(0,cos)**4-17*bump(p,.2,.5)+5*recovery);
    angles[side+'LegForward']=hip;angles[side+'LegSide']=-2*stride;angles[side+'LegTwist']=2*stride*sin;
    angles[side+'Knee']=knee;angles[side+'Ankle']=knee-hip+roll;
    angles[side+'ArmRaise']=-39;angles[side+'ArmForward']=-31*swing*cos;angles[side+'ArmTwist']=3*swing*sin;
    angles[side+'Elbow']=70+swing*(7-8*cos);angles[side+'Wrist']=-5+3*swing*cos;
  }
  return normalizeAvatarPose(angles);
}
/** Smooth adjacent blends pass through the authored walking gait exactly. */
export function avatarLocomotionPose(phase=0,parameters={},offsets={}){
  const options=normalizeAvatarLocomotionOptions(parameters),t=turn(phase),level=avatarLocomotionLevel(options);
  const low=Math.min(1,Math.floor(level)),high=low+1,amount=smooth(level-low);
  const poses=[resolveAvatarPose('Relaxed'),avatarWalkPose(t,{walkStride:options.gaitStride,walkArmSwing:options.gaitArmSwing}),runningPose(t,options)];
  const weights=[0,0,0];weights[low]=1-amount;weights[high]=amount;
  const angles={};
  for(const control of AVATAR_POSE_CONTROLS){
    const value=poses[low][control.key]*(1-amount)+poses[high][control.key]*amount;
    angles[control.key]=value+number(offsets[control.key]);
  }
  const rootLift=weights[2]*options.gaitStride*.045*bump(turn(t*2),.16,.96);
  return {...normalizeAvatarPose(angles),locomotion:{phase:t,blend:options.gaitBlend,level,weights:{Standing:weights[0],Walking:weights[1],Running:weights[2]},rootLift}};
}
