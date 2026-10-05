/** Reproducible node output for visual review; not browser export evidence. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import def from '../src/defs/nodes/colour_scribble.js';
import {PENS_DEFAULT,pathLength} from '../src/defs/helpers.js';
export const STUDIES=[
 ['knot','Knot','Six inks, gathered into a dense tangle of small gestures.',{}],
 ['burst','Burst','A loose centre, with curved gestures escaping into the white.',{layout:'Burst',gesture:'Arcs',bundles:100,density:6,length:48,width:5,curve:0.75,disorder:0.35,threads:0.35,spread:0.85,seed:19}],
 ['river','River','Crossing coloured bundles collect into a winding current.',{layout:'River',gesture:'Mixed',bundles:170,density:15,length:29,width:10,spread:0.9,curve:0.25,threads:0.05,rotation:-12,seed:13}],
 ['islands','Islands','Small colour fields and angular wandering threads.',{layout:'Islands',gesture:'Hatching',bundles:135,density:13,length:24,width:9,spread:0.95,threads:0.6,rotation:0,seed:31}],
];
const out=resolve(process.argv[2]||'/tmp/muusia-colour-scribble');await mkdir(out,{recursive:true});
const defaults=Object.fromEntries(def.params.map(p=>[p.key,p.def]));
const canvas={W:420,H:297},cards=[],records=[];
for(const [id,title,caption,overrides] of STUDIES){
 const params={...defaults,...overrides},start=performance.now(),result=def.compute([],params,canvas);
 const strokes=result.paths.map(p=>`<path stroke="${PENS_DEFAULT[p.layer].c}" d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(4)},${y.toFixed(4)}`).join(' ')}"/>`).join('');
 await writeFile(`${out}/${id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297"><title>Colour Scribble — ${title}</title><g fill="none" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round">${strokes}</g></svg>`);
 await writeFile(`${out}/${id}.muusia.json`,JSON.stringify({app:'muusia',v:1,name:`Colour Scribble — ${title}`,canvas,root:{nodes:[{id:9001,type:'colour_scribble',x:30,y:20,params}],edges:[]}},null,2)+'\n');
 const record={id,params,canvas,paths:result.paths.length,points:result.paths.reduce((n,p)=>n+p.pts.length,0),layers:[...new Set(result.paths.map(p=>p.layer))],drawingM:result.paths.reduce((n,p)=>n+pathLength(p.pts,p.closed),0)/1000,computeMs:performance.now()-start};records.push(record);
 cards.push(`<article><div class="caption"><span>0${records.length}</span><h2>${title}</h2><p>${caption}</p></div><a href="${id}.svg"><img src="${id}.svg" alt="${title}: actual Colour Scribble node output"></a><div class="meta">${record.paths} strokes · ${record.drawingM.toFixed(1)} m drawn · A3 landscape · six pens</div><p><a href="${id}.muusia.json" download>Editable Muusia patch ↓</a> &nbsp; <a href="${id}.svg" download>Review SVG ↓</a></p></article>`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colour Scribble — Muusia</title><style>*{box-sizing:border-box}body{margin:0;color:#29272e;background:#f4f2ee;font:15px/1.5 system-ui}header,main,footer{max-width:1500px;margin:auto;padding:30px 4vw}header{display:flex;gap:6vw;align-items:end;border-bottom:1px solid #c0bdb7}header p{max-width:440px}small,.meta,.caption span{font:12px monospace}h1{font:clamp(54px,8vw,112px)/.92 Georgia,serif;letter-spacing:-.04em;margin:24px 0}main{display:grid;grid-template-columns:1fr 1fr;gap:50px 30px}.caption{position:relative;padding-left:32px;min-height:100px}.caption span{position:absolute;left:0;top:8px}h2{font:32px Georgia,serif;margin:0}p{margin:8px 0}img{width:100%;display:block;background:white;aspect-ratio:420/297}a{color:inherit;text-underline-offset:4px}.meta{margin-top:14px;color:#67616a}footer{border-top:1px solid #c0bdb7;color:#67616a}@media(max-width:760px){header{display:block}main{grid-template-columns:1fr}.caption{min-height:90px}}</style><header><div><small>MUUSIA / COLOUR SCRIBBLE</small><h1>A little<br>disorder.</h1></div><p>Bundles of pen strokes, layered in six inks. Gather them into a knot, let them fly, or make them flow across the sheet. Every line is a plotter path.<br><br>In the local app: <strong>Shift+N → Colour Scribble</strong>, or Help → one of the four studies.</p></header><main>${cards.join('')}</main><footer>Local preview of the unpublished node. Geometry is computed by the actual node, shown with a 0.30 mm stroke. These SVGs are review artwork; use the editable patches for Muusia's SVG/G-code export.</footer></html>`);
console.log(records.map(({id,paths,points,drawingM,computeMs})=>({id,paths,points,drawingM:+drawingM.toFixed(1),computeMs:+computeMs.toFixed(1)})));
