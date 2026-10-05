/** Render review SVGs from the actual Image node and an already decoded image.
 * Usage: node tools/render-image-art.mjs /absolute/image-data.json [output-dir]
 * Accepts {w,h,g,rgb} or a .muusia.json with a loaded Image node. No network I/O.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import image from '../src/defs/nodes/image.js';
import lissajous from '../src/defs/nodes/lissajous.js';
import {EXAMPLES} from '../src/examples.js';
import {PENS_DEFAULT,pathLength} from '../src/defs/helpers.js';
if(!process.argv[2])throw new Error('Pass decoded image JSON or a loaded Image patch.');
const input=JSON.parse(await readFile(resolve(process.argv[2])));
const img=input.root?.nodes.find(n=>n.type==='image')?.data?.img||input;
if(!img.w||!img.h||!img.g)throw new Error('No decoded image found.');
const out=resolve(process.argv[3]||'/tmp/muusia-image-art');await mkdir(out,{recursive:true});
const defaults=Object.fromEntries(image.params.map(p=>[p.key,p.def]));
const drawingExample=EXAMPLES.find(e=>e.name==='Image · Drawing to blocks');
const defs={image,lissajous};
const drawingGraph=drawingExample.make(key=>Object.fromEntries(defs[key].params.map(p=>[p.key,p.def])));
const drawingSource=lissajous.compute([],drawingGraph.nodes[0].params,drawingExample.canvas);
const studies=[
 ['dots','01 / Organic dots','Tone becomes the size of each filled circle.',{mode:'Organic dots',cell:2.2,strength:1,gamma:1.4,jitter:.35}],
 ['strokes','02 / Short strokes','Short pen strokes turn with the photograph.',{mode:'Short strokes',cell:1.45,strength:1,gamma:1.1,passes:3,flow:1,jitter:.2,pitch:.2}],
 ['colour-dots','03 / Six-ink dots','Six tone bands, from warm highlights to dark shadows.',{mode:'Organic dots',cell:2.2,strength:1,gamma:1.4,jitter:.35,colours:6,colourmap:'Tone bands',layer:10,pen2:4,pen3:6,pen4:1,pen5:5,pen6:0}],
 ['source-strokes','04 / Colours from the image','The nearest selected pen follows the source colour.',{mode:'Short strokes',cell:1.45,strength:1,gamma:1.1,passes:3,flow:1,jitter:.2,pitch:.2,colours:6,layer:0,pen2:8,pen3:9,pen4:2,pen5:10,pen6:5}],
 ['rings','05 / Open rings','One circle per mark; the paper shows through.',{mode:'Organic dots',dotfill:'Outline',cell:2.1,strength:1,gamma:1.2,jitter:.35}],
 ['stitches','06 / Cross stitches','Two crossing directions with extra passes in the shadows.',{mode:'Cross stitches',cell:2,strength:1,gamma:1.3,passes:2,direction:'Flow field',angle:45,flow:.7,pitch:.25}],
 ['squares','07 / Square weave','Staggered squares grow with darkness. One continuous hatch fills each square.',{mode:'Square weave',cell:3.2,strength:1,gamma:1.25,jitter:0,pitch:.25}],
 ['colour-squares','08 / Six-ink square weave','Six tonal inks, with alternating horizontal and vertical fills.',{mode:'Square weave',squarefill:'Woven fill',cell:3.2,strength:1,gamma:1.25,jitter:0,pitch:.25,colours:6,colourmap:'Tone bands',layer:10,pen2:4,pen3:6,pen4:1,pen5:5,pen6:0}],
 ['drawing-blocks','09 / Drawing → squares','A live Lissajous curve enters the blue Drawing input. No photo is used.',{...drawingGraph.nodes[1].params},drawingGraph],
 ['drawing-dots','10 / Drawing → dots','The same wired curve becomes filled circles. Adjust the source node to change the result.',{...drawingGraph.nodes[1].params,mode:'Organic dots',dotfill:'Spiral fill',jitter:.2},drawingGraph],
];
const cards=[],records=[];
for(const [id,title,caption,overrides,graph]of studies){
 const canvas=graph ? drawingExample.canvas : {W:210,H:297};
 const params={...defaults,...overrides,file:graph?'':'Review image'},node=graph?{...graph.nodes[1],params}:{id:9001,type:'image',x:30,y:20,params,data:{img}};
 const start=performance.now(),result=image.compute(graph?[undefined,drawingSource]:[],params,canvas,node),layers=[...new Set(result.paths.map(p=>p.layer))].sort((a,b)=>a-b);
 const fit=graph?image._drawingFrame(params,canvas).fit:image._artFit(params,canvas,img);
 const body=result.paths.map(p=>`<path stroke="${PENS_DEFAULT[p.layer].c}" d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ')}${p.closed?' Z':''}"/>`).join('\n');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.W}mm" height="${canvas.H}mm" viewBox="0 0 ${canvas.W} ${canvas.H}"><title>${title}</title><g fill="none" stroke-width="${params.pitch}" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
 const detail=svg.replace(`width="${canvas.W}mm" height="${canvas.H}mm" viewBox="0 0 ${canvas.W} ${canvas.H}"`,`width="${fit.w}mm" height="${fit.h}mm" viewBox="${fit.x} ${fit.y} ${fit.w} ${fit.h}"`);
 await writeFile(`${out}/${id}.svg`,svg);await writeFile(`${out}/${id}-detail.svg`,detail);
 await writeFile(`${out}/${id}.muusia.json`,JSON.stringify({app:'muusia',v:1,name:`Image — ${id}`,canvas,root:graph?{nodes:[graph.nodes[0],node],edges:graph.edges}:{nodes:[node],edges:[]}}));
 const record={id,parameters:params,canvas,paths:result.paths.length,points:result.paths.reduce((s,p)=>s+p.pts.length,0),layers,drawingM:result.paths.reduce((s,p)=>s+pathLength(p.pts,p.closed),0)/1000,computeMs:Math.round(performance.now()-start)};records.push(record);
 cards.push(`<article id="${id}"><h2>${title}</h2><p>${caption}</p><a href="${id}.svg"><img src="${id}-detail.svg" alt="${title}: actual Image node vector output"></a><p class="meta">${record.paths.toLocaleString('en')} paths · ${record.drawingM.toFixed(1)} m · ${layers.length} ink${layers.length===1?'':'s'}</p><p><a href="${id}.muusia.json" download>Editable patch ↓</a> &nbsp; <a href="${id}.svg" download>A4 vector drawing ↓</a></p></article>`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Image — Muusia studies</title><style>*{box-sizing:border-box}body{margin:0;background:#eeeae1;color:#272a29;font:16px/1.55 system-ui,sans-serif}header,main,footer{max-width:1500px;margin:auto;padding:32px 5vw}header{border-bottom:1px solid #b6b4ad}h1{font:clamp(55px,8vw,110px)/1 Georgia,serif;margin:24px 0}h2{font:28px Georgia,serif;margin:0 0 10px}small{letter-spacing:.18em}header p{max-width:840px}main{display:grid;grid-template-columns:1fr 1fr;gap:42px}article{min-width:0;border-bottom:1px solid #b6b4ad;padding-bottom:25px}img{display:block;width:100%;margin:22px 0;background:white}p{margin:6px 0}a{color:inherit;text-underline-offset:4px}.meta,footer{font-size:14px;color:#666761}footer{border-top:1px solid #b6b4ad}@media(max-width:700px){main{grid-template-columns:1fr}}</style><header><small>MUUSIA / NODE STUDY 03</small><h1>One image.<br>Many marks.</h1><p>The existing Image node now turns photographs into organic dots, short strokes, cross stitches and tonal squares. Connect a blue Paths wire to Drawing to rebuild node artwork with the same marks. Every mark is a real pen path. Choose one ink or map the image to up to six pens.</p><p><a href="https://bambi8000.github.io/Muusia/">Open Muusia →</a> &nbsp; Load a patch below, or add Image and choose your own photo.</p></header><main>${cards.join('')}</main><footer><p>Requires Muusia v2.111 or later. Review SVGs are rendered from the real node. Photo studies use A4 portrait; wired drawing studies use A4 landscape, all with 12 mm margins. Dot fills use actual spiral paths; stroke width in these studies matches the Fill / pen pitch setting. Actual ink coverage depends on the pen and paper.</p><p>The five original Image modes remain available. Image Rasterise retains its separate CMYK workflow. No hardware has been run.</p></footer></html>`);
console.log(records.map(({id,paths,points,layers,computeMs})=>({id,paths,points,layers,computeMs})));
