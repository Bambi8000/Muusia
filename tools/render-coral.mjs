/** Review artwork from the actual node; not browser-export or hardware evidence. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import coral from '../src/defs/nodes/coral.js';
import {PENS_DEFAULT,pathLength} from '../src/defs/helpers.js';
const out=resolve(process.argv[2]||'/tmp/muusia-coral-pilot');
await mkdir(out,{recursive:true});
const defaults=Object.fromEntries(coral.params.map(p=>[p.key,p.def]));
const studies=[
 ['brain','01 / Brain coral','A3 · winding ridges · three contour bands',{bands:3}],
 ['fine','02 / Single contours','A3 · one continuous outline per contour',{}],
 ['radial','03 / Radial coral','A3 · warped radial waves · three contour bands',{form:'Radial coral',bands:3}],
 ['cells','04 / Cells','A3 · small islands · three contour bands',{form:'Cells',bands:3,growth:0.9}],
 ['six-colours','05 / Six colours','A3 · black, teal, orange, blue, purple and ochre',{bands:3,colours:6}],
 ['tidal','06 / Tidal rings','A3 · radial colour placement · teal, blue and ochre',{form:'Radial coral',bands:3,colours:3,colouring:'By radius',layer:6,pen2:1,pen3:10,growth:0.9,density:18}],
];
const cards=[],records=[];
for(const [id,title,subtitle,overrides] of studies){
 const params={...defaults,...overrides},ctx={W:420,H:297},start=performance.now(),result=coral.compute([undefined],params,ctx);
 const layers=[...new Set(result.paths.map(p=>p.layer))].sort((a,b)=>a-b);
 const paths=result.paths.map(p=>`<path stroke="${PENS_DEFAULT[p.layer].c}" d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(4)},${y.toFixed(4)}`).join(' ')}${p.closed?' Z':''}"/>`).join('\n');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="288mm" height="288mm" viewBox="${210-144} ${148.5-144} 288 288"><title>${title}</title><g fill="none" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
 // The square viewBox is only gallery framing. Download uses the actual A3 page.
 const exportSvg=svg.replace('width="288mm" height="288mm"','width="420mm" height="297mm"').replace(`viewBox="${210-144} ${148.5-144} 288 288"`,'viewBox="0 0 420 297"');
 await writeFile(`${out}/${id}.svg`,exportSvg);await writeFile(`${out}/${id}-detail.svg`,svg);
 await writeFile(`${out}/${id}.muusia.json`,JSON.stringify({app:'muusia',v:1,name:`Coral — ${id}`,canvas:ctx,root:{nodes:[{id:9001,type:'coral',x:30,y:20,params}],edges:[]}},null,2)+'\n');
 const drawingM=result.paths.reduce((n,p)=>n+pathLength(p.pts,p.closed),0)/1000;
 const record={id,parameters:params,canvas:ctx,paths:result.paths.length,points:result.paths.reduce((n,p)=>n+p.pts.length,0),drawingM,layers,computeMs:Math.round(performance.now()-start)};records.push(record);
 cards.push(`<article><div class="caption"><h2>${title}</h2><p>${subtitle}</p></div><a href="${id}.svg"><img src="${id}-detail.svg" alt="${title}, actual Coral node output"></a><p class="meta">${record.paths} closed contours · ${drawingM.toFixed(1)} m of pen travel on paper</p><p><a href="${id}.muusia.json" download>Editable patch ↓</a> &nbsp; <a href="${id}.svg" download>A3 vector drawing ↓</a></p></article>`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coral — Muusia studies</title><style>*{box-sizing:border-box}body{margin:0;background:#f2f0e8;color:#25372e;font:16px/1.55 system-ui,sans-serif}header,main,footer{max-width:1500px;margin:auto;padding:32px 5vw}header{border-bottom:1px solid #a9b1a7}header p{max-width:800px}h1{font:clamp(60px,8vw,120px)/1 Georgia,serif;margin:20px 0}small{letter-spacing:.18em}main{display:grid;grid-template-columns:1fr 1fr;gap:40px}article{min-width:0;border-bottom:1px solid #b9c0b5;padding-bottom:28px}.caption{min-height:90px}h2{font:28px/1.3 Georgia,serif;margin:0 0 8px}p{margin:6px 0}img{display:block;width:100%;aspect-ratio:1;object-fit:contain;background:white}a{color:inherit;text-underline-offset:4px}.meta,footer{font-size:14px;color:#536257}footer{border-top:1px solid #a9b1a7}@media(max-width:720px){main{grid-template-columns:1fr}}</style><header><small>MUUSIA / NODE STUDY 02</small><h1>Coral</h1><p>Winding ridges, small islands and radial waves. These are real pen paths from the new Coral node, drawn with a 0.30 mm preview stroke. Try an outline, nested contour bands or up to six inks.</p><p><a href="http://127.0.0.1:5186/">Open the local Muusia build →</a> &nbsp; Help → Coral · Brain study</p></header><main>${cards.join('')}</main><footer><p>Local node batch in progress; not committed or published. App label remains v2.110 until the batch release. These node-generated drawings are review artwork. No hardware has been run. Growth calculations are heavier than Iris; changing pen colours or size reuses the current field.</p><p>Brain and Cells use a seeded Gray–Scott reaction-diffusion model; Radial uses a warped wave field. Mathematical background: <a href="https://www.karlsims.com/rd.html">Karl Sims — Reaction-Diffusion Tutorial</a>. Forms are artistic interpretations, not biological simulations.</p></footer></html>`);
console.log(`Wrote ${studies.length} Coral studies and patches to ${out}`);
console.log(records.map(({id,paths,points,computeMs})=>({id,paths,points,computeMs})));
