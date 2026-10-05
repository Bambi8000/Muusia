/** Local motion review: every frame is computed by the baked node, not an export capture. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import concrete from '../src/defs/nodes/concrete.js';
import {PENS_DEFAULT} from '../src/defs/helpers.js';
const out=resolve(process.argv[2]||'/tmp/muusia-concrete-motion');
await mkdir(out,{recursive:true});
const defaults=Object.fromEntries(concrete.params.map(p=>[p.key,p.def]));
const common={...defaults,mode:'Columns',columns:2,text:'THURSDAY 1 OCTOBER 2026',shortText:'THU 1 OCT 26',size:4.5,lineh:1.2,amount:1,rowLag:0.04};
const studies=[
 ['Zoom','One N becomes a large N built from more copies of itself. Every small letter stays 5 mm tall.',{text:'N',size:5,zoomRows:32,zoomSpacing:1.25}],
 ['Shift','The whole field stays filled. Letters cycle through fixed cells; in Muusia also try Columns or seeded Shuffle.',{mode:'Fill region',text:'WORDS KEEP CHANGING',size:5,lineh:1.1,shiftPattern:'Rows',rowLag:0.02}],
 ['Word collapse','Phrases shorten, then return. Alternating outside edges stay anchored.',{}],
 ['Row squeeze','Two banks of text stretch and condense without losing letters.',{}],
 ['Wave','A travelling wave lifts and tilts each letter.',{columns:1,text:'WORDS IN MOTION',align:'Centre',size:9,lineh:1.9,distance:4,letterLag:0.05}],
 ['Breathing','A slow pulse moves through the composition and the letterforms.',{text:'INHALE | EXHALE',size:8,lineh:1.7,margin:36}],
 ['Accordion','Rows compress vertically, then open back up.',{text:'EXPAND | CONTRACT',size:7,lineh:1.6}],
 ['Row slide','Lines drift from side to side, each a little later than the last.',{text:'TO AND FRO',size:7,lineh:1.6,distance:12,margin:24}],
 ['Ripple','Circular waves travel outward through the text.',{columns:1,text:'A DROP IN THE OCEAN',align:'Centre',size:8,lineh:1.8,distance:8,margin:24}],
 ['Orbit','Each letter follows a small circular path.',{text:'ROUND AND ROUND',size:6,lineh:2,distance:3,margin:24}],
 ['Vortex','The composition twists around its centre and unwinds.',{columns:1,text:'TURNING INTO WORDS',align:'Centre',size:8,lineh:1.8,margin:40,amount:0.65}],
 ['Swarm','Seeded letters disperse and find their way home.',{text:'WORDS TAKE FLIGHT',size:6,lineh:2,distance:12,margin:24,rowLag:0,letterLag:0}],
 ['Letter flip','Letters turn edge-on and mirror, in a rolling sequence.',{text:'THE OTHER SIDE',size:6,lineh:1.8,letterLag:0.04}],
 ['Typewriter','Rows write and unwrite themselves, one letter at a time.',{text:'WORD BY WORD | LINE BY LINE',size:6,lineh:1.8}],
];
const records=[],N=32,canvas={W:210,H:297};
for(const [motion,caption,overrides] of studies){
 const id=motion.toLowerCase().replaceAll(' ','-'),params={...common,...(!['Zoom','Shift','Word collapse','Row squeeze'].includes(motion)?{clip:false,margin:24}:{}),motion,...overrides};
 await mkdir(`${out}/${id}`,{recursive:true});
 const start=performance.now();let maxPoints=0;
 for(let f=0;f<N;f++){
  const result=concrete.compute([],params,{...canvas,frameIdx:f,frameCount:N});
  maxPoints=Math.max(maxPoints,result.paths.reduce((n,p)=>n+p.pts.length,0));
  const paths=result.paths.map(p=>`<path stroke="${PENS_DEFAULT[p.layer].c}" d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(4)},${y.toFixed(4)}`).join(' ')}"/>`).join('');
  await writeFile(`${out}/${id}/${f}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><g fill="none" stroke-width="0.25" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`);
 }
 await writeFile(`${out}/${id}.muusia.json`,JSON.stringify({app:'muusia',v:1,name:`Poetry — ${motion}`,canvas,root:{nodes:[{id:9001,type:'concrete',x:30,y:20,params}],edges:[]}},null,2)+'\n');
 records.push({id,motion,caption,params,maxPoints,frameCount:N,averageMs:Math.round((performance.now()-start)/N)});
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Living type — Muusia</title>
<style>*{box-sizing:border-box}body{margin:0;color:#191b20;background:#e9e6df;font:15px/1.5 system-ui,sans-serif}header{padding:24px 4vw 18px;border-bottom:1px solid #191b20;display:flex;justify-content:space-between;align-items:baseline}header p{margin:0}a{color:inherit;text-underline-offset:4px}main{display:grid;grid-template-columns:340px 1fr;min-height:calc(100vh - 75px)}aside{padding:30px 32px;border-right:1px solid #191b20}h1{font:64px/.95 Georgia,serif;font-weight:normal;letter-spacing:-2px;margin:0 0 24px}nav{margin:28px 0}nav button{display:block;width:100%;background:none;color:inherit;border:0;border-top:1px solid #b6b3af;text-align:left;font:15px/1.5 inherit;padding:9px 0;cursor:pointer}nav button[aria-current=true]{font-weight:700;color:#b4402b}nav span{font:12px monospace;margin-right:18px}section{padding:24px 4vw;display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:24px;align-items:start}.sheet{background:white;box-shadow:0 2px 12px #0001;max-width:min(650px,calc((100vh - 120px)*210/297));margin:0 auto;width:100%}.sheet img{display:block;width:100%;aspect-ratio:210/297}section .control{position:sticky;top:24px}#play{width:100%;background:#191b20;color:#fff;border:0;padding:12px;cursor:pointer}input{width:100%;accent-color:#b4402b}small{font-size:12px}.control a{display:block;margin:20px 0}#readout{font:12px monospace;margin-top:15px}footer{border-top:1px solid #b6b3af;padding-top:14px;font-size:12px;color:#5c6066}@media(max-width:780px){main{grid-template-columns:1fr}aside{border-right:0;padding:24px}h1{font-size:48px}nav{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}section{padding:20px;grid-template-columns:1fr}section .control{position:static;display:flex;gap:12px;align-items:center;flex-wrap:wrap}#play{width:90px}input{width:160px}.control a{margin:0}header{font-size:12px}}</style>
<header><p>MUUSIA / NODE STUDY 04</p><a href="https://bambi8000.github.io/Muusia/">Open Muusia ↗</a></header><main><aside><h1>Living<br>type.</h1><p>Fourteen motions. One existing node.<br>Every letter is a real pen stroke.</p><nav>${records.map((r,i)=>`<button data-id="${r.id}" aria-current="${i===0}"><span>${String(i+1).padStart(2,'0')}</span>${r.motion}</button>`).join('')}</nav><p id="caption"></p><footer>Requires Muusia v2.111 or later.<br>32 computed frames per loop.<br>In Muusia: select Concrete Poetry, set ANIMATE to 24–36 frames and press Play.</footer></aside><section><div class="sheet"><img id="art" alt="Animated Concrete Poetry drawing"></div><div class="control"><button id="play">Pause</button><p><label for="frame">Frame</label><input id="frame" type="range" min="0" max="31" value="0"></p><p id="readout"></p><a id="patch" download>Editable patch ↓</a><a id="svg" download>Current SVG ↓</a><small>Node-generated review artwork. These are not browser export captures.</small></div></section></main>
<script>const studies=${JSON.stringify(records.map(({id,motion,caption})=>({id,motion,caption})))};let current=studies[0],frame=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;const el=id=>document.getElementById(id);function paint(){el('art').src=current.id+'/'+frame+'.svg';el('svg').href=el('art').src;el('frame').value=frame;el('readout').textContent=String(frame+1).padStart(2,'0')+' / 32';el('play').textContent=playing?'Pause':'Play'}function select(id){current=studies.find(s=>s.id===id);frame=0;el('caption').textContent=current.caption;el('patch').href=current.id+'.muusia.json';document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.id===id));for(let n=0;n<32;n++){const i=new Image;i.src=id+'/'+n+'.svg'}paint()}document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>select(b.dataset.id));el('play').onclick=()=>{playing=!playing;paint()};el('frame').oninput=e=>{playing=false;frame=+e.target.value;paint()};setInterval(()=>{if(playing&&!document.hidden){frame=(frame+1)%32;paint()}},85);select(current.id);</script></html>`);
console.log(`Rendered ${records.length} motions × ${N} frames to ${out}`);
console.log(records.map(({motion,maxPoints,averageMs})=>({motion,maxPoints,averageMs})));
