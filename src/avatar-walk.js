/* Deterministic in-place gait in the same joint coordinates as manual poses. */
import {AVATAR_POSE_CONTROLS,normalizeAvatarPose} from './avatar-pose.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,d)=>Number.isFinite(+v)?+v:d;
const turn=value=>{const t=number(value,0);return ((t%1)+1)%1;};
const positiveSquare=value=>Math.max(0,value)**2;
const bump=(phase,start,end)=>phase>start&&phase<end?Math.sin(Math.PI*(phase-start)/(end-start))**2:0;
export const AVATAR_WALK_DEFAULTS=Object.freeze({walkMotion:'Manual',walkPhase:0,walkSpeed:1,walkStride:1,walkArmSwing:1,walkGround:true});

export function normalizeAvatarWalkOptions(parameters={}){
  return {walkMotion:parameters.walkMotion==='Timeline'?'Timeline':'Manual',walkPhase:turn(parameters.walkPhase),
    walkSpeed:clamp(Math.round(number(parameters.walkSpeed,1)),1,6),walkStride:clamp(number(parameters.walkStride,1),0,1.5),
    walkArmSwing:clamp(number(parameters.walkArmSwing,1),0,1.5),walkGround:parameters.walkGround!==false};
}

/** Timeline samples omit the duplicate end frame; whole cycles meet at the wrap. */
export function avatarWalkPhase(parameters={},context={}){
  const options=normalizeAvatarWalkOptions(parameters);
  if(options.walkMotion!=='Timeline')return options.walkPhase;
  const count=Math.max(1,Math.floor(number(context.frameCount,1)));
  const index=clamp(Math.floor(number(context.frameIdx,0)),0,count-1);
  return turn(options.walkPhase+index/count*options.walkSpeed);
}

/** Left heel contact is phase 0; right heel contact is phase .5. */
export function avatarWalkPose(phase=0,parameters={},offsets={}){
  const options=normalizeAvatarWalkOptions(parameters),stride=options.walkStride,swing=options.walkArmSwing;
  const t=turn(phase),angle=t*Math.PI*2,c=Math.cos(angle),twice=Math.cos(angle*2);
  const angles={pelvisTilt:stride*(1.5+.8*twice),pelvisSide:-2.2*stride*c,
    torsoBend:2.5*stride,torsoSide:1.2*stride*c,torsoTwist:-3.5*stride*c,
    headTurn:1.7*stride*c,headNod:.6*stride*twice,headTilt:-.4*stride*c};
  for(const [side,offset] of [['left',0],['right',.5]]){
    const p=turn(t+offset),a=p*Math.PI*2,cos=Math.cos(a),sin=Math.sin(a);
    const airborne=positiveSquare(-sin),stance=positiveSquare(sin);
    const hip=stride*(4+22*cos),knee=stride*(4+42*airborne+6*stance);
    // Ankle compensation keeps the foot near level, with heel strike,
    // late-stance push-off and additional toe clearance during swing.
    const footRoll=stride*(7*Math.max(0,cos)**4-12*bump(p,.25,.5)+4*airborne);
    angles[side+'LegForward']=hip;angles[side+'LegSide']=-2*stride;
    angles[side+'LegTwist']=1.5*stride*sin;
    angles[side+'Knee']=knee;angles[side+'Ankle']=knee-hip+footRoll;
    angles[side+'ArmRaise']=-40;angles[side+'ArmForward']=-18*swing*cos;
    angles[side+'ArmTwist']=1.5*swing*sin;angles[side+'Elbow']=8+swing*(5-4*cos);
    angles[side+'Wrist']=-3+1.5*swing*cos;
  }
  for(const control of AVATAR_POSE_CONTROLS)angles[control.key]=number(angles[control.key],0)+number(offsets[control.key],0);
  return normalizeAvatarPose(angles);
}
