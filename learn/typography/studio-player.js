import def from '../../src/defs/nodes/type_studio.js';
import { PENS } from '../../src/defs/helpers.js';
const root=document.getElementById('type-studio');
if(root){
 const $=id=>root.querySelector('#studio-'+id);
 const defaults=Object.fromEntries(def.params.map(p=>[p.key,p.def]));
 let params={...defaults},timer;
 const active=p=>def.params.filter(d=>!d.showIf||d.showIf(p));
 function control(d){
  const label=document.createElement('label');label.textContent=d.label;
  let input=document.createElement(d.options||d.type==='pen'?'select':'input');
  input.dataset.key=d.key;
  if(d.options||d.type==='pen'){
   for(const [value,title] of (d.options?d.options.map(v=>[v,v]):PENS.map((p,i)=>[i,p.name]))){const option=document.createElement('option');option.value=value;option.textContent=title;input.append(option);}input.value=params[d.key];
  }else if(d.type==='check'){input.type='checkbox';input.checked=params[d.key];}
  else {input.type=d.type==='text'?'text':'number';if(d.type==='text')input.maxLength=128;input.value=params[d.key];if(d.min!==undefined)input.min=d.min;if(d.max!==undefined)input.max=d.max;input.step=d.step||1;}
  input.addEventListener('change',()=>{params[d.key]=d.type==='check'?input.checked:d.options||d.type==='text'?input.value:Number(input.value);if(d.options)controls();draw();});
  if(d.type==='text')input.addEventListener('input',()=>{params[d.key]=input.value;clearTimeout(timer);timer=setTimeout(draw,180);});
  label.append(input);return label;
 }
 function controls(){const box=$('controls');box.replaceChildren(...active(params).map(control));}
 function draw(){
  clearTimeout(timer);const start=performance.now();
  const r=def.compute([],params,{W:200,H:140},{});
  $('art').innerHTML=r.paths.map(q=>`<path fill="none" stroke="${PENS[q.layer].c}" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round" d="${q.pts.map((v,i)=>(i?'L':'M')+v.map(n=>n.toFixed(3)).join(' ')).join('')}${q.closed?'Z':''}"/>`).join('');
  const points=r.paths.reduce((n,q)=>n+q.pts.length,0);
  $('count').textContent=`${r.paths.length.toLocaleString('en')} paths · ${points.toLocaleString('en')} points · ${Math.round(performance.now()-start)} ms`;
  const id=params.mode.slice(0,2);
  const notes={
   '01':'Contours follow the whole word as one distance field. Large offsets can merge neighbouring letters.',
   '02':'The source strokes grow into strands. Use a larger page or fewer strands for a coarser pen.',
   '03':'A real closed letter face receives the selected pattern. Pattern Fill preserves nested counters.',
   '04':'The letter face is sampled into drawn squares. Cell size changes detail; fill pitch controls the marks inside each square.',
   '05':'Sine, zigzag or coiled strokes follow the letter skeleton. Phase can be driven by an animation wire.',
   '07':'Four Stitch Type presets. In Muusia you can also connect a drawing to blue Motif; the complete drawing becomes one cell mark.',
   '08':'Ribbon Type’s a–z alphabet. Capitals become lowercase. Digits and punctuation have no drawn glyphs. | starts another line.',
   '10':'Small text fills the large letter face. The existing Concrete Poetry method checks glyph centres; a few strokes can cross the boundary.',
   '11':'Characters cycles through separate letters in stable grid order. Whole text stamps the entire phrase. Release and Progress control the fall.',
   '12':'Hatched letter faces supply line density for the small characters. Read the character ramp from light to dark.',
  };
  $('note').textContent=notes[id];
 }
 $('reset').addEventListener('click',()=>{params={...defaults,mode:params.mode,text:params.text};controls();draw();});
 $('download').addEventListener('click',()=>{
  const patch={app:'muusia',v:1,name:'Type Studio · '+params.mode,canvas:{W:200,H:140},root:{nodes:[{id:9201,type:'type_studio',x:40,y:30,params:{...params}}],edges:[],outputId:9201}};
  const url=URL.createObjectURL(new Blob([JSON.stringify(patch,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='type-studio-'+params.mode.slice(0,2)+'.muusia.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 controls();draw();
}
