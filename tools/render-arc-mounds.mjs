/** Actual node geometry for local visual review, not browser export evidence. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import arc_mounds from '../src/defs/nodes/arc_mounds.js';
import {PENS_DEFAULT,pathLength} from '../src/defs/helpers.js';
const out=resolve(process.argv[2]||'/tmp/muusia-arc-mounds');
await mkdir(out,{recursive:true});
const defaults=Object.fromEntries(arc_mounds.params.map(p=>[p.key,p.def]));
const common={...defaults};
const studies=[
 ['billows','Soft bodies','Small curves nestle against fuller bodies. Linework only; no solid areas.',{}],
 ['rolls','Rolls','Long, softly bending bodies with rounded ends and transverse ribs.',{form:'Rolls',size:240,fullness:1,tilt:16,sizeContrast:0.65,bodyCurves:0.9,curveScale:260,pitch:1.8,flow:35}],
 ['large','Size contrast','Tiny mounds and generous forms share the same field.',{size:170,fullness:0.95,pitch:2.2,seed:31,sizeContrast:1,bodyCurves:0.9,curveScale:230}],
 ['wind','Turning arcs','Tilt and Arc flow turn the ribbed surfaces in different directions.',{size:155,tilt:48,flow:28,seed:5,bodyCurves:1,curveScale:150}],
 ['single','One mound','A soft asymmetric body with fuller lobes and a narrowing waist.',{layout:'Single',size:260,fullness:1.15,flow:36,tilt:15,pitch:2,bodyCurves:0.9,curveScale:260}],
 ['colour','Three inks','Whole mounds use purple, magenta and teal; their geometry stays the same.',{colours:3,layer:5,pen2:7,pen3:6}],
 ['fine','Fine ribs','Closer curves and flatter mounds create a flowing textile.',{size:160,fullness:0.55,pitch:1.2,flow:60,tilt:14,seed:9}],
];
const records=[],cards=[],canvas={W:297,H:420};
for(const [id,title,caption,overrides] of studies){
 const params={...common,...overrides},start=performance.now(),result=arc_mounds.compute([],params,canvas);
 const paths=result.paths.map(p=>`<path stroke="${PENS_DEFAULT[p.layer].c}" d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(4)},${y.toFixed(4)}`).join(' ')}${p.closed?' Z':''}"/>`).join('');
 await writeFile(`${out}/${id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="420mm" viewBox="0 0 297 420"><title>${title}</title><g fill="none" stroke-width="0.3" stroke-linejoin="miter" stroke-linecap="butt">${paths}</g></svg>`);
 await writeFile(`${out}/${id}.muusia.json`,JSON.stringify({app:'muusia',v:1,name:`Arc Mounds — ${title}`,canvas,root:{nodes:[{id:9001,type:'arc_mounds',x:30,y:20,params}],edges:[]}},null,2)+'\n');
 const record={id,params,canvas,paths:result.paths.length,points:result.paths.reduce((n,p)=>n+p.pts.length,0),layers:[...new Set(result.paths.map(p=>p.layer))],drawingM:result.paths.reduce((n,p)=>n+pathLength(p.pts,p.closed),0)/1000,computeMs:performance.now()-start};records.push(record);
 cards.push(`<article id="${id}"><div class="label"><span>${String(records.length).padStart(2,'0')}</span><div><h2>${title}</h2><p>${caption}</p></div></div><a href="${id}.svg"><img src="${id}.svg" alt="${title}, real Arc Mounds node drawing"></a><p class="meta">${record.paths} strokes · ${record.drawingM.toFixed(1)} m of pen travel · A3 portrait</p><p class="downloads"><a href="${id}.muusia.json" download>Editable patch ↓</a><a href="${id}.svg" download>Vector drawing ↓</a></p></article>`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arc Mounds — Muusia</title><style>*{box-sizing:border-box}body{margin:0;background:#ece9e2;color:#252834;font:15px/1.5 system-ui,sans-serif}header,main,footer{padding:28px 4vw;max-width:1600px;margin:auto}header{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #252834;gap:32px}small{font:12px monospace;letter-spacing:.1em}h1{font:clamp(64px,8vw,116px)/.95 Georgia,serif;letter-spacing:-3px;margin:18px 0 8px}header .intro{align-self:end;max-width:560px}p{margin:8px 0}a{color:inherit;text-underline-offset:4px}main{display:grid;grid-template-columns:1fr 1fr;gap:40px}.label{display:flex;gap:20px;min-height:88px}.label span{font:12px monospace;padding-top:6px}.label h2{font:27px/1.2 Georgia,serif;margin:0}article{min-width:0;border-bottom:1px solid #aaa99f;padding-bottom:24px}img{display:block;width:100%;background:white;aspect-ratio:297/420} .meta{font:12px monospace;margin:14px 0}.downloads{display:flex;gap:24px}footer{border-top:1px solid #252834;max-width:1600px;font-size:13px}@media(max-width:760px){header,main{grid-template-columns:1fr}.label{min-height:75px}}</style><header><div><small>MUUSIA / NODE STUDY 06</small><h1>Soft<br>forms.</h1></div><div class="intro"><p>Arc Mounds. A rolling field of soft, asymmetric bodies: generous curves, narrow waists and small forms nestled between larger ones.</p><p>Foreground shapes hide the lines behind them. No solid fills: the paper makes the light. Change Size contrast, Body curves and Curve scale, or isolate one body.</p><p><a href="https://bambi8000.github.io/Muusia/">Open Muusia ↗</a> &nbsp; Help → Arc Mounds · Billows</p></div></header><main>${cards.join('')}</main><footer>Requires Muusia v2.111 or later. These drawings are computed by the actual node, shown with a 0.30 mm preview stroke. The SVGs here are review artwork, separate from actual browser export captures.</footer></html>`);
console.log(`Rendered ${records.length} Arc Mounds studies to ${out}`);
console.log(records.map(({id,paths,points,computeMs})=>({id,paths,points,computeMs:+computeMs.toFixed(2)})));
