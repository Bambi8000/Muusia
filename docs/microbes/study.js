import def from '../../src/defs/nodes/microbes.js';
import {PENS_DEFAULT} from '../../src/defs/helpers.js';
import {EXAMPLES} from '../../src/examples.js';
const root=document.querySelector('[data-microbes]') || document;
const $=id=>root.querySelector(`[data-microbe="${id}"]`) || root.querySelector('#'+id),defaults=()=>Object.fromEntries(def.params.map(p=>[p.key,p.def]));
const examples=EXAMPLES.filter(e=>e.name.startsWith('Microbes ·'));
const ids=['living-microscope','single-cell','swimming-bacteria','specimen-collection'];
let params,canvas,frame=0,playing=false,last=0;
function draw(paths){return paths.map(p=>`<path d="M${p.pts.map(q=>q.map(v=>v.toFixed(3)).join(',')).join('L')}${p.closed?'Z':''}" fill="none" stroke="${PENS_DEFAULT[p.layer].c}" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round"/>`).join('');}
function render(){
 const count=+$('frames').value, ps=def.compute([],{...params,clock:'Timeline',motion:$('motion').value,colours:+$('colours').value},{...canvas,frameIdx:frame,frameCount:count});
 $('art').setAttribute('viewBox',`0 0 ${canvas.W} ${canvas.H}`);$('art').innerHTML=draw(ps.paths);
 $('counter').textContent=`Frame ${frame+1} / ${count}`;$('scrub').max=count-1;$('scrub').value=frame;
 $('stats').textContent=`${ps.paths.length} strokes · ${canvas.W} × ${canvas.H} mm · ${new Set(ps.paths.map(p=>p.layer)).size} active pen(s)`;
}
function load(i){const ex=examples[i];canvas=ex.canvas;params=ex.make(defaults).nodes[0].params;frame=0;$('motion').value=params.motion;$('colours').value=params.colours;render();}
examples.forEach((ex,i)=>{
 const option=document.createElement('option');option.value=i;option.textContent=ex.name.split(' · ')[1];$('study').append(option);
 if(!root.dataset?.microbes){const a=document.createElement('a');a.href=ids[i]+'.muusia.json';a.download='';a.textContent=option.textContent+' ↓';$('downloads').append(a);}
});
const specimen=document.createElement('option');specimen.value='single';specimen.textContent='Enlarged specimen';specimen.disabled=true;$('study').append(specimen);
for(const organism of def.params.find(p=>p.key==='organism').options.slice(1)){
 const button=document.createElement('button');button.setAttribute('aria-label','Enlarge '+organism);
 const ps=def.compute([],{...defaults(),organism,count:1,size:100,variation:0,motion:'Still',margin:8},{W:100,H:100});
 button.innerHTML=`<svg viewBox="0 0 100 100" aria-hidden="true">${draw(ps.paths)}</svg><span>${organism}</span>`;
 button.onclick=()=>{params={...defaults(),organism,count:1,size:160,variation:0,interior:1};canvas={W:210,H:210};frame=0;$('study').value='single';$('colours').value='1';render();};$('species').append(button);
}
$('study').onchange=()=>load(+$('study').value);
for(const key of ['motion','colours','frames'])$(key).onchange=()=>{frame=0;render();};
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';};
$('scrub').oninput=e=>{playing=false;$('play').textContent='Play';frame=+e.target.value;render();};
function tick(now){if(playing&&now-last>120){frame=(frame+1)%+$('frames').value;render();last=now;}requestAnimationFrame(tick);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;$('play').textContent='Play';}});
load(0);requestAnimationFrame(tick);
