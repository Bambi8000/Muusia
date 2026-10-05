/** Actual node geometry for local visual review, not browser export evidence. */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import ribbon from '../src/defs/nodes/ribbon.js';
import {PENS_DEFAULT,pathLength} from '../src/defs/helpers.js';
const out=resolve(process.argv[2]||'/tmp/muusia-ribbon-angular');
await mkdir(out,{recursive:true});
const defaults=Object.fromEntries(ribbon.params.map(p=>[p.key,p.def]));
const common={...defaults,shape:'Angular',colours:6,layer:5,pen2:7,pen3:9,pen4:6,pen5:3,pen6:0,width:28,pitch:0.3,stripeGap:0.5};
const studies=[
 ['no-crossings','No crossings','Open left and right turns, with 6 mm clearance before page fitting.',{angularLayout:'No crossings',seed:27,turns:9,clearance:6}],
 ['free-folds','Free folds','Long spans, sharp corners and six ink bands.',{seed:27,turns:9}],
 ['diagonal','Crossing diagonals','A different seed changes the whole folded path.',{seed:11,turns:7,rotate:-10}],
 ['line-work','Parallel lines','One pen. Every filament follows the same sharp backbone.',{angularFill:'Lines',lines:32,colours:1,layer:0,seed:17,turns:8}],
 ['zigzag','Zigzag','Repeated sharp turns with a clipped corner limit.',{angularLayout:'Zigzag',turns:4,width:24,miterLimit:8}],
 ['star','Star loop','A continuous closed star with five pen bands.',{angularLayout:'Star',starPoints:5,width:25,colours:5,rotate:18,miterLimit:4}],
 ['ring','Ring, in colour','The existing smooth loop now accepts six selected pens.',{shape:'Ring',width:35,widthVar:0,lines:60,wander:15,colours:6}],
];
const records=[],cards=[],canvas={W:297,H:420};
for(const [id,title,caption,overrides] of studies){
 const params={...common,...overrides},start=performance.now(),result=ribbon.compute([],params,canvas);
 const paths=result.paths.map(p=>`<path stroke="${PENS_DEFAULT[p.layer].c}" d="${p.pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(4)},${y.toFixed(4)}`).join(' ')}${p.closed?' Z':''}"/>`).join('');
 await writeFile(`${out}/${id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="420mm" viewBox="0 0 297 420"><title>${title}</title><g fill="none" stroke-width="0.3" stroke-linejoin="miter" stroke-linecap="butt">${paths}</g></svg>`);
 await writeFile(`${out}/${id}.muusia.json`,JSON.stringify({app:'muusia',v:1,name:`Ribbon — ${title}`,canvas,root:{nodes:[{id:9001,type:'ribbon',x:30,y:20,params}],edges:[]}},null,2)+'\n');
 const record={id,params,canvas,paths:result.paths.length,points:result.paths.reduce((n,p)=>n+p.pts.length,0),layers:[...new Set(result.paths.map(p=>p.layer))],drawingM:result.paths.reduce((n,p)=>n+pathLength(p.pts,p.closed),0)/1000,computeMs:performance.now()-start};records.push(record);
 cards.push(`<article id="${id}"><div class="label"><span>${String(records.length).padStart(2,'0')}</span><div><h2>${title}</h2><p>${caption}</p></div></div><a href="${id}.svg"><img src="${id}.svg" alt="${title}, real Ribbon node drawing"></a><p class="meta">${record.paths} strokes · ${record.drawingM.toFixed(1)} m of pen travel · A3 portrait</p><p class="downloads"><a href="${id}.muusia.json" download>Editable patch ↓</a><a href="${id}.svg" download>Vector drawing ↓</a></p></article>`);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(records,null,2)+'\n');
await writeFile(`${out}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sharp turns — Muusia Ribbon</title><style>*{box-sizing:border-box}body{margin:0;background:#ece9e2;color:#252834;font:15px/1.5 system-ui,sans-serif}header,main,footer{padding:28px 4vw;max-width:1600px;margin:auto}header{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #252834;gap:32px}small{font:12px monospace;letter-spacing:.1em}h1{font:clamp(64px,8vw,116px)/.95 Georgia,serif;letter-spacing:-3px;margin:18px 0 8px}header .intro{align-self:end;max-width:560px}p{margin:8px 0}a{color:inherit;text-underline-offset:4px}main{display:grid;grid-template-columns:1fr 1fr;gap:40px}.label{display:flex;gap:20px;min-height:88px}.label span{font:12px monospace;padding-top:6px}.label h2{font:27px/1.2 Georgia,serif;margin:0}article{min-width:0;border-bottom:1px solid #aaa99f;padding-bottom:24px}img{display:block;width:100%;background:white;aspect-ratio:297/420} .meta{font:12px monospace;margin:14px 0}.downloads{display:flex;gap:24px}footer{border-top:1px solid #252834;max-width:1600px;font-size:13px}@media(max-width:760px){header,main{grid-template-columns:1fr}.label{min-height:75px}}</style><header><div><small>MUUSIA / NODE STUDY 05</small><h1>Sharp<br>turns.</h1></div><div class="intro"><p>Ribbon, extended. Straight spans fold through hard corners. Six pens build solid-looking bands from parallel plotter strokes. No crossings makes open, meandering routes with left and right turns and space between the bands.</p><p>Free folds and Star overprint at crossings. No crossings keeps separate spans apart; Clearance sets the gap and Turns is a maximum. For over-and-under weaving, use Woven Ribbon. Choose a pen width that suits the final line pitch; ink mixing depends on your pens and paper.</p><p><a href="https://bambi8000.github.io/Muusia/">Open Muusia ↗</a> &nbsp; Help → Ribbon · No crossings</p></div></header><main>${cards.join('')}</main><footer>Requires Muusia v2.111 or later. These drawings are computed by the actual node, shown with a 0.30 mm preview stroke. The SVGs here are review artwork, separate from actual browser export captures.</footer></html>`);
console.log(`Rendered ${records.length} Ribbon studies to ${out}`);
console.log(records.map(({id,paths,points,computeMs})=>({id,paths,points,computeMs:+computeMs.toFixed(2)})));
