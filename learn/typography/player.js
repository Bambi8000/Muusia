import def from '../../src/defs/nodes/concrete.js';
const $=id=>document.getElementById('type-'+id), p=Object.fromEntries(def.params.map(p=>[p.key,p.def]));
let frame=0,running=false,last=0;
function draw(){const count=Number($('frames').value),motion=$('motion').value;
const extra=motion==='Zoom'?{text:'N',size:2.5,zoomRows:28,zoomCycle:'In & out'}:motion==='Shift'?{text:'TYPE',size:5,mode:'Fill region',shiftPattern:'Rows'}:{text:'WORDS MOVE',size:5,mode:'Columns',columns:2,shortText:'WORD'};
const r=def.compute([],{...p,...extra,motion,clock:'Timeline',cycles:1},{W:200,H:140,frameIdx:frame,frameCount:count},{});
$('art').innerHTML=`<g fill="none" stroke="#263c39" stroke-width=".3" stroke-linecap="round" stroke-linejoin="round">${r.paths.map(q=>`<path d="${q.pts.map((pt,i)=>(i?'L':'M')+pt.map(v=>v.toFixed(3)).join(' ')).join('')}${q.closed?'Z':''}"/>`).join('')}</g>`;
$('counter').textContent=`Frame ${frame+1} / ${count}`;$('scrub').max=count-1;$('scrub').value=frame;
$('note').textContent=motion==='Zoom'?'A larger N built from more fixed-size N marks. In & out returns to the starting size.':motion==='Shift'?'A filled field of TYPE letters. Rows change their order in whole-cell steps.':'Two columns of WORDS MOVE. The drawing is computed by the actual Concrete Poetry node.';
}
function tick(t){if(running&&t-last>125){frame=(frame+1)%Number($('frames').value);draw();last=t;}if(running)requestAnimationFrame(tick);}
$('play').addEventListener('click',()=>{running=!running;$('play').textContent=running?'Pause':'Play';if(running)requestAnimationFrame(tick);});
for(const id of ['motion','frames'])$(id).addEventListener('change',()=>{frame=0;draw();});
$('scrub').addEventListener('input',()=>{frame=Number($('scrub').value);draw();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){running=false;$('play').textContent='Play';}});draw();
