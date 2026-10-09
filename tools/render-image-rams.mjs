/** Real Image-node review output; source photo remains outside the repository.
 * node tools/render-image-rams.mjs /absolute/photo-data.json [output-dir]
 * Input: decoded {w,h,g,rgb}, or a saved Image patch. No network access.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import image from '../src/defs/nodes/image.js';
import {PENS_DEFAULT,pathLength} from '../src/defs/helpers.js';
if(!process.argv[2])throw new Error('Pass decoded image JSON or a saved Image patch.');
const input=JSON.parse(await readFile(resolve(process.argv[2])));
const img=input.root?.nodes.find(n=>n.type==='image')?.data?.img||input;
if(!img.w||!img.h||!img.g)throw new Error('No decoded image.');
const out=resolve(process.argv[3]||'/tmp/muusia-image-rams');await mkdir(out,{recursive:true});
const defaults=Object.fromEntries(image.params.map(p=>[p.key,p.def]));
const studies=[
 ['portrait','Rams contour','Long lines bend and gather around tonal features.',{cell:1.7,strength:.8,gamma:1.15}],
 ['diagonal','Diagonal relief','The same image with a rotated line direction and softer detail.',{cell:1.8,strength:1,gamma:1.25,ramsAngle:35,ramsSmooth:1.8}],
 ['fine','Fine contours','Closer lines retain smaller tonal details.',{cell:1.15,strength:.9,gamma:1.4,ramsSmooth:.65}],
 ['quiet','Quiet relief','A gentle tonal bend with the white background retained.',{cell:2.6,strength:.25,ramsSmooth:2,ramsWhite:true}],
];
const canvas={W:297,H:420},cards=[],records=[];
for(const [id,title,desc,overrides]of studies){
 const params={...defaults,mode:'Rams contour',...overrides,file:'Review image'},node={id:9001,type:'image',x:30,y:20,params,data:{img}};
 const start=performance.now(),result=image.compute([],params,canvas,node);
 const record={id,parameters:params,canvas,paths:result.paths.length,points:result.paths.reduce((s,p)=>s+p.pts.length,0),drawingM:result.paths.reduce((s,p)=>s+pathLength(p.pts,false),0)/1000,computeMs:Math.round(performance.now()-start)};records.push(record);
 const fit=image._artFit(params,canvas,img),body=result.paths.map(p=>`<path d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ')}"/>`).join('\n');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="420mm" viewBox="0 0 297 420"><title>${title}</title><g fill="none" stroke="${PENS_DEFAULT[params.layer].c}" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
 await writeFile(`${out}/${id}.svg`,svg);
 await writeFile(`${out}/${id}-detail.svg`,svg.replace('viewBox="0 0 297 420"',`viewBox="${fit.x} ${fit.y} ${fit.w} ${fit.h}"`).replace('width="297mm" height="420mm"',`width="${fit.w}mm" height="${fit.h}mm"`));
 await writeFile(`${out}/${id}.muusia.json`,JSON.stringify({app:'muusia',v:1,name:`Rams contour — ${id}`,canvas,root:{nodes:[node],edges:[]}}));
 cards.push(`<article><div><h2>${title}</h2><p>${desc}</p><p>${record.paths} paths · ${record.drawingM.toFixed(1)} m · ${record.computeMs} ms</p><a href="${id}.muusia.json" download>Editable patch</a></div><img src="${id}-detail.svg" alt="Actual Rams contour output"></article>`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Image / Rams contour studies</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f3ef;color:#263a43;font:16px/1.5 system-ui}header,main{max-width:1400px;margin:auto;padding:40px}h1{font:64px/1 Georgia;margin:20px 0}h2{font:30px/1.2 Georgia}article{display:grid;grid-template-columns:260px 1fr;border-top:1px solid #aaa;gap:35px;padding:40px 0}img{width:100%;background:white}a{color:inherit}p{max-width:650px}@media(max-width:700px){article{grid-template-columns:1fr}header,main{padding:20px}}</style><header><p>MUUSIA / IMAGE</p><h1>Rams contour</h1><p>A photograph, interpreted as long parallel lines. These review SVGs come from the actual Image node. A3 paper, 0.3 mm preview pen. Load a patch to try the controls.</p></header><main>${cards.join('')}</main></html>`);
console.log(records.map(({id,paths,points,drawingM,computeMs})=>({id,paths,points,drawingM,computeMs})));
