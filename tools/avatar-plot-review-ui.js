import {AVATAR_DEFAULTS,AVATAR_CONTROLS,buildAvatarMesh} from '../src/avatar-geometry.js';
import {AVATAR_PLOT_DEFAULTS,plotAvatar} from '../src/avatar-plot.js';
import {avatarPlotSvg} from '../src/avatar-plot-export.js';

const root=document.getElementById('avatar-plot-review');
const $=id=>root.querySelector('#plot-'+id);
const styles=['Brush','Contours','Hatching','Contours + hatching'];
const groups=[...new Set(AVATAR_CONTROLS.map(c=>c.group))];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const saved=window.openai?.widgetState?.privateContent?.avatarPlotReview;
function cleanBody(values,preset){
  const body={...AVATAR_DEFAULTS,preset,seed:preset==='Male'?17:43};
  for(const c of AVATAR_CONTROLS)if(Number.isFinite(+values?.[c.key]))body[c.key]=clamp(+values[c.key],c.min,c.max);
  if(Number.isFinite(+values?.seed))body.seed=clamp(Math.round(+values.seed),0,999999);
  return body;
}
function clean(s={}){
  return {body:s.body==='Male'?'Male':'Female',bodies:{Male:cleanBody(s.bodies?.Male,'Male'),Female:cleanBody(s.bodies?.Female,'Female')},area:groups.includes(s.area)?s.area:'Body',region:['Bust','Feet','Band'].includes(s.region)?s.region:'Full body',view:['Front','Side','Back','Manual'].includes(s.view)?s.view:'Three-quarter',yaw:clamp(Number.isFinite(+s.yaw)?+s.yaw:30,0,360),brushWidth:clamp(+s.brushWidth||2.5,1,6),brushEconomy:clamp(Number.isFinite(+s.brushEconomy)?+s.brushEconomy:.82,.5,1),pitch:clamp(+s.pitch||.9,.7,2),lightAngle:clamp(Number.isFinite(+s.lightAngle)?+s.lightAngle:225,0,360),crosshatch:s.crosshatch!==false,styleSeed:clamp(Math.round(Number.isFinite(+s.styleSeed)?+s.styleSeed:137),0,999999),cuts:{Bust:clamp(+s.cuts?.Bust||74,1,98),Feet:clamp(+s.cuts?.Feet||9,1,98),Band:clamp(+s.cuts?.Band||50,1,98)},lockScale:!!s.lockScale};
}
let state=clean(saved),timer=0,generation=0;
const meshCache=new Map(),drawings=[];
function persist(){
  window.openai?.setWidgetState?.({modelContent:{avatarPlot:{body:state.body,bodies:state.bodies,region:state.region,turnDegrees:state.yaw,brushWidthMm:state.brushWidth,brushEconomy:state.brushEconomy,finePitchMm:state.pitch,lightAngle:state.lightAngle,crosshatch:state.crosshatch,styleSeed:state.styleSeed,cuts:state.cuts,lockedScale:state.lockScale}},privateContent:{avatarPlotReview:state}})?.catch(()=>{});
}
function updateFields(){
  $('body').value=state.body;$('region').value=state.region;$('view').value=state.view;
  $('yaw').value=state.yaw;$('yaw-value').textContent=Math.round(state.yaw)+'°';
  $('brush').value=state.brushWidth;$('brush-value').textContent=state.brushWidth.toFixed(1)+' mm';
  $('economy').value=Math.round(state.brushEconomy*100);$('economy-value').textContent=Math.round(state.brushEconomy*100)+'%';
  $('pitch').value=state.pitch;$('pitch-value').textContent=state.pitch.toFixed(1)+' mm';
  $('light').value=state.lightAngle;$('light-value').textContent=state.lightAngle+'°';
  $('cross').checked=state.crosshatch;$('lock').checked=state.lockScale;
  $('cut-field').hidden=state.region==='Full body';
  $('cut').value=state.cuts[state.region]||50;$('cut-value').textContent=(state.cuts[state.region]||50)+'%';
  $('area').value=state.area;$('body-seed').value=state.bodies[state.body].seed;$('style-seed').value=state.styleSeed;
}
function bodyControls(){
  updateFields();$('anatomy').replaceChildren();
  for(const c of AVATAR_CONTROLS.filter(c=>c.group===state.area)){
    const label=document.createElement('label');label.className='form-label';
    const head=document.createElement('span');head.className='plot-label';
    const name=document.createElement('span');name.textContent=c.label;
    const value=document.createElement('output');value.className='tabular-nums';value.textContent=state.bodies[state.body][c.key]+'%';head.append(name,value);
    const input=document.createElement('input');input.type='range';input.className='form-range';input.min=c.min;input.max=c.max;input.step=c.step||1;input.value=state.bodies[state.body][c.key];input.setAttribute('aria-label',c.label);
    input.addEventListener('input',()=>{state.bodies[state.body][c.key]=+input.value;value.textContent=input.value+'%';schedule(220,'draft');});
    input.addEventListener('change',()=>{persist();schedule(0,'review');});
    label.append(head,input);$('anatomy').append(label);
  }
}
function meshFor(body,quality){
  const key=quality+JSON.stringify(body);
  if(!meshCache.has(key)){meshCache.set(key,buildAvatarMesh(body,{quality}));while(meshCache.size>6)meshCache.delete(meshCache.keys().next().value);}
  return meshCache.get(key);
}
function contextFor(s){
  if(s.region==='Full body'||s.lockScale)return {W:210,H:297,size:260,margin:12,pen:0};
  return {W:210,H:s.region==='Bust'?170:150,size:190,margin:12,pen:0};
}
function viewFor(s){
  return {yaw:s.yaw,pitch:0,roll:0,mode:s.region,cut:s.region==='Full body'?undefined:s.cuts[s.region]/100,band:.15,frame:s.region==='Full body'||s.lockScale?'body':'selection',rotationEnvelope:'yaw'};
}
const round=v=>Math.round(v*1000)/1000;
function renderArt(index,drawing,context,options,snapshot){
  const width=options.style==='Brush'?options.brushWidth:options.penWidth;
  const title=options.style+' · '+snapshot.body+' · '+snapshot.region+' · '+Math.round(snapshot.yaw)+' degrees';
  const paths=drawing.paths.map(p=>'<path d="M'+p.pts.map(q=>round(q[0])+','+round(q[1])).join('L')+(p.closed?'Z':'')+'"/>').join('');
  $('art-'+index).innerHTML='<svg class="plot-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+context.W+' '+context.H+'" role="img" aria-label="'+title+'"><title>'+title+'</title><g fill="none" stroke="currentColor" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round">'+paths+'</g></svg>';
  const stats=drawing.stats;
  $('stats-'+index).textContent=stats.pathCount+' strokes · '+(stats.lengthMm/1000).toFixed(2)+' m'+(index>0?' · '+stats.effectivePitch.toFixed(2)+' mm pitch':'');
  drawings[index]={drawing,context,options,snapshot};
}
function schedule(delay=100,quality='review'){
  generation++;const token=generation;clearTimeout(timer);root.dataset.ready='false';
  $('status').textContent='Updating '+state.body.toLowerCase()+' · '+state.region.toLowerCase()+'…';
  timer=setTimeout(()=>render(token,quality),delay);
}
async function render(token,quality){
  const snapshot=clean(state),body=snapshot.bodies[snapshot.body],context=contextFor(snapshot),view=viewFor(snapshot);
  try{
    const mesh=meshFor(body,quality);
    $('paper').textContent=(context.H===297?'A4 · ':'Study · ')+context.W+' × '+context.H+' mm';
    for(let index=0;index<styles.length;index++){
      if(token!==generation)return;
      $('status').textContent='Drawing '+styles[index].toLowerCase()+'…';
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const options={...AVATAR_PLOT_DEFAULTS,style:styles[index],brushWidth:snapshot.brushWidth,brushEconomy:snapshot.brushEconomy,pitch:snapshot.pitch,penWidth:.35,lightAngle:((snapshot.lightAngle+180)%360)-180,crosshatch:snapshot.crosshatch?AVATAR_PLOT_DEFAULTS.crosshatch:0,styleSeed:snapshot.styleSeed,outlinePen:0,detailPen:0,shadePen:0};
      const drawing=plotAvatar(mesh,view,options,context);
      if(token!==generation)return;
      renderArt(index,drawing,context,options,snapshot);
    }
    $('status').textContent=snapshot.body+' · '+snapshot.region.toLowerCase()+' · anatomy seed '+body.seed+' · drawing seed '+snapshot.styleSeed;
    root.dataset.ready='true';delete root.dataset.error;
  }catch(error){if(token===generation){$('status').textContent='Could not draw these settings: '+error.message;root.dataset.error=error.message;}console.error(error);}
}
for(let index=0;index<styles.length;index++){
  $('download-'+index).setAttribute('aria-label','Download '+styles[index]+' SVG');
  $('download-'+index).addEventListener('click',()=>{
    const result=drawings[index];if(!result)return;
    const {drawing,context,options,snapshot}=result;
    const svg=avatarPlotSvg(drawing,context,{...options,title:snapshot.body+' · '+snapshot.region+' · '+styles[index],preset:snapshot.body,mode:snapshot.region,seed:snapshot.bodies[snapshot.body].seed});
    const blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=('avatar-'+snapshot.body+'-'+snapshot.region+'-'+styles[index]).toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}
$('body').addEventListener('change',()=>{state.body=$('body').value;bodyControls();persist();schedule(0);});
$('region').addEventListener('change',()=>{state.region=$('region').value;updateFields();persist();schedule(0);});
$('view').addEventListener('change',()=>{state.view=$('view').value;if(state.view!=='Manual')state.yaw=({Front:0,Side:90,Back:180,'Three-quarter':30})[state.view];updateFields();persist();schedule(0);});
for(const [id,key,convert] of [['yaw','yaw',v=>v],['brush','brushWidth',v=>v],['economy','brushEconomy',v=>v/100],['pitch','pitch',v=>v],['light','lightAngle',v=>v]]){
  $(id).addEventListener('input',()=>{state[key]=convert(+$(id).value);if(id==='yaw')state.view='Manual';updateFields();schedule(150);});
  $(id).addEventListener('change',()=>{persist();schedule(0);});
}
$('cut').addEventListener('input',()=>{state.cuts[state.region]=+$('cut').value;updateFields();schedule(150);});
$('cut').addEventListener('change',()=>{persist();schedule(0);});
$('cross').addEventListener('change',()=>{state.crosshatch=$('cross').checked;persist();schedule(0);});
$('lock').addEventListener('change',()=>{state.lockScale=$('lock').checked;persist();schedule(0);});
$('area').addEventListener('change',()=>{state.area=$('area').value;bodyControls();persist();});
$('body-seed').addEventListener('input',()=>{state.bodies[state.body].seed=clamp(Math.round(+$('body-seed').value)||0,0,999999);schedule(180);});
$('body-seed').addEventListener('change',()=>{state.bodies[state.body].seed=clamp(Math.round(+$('body-seed').value)||0,0,999999);persist();schedule(0);});
$('style-seed').addEventListener('input',()=>{state.styleSeed=clamp(Math.round(+$('style-seed').value)||0,0,999999);schedule(180);});
$('style-seed').addEventListener('change',()=>{state.styleSeed=clamp(Math.round(+$('style-seed').value)||0,0,999999);persist();schedule(0);});
$('next-seed').addEventListener('click',()=>{state.bodies[state.body].seed=(state.bodies[state.body].seed+1)%1000000;updateFields();persist();schedule(0);});
window.addEventListener('openai:set_globals',event=>{const next=event.detail?.globals?.widgetState?.privateContent?.avatarPlotReview;if(next){state=clean(next);bodyControls();schedule(0);}});
bodyControls();schedule(0);
