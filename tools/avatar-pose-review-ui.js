import {AVATAR_DEFAULTS,AVATAR_CONTROLS,buildAvatarMesh} from '../src/avatar-geometry.js';
import {drawAvatarCanvas} from '../src/avatar-render.js';
import {AVATAR_PLOT_DEFAULTS,plotAvatar} from '../src/avatar-plot.js';
import {avatarPlotSvg} from '../src/avatar-plot-export.js';
import {AVATAR_POSE_NAMES,AVATAR_POSE_OFFSET_CONTROLS,AVATAR_POSE_PLAYBACK_DEFAULTS,composeAvatarPose} from '../src/avatar-pose-control.js';

const root=document.getElementById('avatar-pose-review');
const $=id=>root.querySelector('#pose-'+id);
const walkDefault=root.dataset.initialMotion==='walk';
const runDefault=root.dataset.initialMotion==='run';
const stateKey=runDefault?'avatarRunReview':walkDefault?'avatarWalkReview':'avatarPoseReview';
const walking=snapshot=>snapshot.pose.poseMode==='Walk cycle';
const locomoting=snapshot=>snapshot.pose.poseMode==='Stand / walk / run';
const cycling=snapshot=>walking(snapshot)||locomoting(snapshot);
const gaits=['Standing','Walking','Running'];
const styles=['Brush','Contours','Hatching','Contours + hatching'];
const bodyGroups=[...new Set(AVATAR_CONTROLS.map(c=>c.group))];
const poseGroups=[...new Set(AVATAR_POSE_OFFSET_CONTROLS.map(c=>c.group))];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,d)=>Number.isFinite(+v)?+v:d;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const context={W:210,H:297,size:260,margin:12,pen:0};
const meshCache=new Map();
const walkFrames=new Map();
const savedSnapshots=new Set();
let walkFramesKey='';
const probe=document.createElement('span');
probe.hidden=true;probe.setAttribute('aria-hidden','true');probe.style.color='var(--background)';root.append(probe);
function cleanBody(values,preset){
  const body={...AVATAR_DEFAULTS,preset,seed:preset==='Male'?17:43};
  for(const c of AVATAR_CONTROLS)body[c.key]=clamp(number(values?.[c.key],body[c.key]),c.min,c.max);
  body.seed=clamp(Math.round(number(values?.seed,body.seed)),0,999999);
  return body;
}
function clean(s={}){
  const pose={...AVATAR_POSE_PLAYBACK_DEFAULTS,posePreset:'Relaxed',poseTarget:'Reach',poseGround:true,poseMode:runDefault?'Stand / walk / run':walkDefault?'Walk cycle':'Pose transition',walkPhase:0,walkSpeed:1,walkStride:1,walkArmSwing:1,walkGround:true,gaitFrom:'Standing',gaitTo:'Running',gaitBlend:1,gaitCycle:'Ping-pong',gaitPhase:0,gaitSpeed:1,gaitStride:1,gaitArmSwing:1,gaitGround:true,...s.pose,poseMotion:'Manual',walkMotion:'Manual',gaitMotion:'Manual',gaitTransition:'Manual'};
  pose.poseMode=['Walk cycle','Stand / walk / run'].includes(pose.poseMode)?pose.poseMode:'Pose transition';
  pose.walkPhase=clamp(number(pose.walkPhase,0),0,1);
  pose.walkSpeed=clamp(Math.round(number(pose.walkSpeed,1)),1,6);
  pose.walkStride=clamp(number(pose.walkStride,1),0,1.5);
  pose.walkArmSwing=clamp(number(pose.walkArmSwing,1),0,1.5);
  pose.walkGround=pose.walkGround!==false;
  pose.gaitFrom=gaits.includes(pose.gaitFrom)?pose.gaitFrom:'Standing';
  pose.gaitTo=gaits.includes(pose.gaitTo)?pose.gaitTo:'Running';
  pose.gaitBlend=clamp(number(pose.gaitBlend,1),0,1);
  pose.gaitPhase=clamp(number(pose.gaitPhase,0),0,1);
  pose.gaitSpeed=clamp(Math.round(number(pose.gaitSpeed,1)),1,6);
  pose.gaitStride=clamp(number(pose.gaitStride,1),0,1.5);
  pose.gaitArmSwing=clamp(number(pose.gaitArmSwing,1),0,1.5);
  pose.gaitGround=pose.gaitGround!==false;
  pose.gaitCycle=pose.gaitCycle==='One-way'?'One-way':'Ping-pong';
  pose.posePreset=AVATAR_POSE_NAMES.includes(pose.posePreset)?pose.posePreset:'Relaxed';
  pose.poseTarget=AVATAR_POSE_NAMES.includes(pose.poseTarget)?pose.poseTarget:'Reach';
  pose.poseBlend=clamp(number(pose.poseBlend,0),0,1);
  pose.poseCycle=pose.poseCycle==='One-way'?'One-way':'Ping-pong';
  pose.poseEasing=pose.poseEasing==='Linear'?'Linear':'Smooth';
  pose.poseGround=pose.poseGround!==false;
  for(const side of ['A','B'])for(const c of AVATAR_POSE_OFFSET_CONTROLS)pose['pose'+side+'_'+c.key]=clamp(number(pose['pose'+side+'_'+c.key],0),c.min,c.max);
  return {body:s.body==='Male'?'Male':'Female',bodies:{Male:cleanBody(s.bodies?.Male,'Male'),Female:cleanBody(s.bodies?.Female,'Female')},bodyArea:bodyGroups.includes(s.bodyArea)?s.bodyArea:'Body',edit:s.edit==='End B'?'End B':'Start A',area:poseGroups.includes(s.area)?s.area:'Torso',gaitPlayback:s.gaitPlayback==='Transition'?'Transition':'Cycle',pose,view:['Front','Side','Back','Manual'].includes(s.view)?s.view:'Three-quarter',yaw:clamp(number(s.yaw,30),0,360),region:['Bust','Feet','Band'].includes(s.region)?s.region:'Full body',followAnatomy:s.followAnatomy!==false,cuts:{Bust:clamp(number(s.cuts?.Bust,74),1,98),Feet:clamp(number(s.cuts?.Feet,9),1,98),Band:clamp(number(s.cuts?.Band,50),1,98)},style:styles.includes(s.style)?s.style:'Brush',brushWidth:clamp(number(s.brushWidth,2.5),1,6),brushEconomy:clamp(number(s.brushEconomy,.82),.5,1),pitch:clamp(number(s.pitch,.9),.7,2),lightAngle:clamp(number(s.lightAngle,225),0,360),crosshatch:s.crosshatch!==false,styleSeed:clamp(Math.round(number(s.styleSeed,137)),0,999999)};
}
let state=clean(window.openai?.widgetState?.privateContent?.[stateKey]);
let canvasRequest=0,plotTimer=0,persistTimer=0,generation=0,playing=false,animation=0,animationTimer=0,startedAt=0,cycleStartedAt=0,startedPhase=0,lastDrawing=null,savedSnapshot='';
function persist(){
  clearTimeout(persistTimer);
  savedSnapshot=JSON.stringify(state);
  savedSnapshots.add(savedSnapshot);while(savedSnapshots.size>8)savedSnapshots.delete(savedSnapshots.values().next().value);
  window.openai?.setWidgetState?.({modelContent:{avatarPose:{body:state.body,anatomy:state.bodies[state.body],movement:state.pose.poseMode,start:state.pose.posePreset,end:state.pose.poseTarget,blend:state.pose.poseBlend,pose:state.pose,style:state.style,region:state.region,turnDegrees:state.yaw,followPoseAnatomy:state.followAnatomy,cuts:state.cuts,drawingSeed:state.styleSeed,brushWidthMm:state.brushWidth,finePitchMm:state.pitch}},privateContent:{[stateKey]:JSON.parse(savedSnapshot)}})?.catch(()=>{});
}
function remember(){clearTimeout(persistTimer);persistTimer=setTimeout(persist,220);}
function syncPhase(){
  const phase=locomoting(state)?state.pose.gaitPhase:walking(state)?state.pose.walkPhase:state.pose.poseBlend;
  $('blend').value=phase;$('blend-value').textContent=Math.round(phase*100)+'%';
  if(locomoting(state)){$('gait-blend').value=state.pose.gaitBlend;$('gait-blend-value').textContent=Math.round(state.pose.gaitBlend*100)+'%';}
  $('frame-label').textContent=movementLabel(state);
}
function syncFields(){
  const walk=walking(state),run=locomoting(state),cycle=cycling(state),prefix=run?'gait':'walk';
  $('mode').value=state.pose.poseMode;root.dataset.mode=run?'run':walk?'walk':'pose';
  $('transition-presets').hidden=cycle;$('cycle-field').hidden=cycle;$('easing-field').hidden=cycle;$('edit-field').hidden=cycle;$('walk-fields').hidden=!cycle;$('gait-fields').hidden=!run;
  $('blend-label').textContent=run?'Cycle phase':walk?'Walk cycle phase':'Pose blend · A → B';
  $('blend').setAttribute('aria-label',run?'Cycle phase':walk?'Walk cycle phase':'Pose blend from start A to end B');
  $('walk-speed').setAttribute('aria-label',run?'Movement speed':'Walk speed');
  $('walk-speed').value=state.pose[prefix+'Speed'];$('walk-speed-value').textContent=state.pose[prefix+'Speed']+'×';
  $('walk-stride').value=state.pose[prefix+'Stride']*100;$('walk-stride-value').textContent=Math.round(state.pose[prefix+'Stride']*100)+'%';
  $('walk-arms').value=state.pose[prefix+'ArmSwing']*100;$('walk-arms-value').textContent=Math.round(state.pose[prefix+'ArmSwing']*100)+'%';
  $('gait-from').value=state.pose.gaitFrom;$('gait-to').value=state.pose.gaitTo;$('gait-playback').value=state.gaitPlayback;
  $('body').value=state.body;$('start').value=state.pose.posePreset;$('end').value=state.pose.poseTarget;
  syncPhase();
  $('cycle').value=state.pose.poseCycle;$('easing').value=state.pose.poseEasing;$('ground').checked=run?state.pose.gaitGround:walk?state.pose.walkGround:state.pose.poseGround;
  $('ground-label').textContent=run?'Ground movement':'Keep lowest foot on ground';
  $('edit').value=state.edit;$('area').value=state.area;$('body-area').value=state.bodyArea;
  $('view').value=state.view;$('yaw').value=state.yaw;$('yaw-value').textContent=Math.round(state.yaw)+'°';
  $('region').value=state.region;$('cut-field').hidden=state.region==='Full body';$('follow-field').hidden=!['Bust','Feet'].includes(state.region);
  $('cut').value=state.cuts[state.region]??50;$('cut-value').textContent=(state.cuts[state.region]??50)+'%';$('follow').checked=state.followAnatomy;
  $('style').value=state.style;const brush=state.style==='Brush',hatch=state.style.includes('hatching')||state.style==='Hatching';
  $('brush-field').hidden=!brush;$('economy-field').hidden=!brush;$('pitch-field').hidden=brush;$('light-field').hidden=!hatch;$('cross-field').hidden=!hatch;
  $('brush').value=state.brushWidth;$('brush-value').textContent=state.brushWidth.toFixed(1)+' mm';
  $('economy').value=state.brushEconomy*100;$('economy-value').textContent=Math.round(state.brushEconomy*100)+'%';
  $('pitch').value=state.pitch;$('pitch-value').textContent=state.pitch.toFixed(1)+' mm';
  $('light').value=state.lightAngle;$('light-value').textContent=state.lightAngle+'°';$('cross').checked=state.crosshatch;
  $('body-seed').value=state.bodies[state.body].seed;$('style-seed').value=state.styleSeed;
  $('style-label').textContent=state.style+' · '+(brush?state.brushWidth.toFixed(1):'0.35')+' mm';
  syncPlayButton();
}
function syncPlayButton(){const run=locomoting(state),transition=run&&state.gaitPlayback==='Transition';$('play').textContent=playing?'Pause and draw':reducedMotion.matches?(transition?'Show end movement':cycling(state)?'Next step':'Show end pose'):(run?transition?'Play transition':'Play cycle':walking(state)?'Play walk':'Play once');}
function movementLabel(snapshot){return locomoting(snapshot)?(snapshot.pose.gaitFrom===snapshot.pose.gaitTo?snapshot.pose.gaitFrom:snapshot.pose.gaitFrom+' → '+snapshot.pose.gaitTo+' · '+Math.round(snapshot.pose.gaitBlend*100)+'%')+' · phase '+Math.round(snapshot.pose.gaitPhase*100)+'%':walking(snapshot)?'Walk · '+Math.round(snapshot.pose.walkPhase*100)+'%':snapshot.pose.posePreset+' → '+snapshot.pose.poseTarget+' · '+Math.round(snapshot.pose.poseBlend*100)+'%';}
function sliderFor(c,value,onInput,onChange,suffix){
  const label=document.createElement('label');label.className='form-label';
  const head=document.createElement('span');head.className='pose-label';
  const name=document.createElement('span');name.textContent=c.label;
  const output=document.createElement('output');output.className='tabular-nums';output.textContent=value+suffix;head.append(name,output);
  const input=document.createElement('input');input.className='form-range';input.type='range';input.min=c.min;input.max=c.max;input.step=c.step||1;input.value=value;input.setAttribute('aria-label',c.label);
  input.addEventListener('input',()=>{output.textContent=input.value+suffix;onInput(+input.value);});
  input.addEventListener('change',onChange);label.append(head,input);return label;
}
function jointControls(){
  $('joints').replaceChildren();const side=!cycling(state)&&state.edit==='End B'?'B':'A';
  for(const c of AVATAR_POSE_OFFSET_CONTROLS.filter(c=>c.group===state.area)){
    const key='pose'+side+'_'+c.key;
    $('joints').append(sliderFor(c,state.pose[key],value=>{stopPlayback(false);state.pose[key]=value;changed(420);},()=>{persist();schedulePlot(0);},'°'));
  }
}
function bodyControls(){
  $('anatomy').replaceChildren();
  for(const c of AVATAR_CONTROLS.filter(c=>c.group===state.bodyArea))$('anatomy').append(sliderFor(c,state.bodies[state.body][c.key],value=>{stopPlayback(false);state.bodies[state.body][c.key]=value;changed(420);},()=>{persist();schedulePlot(0);},'%'));
}
function meshFor(snapshot,quality){
  const body=snapshot.bodies[snapshot.body],key=quality+JSON.stringify(body);
  if(!meshCache.has(key)){meshCache.set(key,buildAvatarMesh(body,{quality}));while(meshCache.size>4)meshCache.delete(meshCache.keys().next().value);}
  return composeAvatarPose(meshCache.get(key),snapshot.pose);
}
function viewFor(snapshot){
  const named=['Bust','Feet'].includes(snapshot.region);
  return {yaw:snapshot.yaw,pitch:0,roll:0,mode:snapshot.region,cut:snapshot.region==='Full body'||(named&&snapshot.followAnatomy)?undefined:snapshot.cuts[snapshot.region]/100,band:.15,frame:snapshot.region==='Full body'?'body':'selection',rotationEnvelope:'yaw'};
}
function canvasNow(){
  const color=getComputedStyle(root).color,background=getComputedStyle(probe).color;
  const canvas=$('canvas'),view=viewFor(state);
  let frames=null;
  if(playing&&cycling(state)&&(!locomoting(state)||state.gaitPlayback==='Cycle')){
    const gait=locomoting(state)?[state.pose.gaitFrom,state.pose.gaitTo,state.pose.gaitBlend,state.pose.gaitStride,state.pose.gaitArmSwing,state.pose.gaitGround]:[state.pose.walkStride,state.pose.walkArmSwing,state.pose.walkGround];
    const key=JSON.stringify([state.pose.poseMode,state.bodies[state.body],gait,Object.entries(state.pose).filter(([name])=>name.startsWith('poseA_')),view,color,background,canvas.width,canvas.height]);
    if(key!==walkFramesKey){walkFramesKey=key;walkFrames.clear();}
    frames=walkFrames;
  }
  const phase=locomoting(state)?state.pose.gaitPhase:state.pose.walkPhase;
  const cached=frames?.get(phase);
  if(cached){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(cached,0,0);}
  else{
    drawAvatarCanvas(canvas,meshFor(state,'draft'),{...view,color,inkColor:color,bodyColor:color,background,wireframe:false,pixelRatio:1});
    if(frames){const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);frames.set(phase,copy);while(frames.size>32)frames.delete(frames.keys().next().value);}
  }
  $('canvas').setAttribute('aria-label',state.body+' posed body, '+movementLabel(state)+', '+state.region.toLowerCase());
  root.dataset.blend=state.pose.poseBlend.toFixed(3);
  root.dataset.walkPhase=state.pose.walkPhase.toFixed(3);
  root.dataset.gaitPhase=state.pose.gaitPhase.toFixed(3);
  root.dataset.gaitBlend=state.pose.gaitBlend.toFixed(3);
}
function reportError(error){root.dataset.error=error.message;root.dataset.ready='false';$('status').textContent='Could not draw these settings: '+error.message;console.error(error);}
function requestCanvas(){
  if(canvasRequest)return;
  canvasRequest=requestAnimationFrame(()=>{canvasRequest=0;try{canvasNow();}catch(error){reportError(error);}});
}
function markPlotPending(message='Drawing current pose…'){
  $('art').hidden=true;$('plot-wait').hidden=false;$('plot-wait').textContent=message;$('download').disabled=true;
  root.dataset.ready='false';
}
function schedulePlot(delay=350){
  clearTimeout(plotTimer);generation++;markPlotPending(playing?'Pause to draw this frame':'Drawing current pose…');
  if(playing)return;
  const token=generation;plotTimer=setTimeout(()=>renderPlot(token),delay);
}
function changed(delay=350){syncFields();requestCanvas();schedulePlot(delay);remember();}
const round=value=>Math.round(value*1000)/1000;
async function renderPlot(token){
  if(playing||token!==generation)return;
  const snapshot=clean(state);
  try{
    $('status').textContent='Drawing '+snapshot.style.toLowerCase()+'…';
    await new Promise(resolve=>requestAnimationFrame(resolve));
    if(playing||token!==generation)return;
    const options={...AVATAR_PLOT_DEFAULTS,style:snapshot.style,brushWidth:snapshot.brushWidth,brushEconomy:snapshot.brushEconomy,penWidth:.35,pitch:snapshot.pitch,lightAngle:((snapshot.lightAngle+180)%360)-180,crosshatch:snapshot.crosshatch?AVATAR_PLOT_DEFAULTS.crosshatch:0,styleSeed:snapshot.styleSeed,outlinePen:0,detailPen:0,shadePen:0};
    const drawing=plotAvatar(meshFor(snapshot,'review'),viewFor(snapshot),options,context);
    if(playing||token!==generation)return;
    const title=snapshot.body+' · '+movementLabel(snapshot)+' · '+snapshot.style;
    const paths=drawing.paths.map(path=>'<path d="M'+path.pts.map(point=>round(point[0])+','+round(point[1])).join('L')+(path.closed?'Z':'')+'"/>').join('');
    $('art').innerHTML='<svg class="pose-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+context.W+' '+context.H+'" role="img" aria-label="'+title+'"><title>'+title+'</title><g fill="none" stroke="currentColor" stroke-width="'+(snapshot.style==='Brush'?snapshot.brushWidth:.35)+'" stroke-linecap="round" stroke-linejoin="round">'+paths+'</g></svg>';
    $('art').hidden=false;$('plot-wait').hidden=true;$('download').disabled=false;
    const stats=drawing.stats;$('stats').textContent=stats.pathCount+' strokes · '+(stats.lengthMm/1000).toFixed(2)+' m'+(snapshot.style==='Brush'?'':' · '+stats.effectivePitch.toFixed(2)+' mm pitch');
    $('status').textContent=snapshot.body+' · '+snapshot.region.toLowerCase()+' · anatomy seed '+snapshot.bodies[snapshot.body].seed+' · drawing seed '+snapshot.styleSeed;
    lastDrawing={drawing,options,snapshot};root.dataset.ready='true';delete root.dataset.error;
  }catch(error){if(token===generation)reportError(error);}
}
function stopPlayback(draw=true){
  if(!playing)return;
  playing=false;cancelAnimationFrame(animation);clearTimeout(animationTimer);root.dataset.playing='false';syncPlayButton();
  if(draw){syncFields();requestCanvas();schedulePlot(0);persist();}
}
function playFrame(now){
  if(!playing)return;
  const started=performance.now();
  if(locomoting(state)){
    state.pose.gaitPhase=(Math.round((startedPhase+(now-cycleStartedAt)*state.pose.gaitSpeed/2000)*32)%32)/32;
    const transition=state.gaitPlayback==='Transition',progress=Math.min(1,(now-startedAt)/8000);
    if(transition)state.pose.gaitBlend=progress;
    syncPhase();try{canvasNow();}catch(error){stopPlayback(false);reportError(error);return;}
    if(transition&&progress===1){stopPlayback();return;}
    queuePlayFrame(Math.max(32,1000/12-(performance.now()-started)));return;
  }
  if(walking(state)){
    state.pose.walkPhase=(Math.round((startedPhase+(now-startedAt)*state.pose.walkSpeed/2000)*32)%32)/32;
    syncPhase();try{canvasNow();}catch(error){stopPlayback(false);reportError(error);return;}
    queuePlayFrame(Math.max(32,1000/12-(performance.now()-started)));return;
  }
  const phase=Math.min(1,(now-startedAt)/10000);
  state.pose.poseBlend=state.pose.poseCycle==='One-way'?phase:1-Math.abs(1-2*phase);
  syncPhase();try{canvasNow();}catch(error){stopPlayback(false);reportError(error);return;}
  if(phase===1){stopPlayback();return;}
  queuePlayFrame(Math.max(32,100-(performance.now()-started)));
}
function queuePlayFrame(delay){animationTimer=setTimeout(()=>{if(playing)animation=requestAnimationFrame(playFrame);},delay);}
for(const id of ['start','end'])for(const name of AVATAR_POSE_NAMES){const option=document.createElement('option');option.textContent=name;$(id).append(option);}
$('play').addEventListener('click',()=>{
  if(playing){stopPlayback();return;}
  if(reducedMotion.matches){if(locomoting(state)){if(state.gaitPlayback==='Transition')state.pose.gaitBlend=state.pose.gaitBlend===1?0:1;else state.pose.gaitPhase=(state.pose.gaitPhase+.125)%1;}else if(walking(state))state.pose.walkPhase=(state.pose.walkPhase+.125)%1;else state.pose.poseBlend=state.pose.poseBlend===1?0:1;changed(0);persist();return;}
  clearTimeout(plotTimer);clearTimeout(persistTimer);generation++;playing=true;root.dataset.playing='true';startedAt=performance.now();cycleStartedAt=startedAt;startedPhase=locomoting(state)?state.pose.gaitPhase:state.pose.walkPhase;
  if(locomoting(state)){if(state.gaitPlayback==='Transition')state.pose.gaitBlend=0;}else if(!walking(state))state.pose.poseBlend=0;
  syncFields();markPlotPending('Pause to draw this frame');$('status').textContent=locomoting(state)?state.gaitPlayback==='Transition'?'Playing one 8-second movement transition':'Moving · '+state.pose.gaitSpeed+'×':walking(state)?'Walking · '+state.pose.walkSpeed+'×':'Playing one 10-second transition';animation=requestAnimationFrame(playFrame);
});
$('mode').addEventListener('change',()=>{stopPlayback(false);state.pose.poseMode=$('mode').value;jointControls();changed(0);persist();});
$('body').addEventListener('change',()=>{stopPlayback(false);state.body=$('body').value;bodyControls();changed(0);persist();});
for(const [id,key] of [['start','posePreset'],['end','poseTarget'],['cycle','poseCycle'],['easing','poseEasing']])$(id).addEventListener('change',()=>{stopPlayback(false);state.pose[key]=$(id).value;changed(0);persist();});
$('ground').addEventListener('change',()=>{stopPlayback(false);state.pose[locomoting(state)?'gaitGround':walking(state)?'walkGround':'poseGround']=$('ground').checked;changed(0);persist();});
$('blend').addEventListener('input',()=>{stopPlayback(false);state.pose[locomoting(state)?'gaitPhase':walking(state)?'walkPhase':'poseBlend']=+$('blend').value;changed(400);});
$('blend').addEventListener('change',()=>{persist();schedulePlot(0);});
$('edit').addEventListener('change',()=>{stopPlayback(false);state.edit=$('edit').value;state.pose.poseBlend=state.edit==='End B'?1:0;jointControls();changed(0);persist();});
for(const [id,key,convert] of [['walk-speed','walkSpeed',v=>v],['walk-stride','walkStride',v=>v/100],['walk-arms','walkArmSwing',v=>v/100]]){
  $(id).addEventListener('input',()=>{
    const run=locomoting(state),target=run?key.replace('walk','gait'):key;
    if(id==='walk-speed'&&playing){startedPhase=run?state.pose.gaitPhase:state.pose.walkPhase;if(run)cycleStartedAt=performance.now();else startedAt=performance.now();state.pose[target]=convert(+$(id).value);syncFields();$('status').textContent=(run?'Moving':'Walking')+' · '+state.pose[target]+'×';remember();}
    else{stopPlayback(false);state.pose[target]=convert(+$(id).value);changed(400);}
  });
  $(id).addEventListener('change',()=>{persist();schedulePlot(0);});
}
for(const [id,key] of [['gait-from','gaitFrom'],['gait-to','gaitTo']])$(id).addEventListener('change',()=>{stopPlayback(false);state.pose[key]=$(id).value;changed(0);persist();});
$('gait-playback').addEventListener('change',()=>{stopPlayback(false);state.gaitPlayback=$('gait-playback').value;syncPlayButton();persist();schedulePlot(0);});
$('gait-blend').addEventListener('input',()=>{
  const value=+$('gait-blend').value;
  if(playing&&locomoting(state)&&state.gaitPlayback==='Cycle'){state.pose.gaitBlend=value;syncPhase();remember();}
  else{stopPlayback(false);state.pose.gaitBlend=value;changed(350);}
});
$('gait-blend').addEventListener('change',()=>{persist();schedulePlot(0);});
$('area').addEventListener('change',()=>{state.area=$('area').value;jointControls();persist();});
$('body-area').addEventListener('change',()=>{state.bodyArea=$('body-area').value;bodyControls();persist();});
$('view').addEventListener('change',()=>{state.view=$('view').value;if(state.view!=='Manual')state.yaw=({Front:0,Side:90,Back:180,'Three-quarter':30})[state.view];changed(0);persist();});
$('region').addEventListener('change',()=>{state.region=$('region').value;changed(0);persist();});
$('style').addEventListener('change',()=>{state.style=$('style').value;changed(0);persist();});
for(const [id,key,convert] of [['yaw','yaw',v=>v],['brush','brushWidth',v=>v],['economy','brushEconomy',v=>v/100],['pitch','pitch',v=>v],['light','lightAngle',v=>v]]){
  $(id).addEventListener('input',()=>{state[key]=convert(+$(id).value);if(id==='yaw')state.view='Manual';changed(350);});
  $(id).addEventListener('change',()=>{persist();schedulePlot(0);});
}
$('cut').addEventListener('input',()=>{state.cuts[state.region]=+$('cut').value;state.followAnatomy=false;changed(350);});
$('cut').addEventListener('change',()=>{persist();schedulePlot(0);});
$('follow').addEventListener('change',()=>{state.followAnatomy=$('follow').checked;changed(0);persist();});
$('cross').addEventListener('change',()=>{state.crosshatch=$('cross').checked;changed(0);persist();});
for(const [id,set] of [['body-seed',value=>{stopPlayback(false);state.bodies[state.body].seed=value;}],['style-seed',value=>{state.styleSeed=value;}]]){
  $(id).addEventListener('input',()=>{set(clamp(Math.round(number($(id).value,0)),0,999999));requestCanvas();schedulePlot(350);remember();});
  $(id).addEventListener('change',()=>{syncFields();persist();schedulePlot(0);});
}
$('download').addEventListener('click',()=>{
  if(!lastDrawing||$('download').disabled)return;
  const {drawing,options,snapshot}=lastDrawing;
  const svg=avatarPlotSvg(drawing,context,{...options,title:snapshot.body+' · '+movementLabel(snapshot)+' · '+snapshot.style,preset:snapshot.body,mode:snapshot.region,seed:snapshot.bodies[snapshot.body].seed,styleSeed:snapshot.styleSeed,metadata:{movement:snapshot.pose.poseMode,poseStart:snapshot.pose.posePreset,poseEnd:snapshot.pose.poseTarget,poseBlend:snapshot.pose.poseBlend,pose:snapshot.pose}});
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),link=document.createElement('a');
  link.href=url;link.download=('avatar-'+snapshot.body+'-'+movementLabel(snapshot)+'-'+snapshot.style).toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener('openai:set_globals',event=>{
  const next=event.detail?.globals?.widgetState?.privateContent?.[stateKey];
  if(next&&savedSnapshots.has(JSON.stringify(next)))return;
  if(next){stopPlayback(false);state=clean(next);syncFields();jointControls();bodyControls();requestCanvas();schedulePlot(0);}
  else requestCanvas();
});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)stopPlayback();syncFields();});
new MutationObserver(()=>requestCanvas()).observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
syncFields();jointControls();bodyControls();requestCanvas();schedulePlot(0);
