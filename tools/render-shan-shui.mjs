/** Render actual Shan Shui paths and editable patches for local visual review. */
import fs from 'node:fs';import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
import * as H from '../src/defs/helpers.js';
const lab='nodes-lab/shan_shui.plotternode.js';
const source=fs.existsSync('src/defs/nodes/shan_shui.js')?null:fs.readFileSync(lab,'utf8');
const n=source?new Function(...Object.keys(H),'"use strict";return '+source)(...Object.values(H)):(await import('../src/defs/nodes/shan_shui.js')).default;
const out=resolve(process.argv[2]||'/tmp/muusia-shan-shui');await mkdir(out,{recursive:true});
const defaults=Object.fromEntries(n.params.map(p=>[p.key,p.def])),canvas={W:420,H:297},records=[],cards=[];
for(const [id,title,extra]of [
 ['valley','River valley',{}],
 ['range','Mountain range',{layout:'Mountain range',seed:18,mountains:5,trees:45,buildings:2,boats:0}],
 ['islands','Islands / six inks',{layout:'Islands',seed:27,mountains:5,colours:6,trees:55,buildings:2,boats:2}],
 ['brush','Brush outlines',{layout:'River valley',seed:42,lines:'Brush outlines',texture:20,trees:25}],
]){
 const params={...defaults,...extra},t=performance.now(),result=n.compute([],params,canvas);
 const record={id,parameters:params,canvas,paths:result.paths.length,points:result.paths.reduce((s,p)=>s+p.pts.length,0),pens:[...new Set(result.paths.map(p=>p.layer))].sort((a,b)=>a-b),drawingM:result.paths.reduce((s,p)=>s+H.pathLength(p.pts,p.closed),0)/1000,ms:Math.round(performance.now()-t)};records.push(record);
 const body=result.paths.map(p=>`<path stroke="${H.PENS_DEFAULT[p.layer].c}" d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ')}${p.closed?' Z':''}"/>`).join('\n');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297"><title>${title}</title><g fill="none" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
 await writeFile(`${out}/${id}.svg`,svg);
 await writeFile(`${out}/${id}.muusia.json`,JSON.stringify({app:'muusia',v:1,name:`Shan Shui — ${title}`,canvas,...(source?{customNodes:[{key:n.key,source}]}:{}),root:{nodes:[{id:9001,type:n.key,x:30,y:20,params}],edges:[]}}));
 cards.push(`<article><header><h2>${title}</h2><p>${record.paths} paths · ${record.drawingM.toFixed(1)} m</p><a href="${id}.muusia.json" download>Editable patch</a></header><img src="${id}.svg" alt="Actual ${title} plotter output"></article>`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shan Shui / Muusia</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f4ee;color:#293b34;font:16px/1.5 system-ui}main,body>header{max-width:1300px;margin:auto;padding:30px}h1{font:64px Georgia;margin:12px 0}h2{font:32px Georgia}article{border-top:1px solid #aaa;padding:28px 0}article header{display:flex;align-items:baseline;gap:28px}img{width:100%;background:white}a{color:inherit}</style><header><p>MUUSIA / LANDSCAPES</p><h1>Shan Shui</h1><p>Actual plotter paths using adapted <a href="https://github.com/LingDong-/shan-shui-inf">shan-shui-inf</a> geometry by Lingdong Huang. A3 landscape. Mountain silhouettes hide the strokes behind them.</p></header><main>${cards.join('')}</main></html>`);
console.log(records.map(({id,paths,points,pens,ms})=>({id,paths,points,pens,ms})));
