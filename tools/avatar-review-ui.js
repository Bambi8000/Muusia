import {AVATAR_DEFAULTS,AVATAR_CONTROLS,buildAvatarMesh} from '../src/avatar-geometry.js';
import {drawAvatarCanvas} from '../src/avatar-render.js';

const root=document.getElementById('avatar-review');
const $=id=>root.querySelector('#avatar-'+id);
const saved=window.openai?.widgetState?.privateContent?.avatarReview;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const cleanBody=(values,preset)=>{
  const result={...AVATAR_DEFAULTS,preset,seed:preset==='Male'?17:43};
  for(const c of AVATAR_CONTROLS)if(Number.isFinite(+values?.[c.key]))result[c.key]=clamp(+values[c.key],c.min,c.max);
  if(Number.isFinite(+values?.seed))result.seed=clamp(Math.round(+values.seed),0,999999);
  return result;
};
const groups=[...new Set(AVATAR_CONTROLS.map(c=>c.group))];
let state={bodies:{Male:cleanBody(saved?.bodies?.Male,'Male'),Female:cleanBody(saved?.bodies?.Female,'Female')},edit:saved?.edit==='Female'?'Female':'Male',area:groups.includes(saved?.area)?saved.area:'Body',turn:clamp(+saved?.turn||0,0,360),bustCut:clamp(+saved?.bustCut||74,60,87),feetCut:clamp(+saved?.feetCut||9,3,24),lockScale:!!saved?.lockScale};
const meshes={};
let busy=false,queued=null,playing=false,playStart=0,lastAnimation=0,animationFrame=0;
const cache=new Map();
function persist(){
  window.openai?.setWidgetState?.({modelContent:{avatarReview:{editing:state.edit,bodyArea:state.area,bodies:state.bodies,bustAngle:Math.round(state.turn),bustCutPercent:state.bustCut,feetCutPercent:state.feetCut,lockedScale:state.lockScale}},privateContent:{avatarReview:state}})?.catch(()=>{});
}
function showControls(){
  $('edit').value=state.edit;$('area').value=state.area;$('seed').value=state.bodies[state.edit].seed;
  $('status').textContent='Adjusting '+state.edit.toLowerCase()+' · shared body scale in front, side and back';
  $('controls').replaceChildren();
  for(const c of AVATAR_CONTROLS.filter(c=>c.group===state.area&&c.key!=='seed')){
    const label=document.createElement('label');label.className='form-label';
    const top=document.createElement('span');top.className='control-title';
    const name=document.createElement('span');name.textContent=c.label;
    const out=document.createElement('output');out.className='tabular-nums';out.textContent=state.bodies[state.edit][c.key]+'%';
    top.append(name,out);
    const input=document.createElement('input');input.className='form-range';input.type='range';input.min=c.min;input.max=c.max;input.step=c.step||1;input.value=state.bodies[state.edit][c.key];input.dataset.parameter=c.key;input.setAttribute('aria-label',c.label);
    input.addEventListener('input',()=>{state.bodies[state.edit][c.key]=+input.value;out.textContent=input.value+'%';scheduleBuild('draft');});
    input.addEventListener('change',()=>{persist();scheduleBuild('review');});
    label.append(top,input);$('controls').append(label);
  }
}
const themeProbe=document.createElement('span');themeProbe.hidden=true;themeProbe.setAttribute('aria-hidden','true');themeProbe.style.color='var(--background)';root.append(themeProbe);
function colors(){
  const cs=getComputedStyle(root);
  return {surface:cs.color,background:getComputedStyle(themeProbe).color,section:cs.color};
}
function paint(canvas,mesh,options={}){
  if(!mesh)return;
  const col=colors();
  drawAvatarCanvas(canvas,mesh,{...options,background:col.background,color:col.surface,inkColor:col.surface,bodyColor:col.surface,sectionColor:col.section,wireframe:false,pixelRatio:1});
}
function renderBody(name){
  const mesh=meshes[name];if(!mesh)return;
  for(const [view,yaw] of [['front',0],['side',90],['back',180]])paint($(name.toLowerCase()+'-'+view),mesh,{yaw,pitch:0,mode:'Full body',frame:'body'});
  $(name.toLowerCase()+'-meta').textContent='Seed '+state.bodies[name].seed;
}
function renderDetails(){
  const mesh=meshes[state.edit];if(!mesh)return;
  $('bust-label').textContent=state.edit+' · head & shoulders';$('feet-label').textContent=state.edit+' · feet only';
  $('turn').value=Math.round(state.turn);$('turn-value').textContent=Math.round(state.turn)+'°';
  $('bust-cut').value=state.bustCut;$('bust-cut-value').textContent=state.bustCut+'%';
  $('feet-cut').value=state.feetCut;$('feet-cut-value').textContent=state.feetCut+'%';
  $('lock-scale').checked=state.lockScale;
  const frame=state.lockScale?'body':'selection';
  paint($('bust'),mesh,{yaw:state.turn,pitch:-3,mode:'Bust',cut:state.bustCut/100,frame});
  paint($('feet'),mesh,{yaw:28,pitch:12,mode:'Feet',cut:state.feetCut/100,frame});
}
function scheduleBuild(quality='review'){
  queued={name:state.edit,quality};
  if(busy)return;
  busy=true;$('status').textContent='Updating '+state.edit.toLowerCase()+' proportions…';
  requestAnimationFrame(()=>setTimeout(runQueued,0));
}
function getMesh(name,quality){
  const params=state.bodies[name],key=quality+JSON.stringify(params);
  if(cache.has(key))return cache.get(key);
  const mesh=buildAvatarMesh(params,{quality});cache.set(key,mesh);
  while(cache.size>6)cache.delete(cache.keys().next().value);
  return mesh;
}
function runQueued(){
  const work=queued;queued=null;
  try{meshes[work.name]=getMesh(work.name,work.quality);renderBody(work.name);renderDetails();$('status').textContent=state.edit+' adjustments · seed '+state.bodies[state.edit].seed;}
  catch(error){$('status').textContent='Could not update this body: '+error.message;console.error(error);}
  busy=false;if(queued)scheduleBuild(queued.quality);
}
function stopAnimation(){playing=false;cancelAnimationFrame(animationFrame);$('play').textContent='Rotate bust';}
function animate(now){
  if(!playing)return;
  if(!playStart)playStart=now;
  const progress=Math.min(1,(now-playStart)/10000);
  if(now-lastAnimation>100||progress===1){state.turn=progress*360;renderDetails();lastAnimation=now;}
  if(progress<1)animationFrame=requestAnimationFrame(animate);else{stopAnimation();persist();}
}
$('edit').addEventListener('change',()=>{stopAnimation();state.edit=$('edit').value;showControls();renderDetails();persist();});
$('area').addEventListener('change',()=>{state.area=$('area').value;showControls();persist();});
$('seed').addEventListener('change',()=>{state.bodies[state.edit].seed=clamp(Math.round(+$('seed').value)||0,0,999999);persist();scheduleBuild();});
$('next').addEventListener('click',()=>{const b=state.bodies[state.edit];b.seed=(b.seed+1)%1000000;$('seed').value=b.seed;persist();scheduleBuild();});
for(const [id,key] of [['turn','turn'],['bust-cut','bustCut'],['feet-cut','feetCut']]){
  $(id).addEventListener('input',()=>{stopAnimation();state[key]=+$(id).value;renderDetails();});
  $(id).addEventListener('change',persist);
}
$('lock-scale').addEventListener('change',()=>{state.lockScale=$('lock-scale').checked;renderDetails();persist();});
$('play').addEventListener('click',()=>{
  if(playing){stopAnimation();persist();return;}
  playing=true;playStart=0;lastAnimation=0;$('play').textContent='Pause rotation';animationFrame=requestAnimationFrame(animate);
});
window.addEventListener('openai:set_globals',event=>{
  const next=event.detail?.globals?.widgetState?.privateContent?.avatarReview;
  if(!next?.bodies)return;
  stopAnimation();
  state={...state,...next,bodies:{Male:cleanBody(next.bodies.Male,'Male'),Female:cleanBody(next.bodies.Female,'Female')}};
  state.edit=state.edit==='Female'?'Female':'Male';state.area=groups.includes(state.area)?state.area:'Body';
  showControls();for(const name of ['Male','Female']){meshes[name]=getMesh(name,'review');renderBody(name);}renderDetails();
});
new MutationObserver(()=>{for(const name of ['Male','Female'])renderBody(name);renderDetails();}).observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
showControls();
requestAnimationFrame(()=>setTimeout(()=>{
  try{for(const name of ['Male','Female']){meshes[name]=getMesh(name,'review');renderBody(name);}renderDetails();$('status').textContent='Adjusting '+state.edit.toLowerCase()+' · shared body scale in front, side and back';root.dataset.ready='true';}
  catch(error){$('status').textContent='Could not build body meshes: '+error.message;root.dataset.error=error.message;console.error(error);}
},0));
