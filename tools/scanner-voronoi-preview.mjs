// Real built-in Help graphs, standalone previews and reproducible projects.
import fs from 'node:fs';
import path from 'node:path';
import S from '../src/defs/nodes/scanner.js';
import V from '../src/defs/nodes/voronoi.js';
import G from '../src/defs/nodes/grid.js';
import D from '../src/defs/nodes/drawn_path.js';
import L from '../src/defs/nodes/lettering.js';
import F from '../src/defs/nodes/diffgrowth.js';
import { EXAMPLES } from '../src/examples.js';
const defs={scanner:S,voronoi:V,grid:G,drawn_path:D,lettering:L,diffgrowth:F};
export const defaults=k=>Object.fromEntries(defs[k].params.map(p=>[p.key,p.def]));
export function evaluate(ex){
  const graph=ex.make(defaults),out=new Map();
  for(const n of graph.nodes){const ins=[];for(const e of graph.edges.filter(e=>e.to===n.id)){const r=out.get(e.from);ins[e.toPort]=Array.isArray(r)?r[e.fromPort]:r;}out.set(n.id,defs[n.type].compute(ins,n.params,ex.canvas));}
  const result=out.get(graph.nodes.at(-1).id);return {graph,result:Array.isArray(result)?result[0]:result};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const dir=path.resolve(process.argv[2]||'/tmp/muusia-scanner-voronoi-preview');fs.mkdirSync(dir,{recursive:true});const cards=[],records=[];
 for(const [i,ex]of EXAMPLES.filter(e=>/^(Scanner|Voronoi) ·/.test(e.name)).entries()){
  const {graph,result}=evaluate(ex),{W,H}=ex.canvas;
  if(!result.paths.length)throw Error('Empty example '+ex.name);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${result.paths.map(p=>`<path fill="none" stroke="#252827" stroke-width=".28" stroke-linejoin="round" stroke-linecap="round" d="M${p.pts.map(q=>q.slice(0,2).map(n=>n.toFixed(6)).join(',')).join('L')}${p.closed?'Z':''}"/>`).join('')}</svg>`;
  fs.writeFileSync(path.join(dir,`example-${i+1}.svg`),svg);fs.writeFileSync(path.join(dir,`example-${i+1}.muusia.json`),JSON.stringify({app:'muusia',v:1,name:ex.name,canvas:ex.canvas,root:graph}));
  records.push({name:ex.name,paths:result.paths.length,points:result.paths.reduce((n,p)=>n+p.pts.length,0)});
  cards.push(`<article><h2>${ex.name}</h2><img src="example-${i+1}.svg"><p>${records.at(-1).paths} strokes · ${records.at(-1).points} points</p></article>`);
 }
 fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><meta charset="utf-8"><title>Muusia · Scanner & Voronoi</title><style>body{background:#e9e6df;color:#252827;font:14px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}article{background:#f7f5ef;padding:12px}img{width:100%;background:white}h2{font-size:15px}h1{font-size:24px}</style><h1>Muusia · Scanner & Voronoi</h1><p>Actual node outputs · continuous scans, bounded cells and differential growth</p><main>${cards.join('')}</main>`);
 console.log(JSON.stringify(records,null,2));
}
