/** Render real Ribbon Organic paths and editable review patches. */
import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
import n from '../src/defs/nodes/ribbon.js';import {PENS_DEFAULT,pathLength} from '../src/defs/helpers.js';
import {EXAMPLES} from '../src/examples.js';
const out=resolve(process.argv[2]||'/tmp/muusia-ribbon-organic');await mkdir(out,{recursive:true});
const defaults=Object.fromEntries(n.params.map(p=>[p.key,p.def])),canvas={W:297,H:420},records=[],cards=[];
for(const [id,title]of [
 ['pleated','Organic pleats'], ['channels','Open channels'],
 ['ink','Ink pockets'], ['colour','Six ink pleats'],
]){
 const example=EXAMPLES.find(e=>e.name===`Ribbon · ${title}`);
 const params=example.make(()=>({...defaults})).nodes[0].params,start=performance.now(),r=n.compute([],params,canvas);
 const record={id,params,canvas,paths:r.paths.length,points:r.paths.reduce((s,p)=>s+p.pts.length,0),pens:[...new Set(r.paths.map(p=>p.layer))],metres:r.paths.reduce((s,p)=>s+pathLength(p.pts,p.closed),0)/1000,ms:performance.now()-start};records.push(record);
 const body=r.paths.map(p=>`<path stroke="${PENS_DEFAULT[p.layer].c}" d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(4)},${y.toFixed(4)}`).join(' ')}${p.closed?' Z':''}"/>`).join('\n');
 await writeFile(`${out}/${id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="420mm" viewBox="0 0 297 420"><title>${title}</title><g fill="none" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`);
 await writeFile(`${out}/${id}.muusia.json`,JSON.stringify({app:'muusia',v:1,name:`Ribbon — ${title}`,canvas,root:{nodes:[{id:9001,type:'ribbon',x:30,y:20,params}],edges:[]}},null,2)+'\n');
 cards.push(`<article><h2>${title}</h2><img src="${id}.svg" alt="Actual Ribbon Organic pen paths"><p>${record.paths} strokes · ${record.metres.toFixed(1)} m · <a href="${id}.muusia.json" download>Editable patch</a></p></article>`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Organic Ribbon / Muusia</title><style>*{box-sizing:border-box}body{margin:0;padding:40px;background:#eeece6;color:#242a2c;font:16px/1.5 system-ui}header{max-width:1300px;margin:auto;border-bottom:1px solid #777}h1{font:64px Georgia;margin:12px 0}h2{font:30px Georgia}main{display:grid;grid-template-columns:1fr 1fr;gap:40px;max-width:1300px;margin:auto}img{width:100%;background:#fff}a{color:inherit}@media(max-width:760px){main{grid-template-columns:1fr}body{padding:20px}}</style><header><p>MUUSIA / RIBBON</p><h1>Organic folds</h1><p>Flowing sheets, narrow seams and open pockets. Actual plotter paths, A3 portrait.</p></header><main>${cards.join('')}</main></html>`);
console.log(records.map(({id,paths,points,ms})=>({id,paths,points,ms:Math.round(ms)})));
