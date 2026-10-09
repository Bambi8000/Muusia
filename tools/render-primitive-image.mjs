/** Actual node output; review photos stay outside the repo.
 * node tools/render-primitive-image.mjs /absolute/decoded-image.json [output-dir]
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import node from '../src/defs/nodes/primitive_image.js';
import {PENS_DEFAULT,pathLength} from '../src/defs/helpers.js';
if(!process.argv[2])throw new Error('Pass decoded image JSON or a saved patch.');
const input=JSON.parse(await readFile(resolve(process.argv[2])));
const img=input.root?.nodes.find(n=>n.data?.img)?.data.img||input;
if(!img.w||!img.h||!img.g)throw new Error('No decoded image.');
const out=resolve(process.argv[3]||'/tmp/muusia-primitive-image');await mkdir(out,{recursive:true});
const defaults=Object.fromEntries(node.params.map(p=>[p.key,p.def])),canvas={W:297,H:420},cards=[],records=[];
for(const [id,title,desc,extra]of [
 ['triangles','Triangles / one pen','Fitted triangles become real strokes. Dark areas build up through overlapping hatching.',{}],
 ['ellipses','Ellipses / cross hatch','Soft geometric shapes, drawn in two hatch directions.',{shape:'Ellipses',count:180,render:'Cross hatch'}],
 ['colour','Mixed / six pens','The optimiser chooses from six physical inks. Some images need fewer than all six.',{shape:'Mixed',colours:6,count:180}],
 ['outlines','Geometric outlines','The same fitted polygons as outlines: a graphic interpretation of the tonal fit.',{render:'Outlines',count:70}],
]){
 const params={...defaults,...extra,file:'Review image'},n={id:9001,type:'primitive_image',x:30,y:20,params,data:{img}};
 const t=performance.now(),result=node.compute([],params,canvas,n),model=node._solve(params,img);
 const record={id,parameters:params,canvas,shapes:model.shapes.length,paths:result.paths.length,points:result.paths.reduce((s,p)=>s+p.pts.length,0),pens:[...new Set(result.paths.map(p=>p.layer))],drawingM:result.paths.reduce((s,p)=>s+pathLength(p.pts,p.closed),0)/1000,computeMs:Math.round(performance.now()-t),errorReduction:1-model.finalError/model.initialError};records.push(record);
 const fit=node._fit(params,canvas,img),body=result.paths.map(p=>`<path stroke="${PENS_DEFAULT[p.layer].c}" d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ')}${p.closed?' Z':''}"/>`).join('\n');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="420mm" viewBox="0 0 297 420"><title>${title}</title><g fill="none" stroke-width="${params.penWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
 await writeFile(`${out}/${id}.svg`,svg);
 await writeFile(`${out}/${id}-detail.svg`,svg.replace('viewBox="0 0 297 420"',`viewBox="${fit.x} ${fit.y} ${fit.w} ${fit.h}"`).replace('width="297mm" height="420mm"',`width="${fit.w}mm" height="${fit.h}mm"`));
 await writeFile(`${out}/${id}.muusia.json`,JSON.stringify({app:'muusia',v:1,name:`Primitive Image — ${id}`,canvas,root:{nodes:[n],edges:[]}}));
 cards.push(`<article><div><h2>${title}</h2><p>${desc}</p><p>${record.shapes} shapes · ${record.paths} strokes · ${record.drawingM.toFixed(1)} m</p><a href="${id}.muusia.json" download>Editable patch</a></div><img src="${id}-detail.svg" alt="Actual Primitive Image output"></article>`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Primitive Image studies</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f3ef;color:#263a43;font:16px/1.5 system-ui}header,main{max-width:1400px;margin:auto;padding:40px}h1{font:64px/1 Georgia;margin:20px 0}h2{font:30px/1.2 Georgia}article{display:grid;grid-template-columns:260px 1fr;border-top:1px solid #aaa;gap:35px;padding:40px 0}img{width:100%;background:white}a{color:inherit}p{max-width:650px}@media(max-width:700px){article{grid-template-columns:1fr}header,main{padding:20px}}</style><header><p>MUUSIA / PRIMITIVE IMAGE</p><h1>A picture, piece by piece.</h1><p>Actual pen paths from the new node. Geometric search inspired by <a href="https://github.com/fogleman/primitive">fogleman/primitive</a>, adapted to layered pen hatching on white paper. Load a patch to change the image or controls.</p></header><main>${cards.join('')}</main></html>`);
console.log(records.map(({id,shapes,paths,points,pens,computeMs,errorReduction})=>({id,shapes,paths,points,pens,computeMs,errorReduction})));
