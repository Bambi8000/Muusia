// Generate real node SVGs and self-contained Muusia projects.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';
import N from '../src/defs/nodes/slice_raster.js';
import Lettering from '../src/defs/nodes/lettering.js';
import { PENS } from '../src/defs/helpers.js';
import { EXAMPLES } from '../src/examples.js';
export const defaults = Object.fromEntries(N.params.map(p => [p.key, p.def]));
const source=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8'),ast=parseAst(source,{lang:'jsx'}),decl=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='toSVG');
export const toSVG=new Function('PENS',source.slice(decl.start,decl.end)+';return toSVG;')(PENS);
export function evaluate(example,frameIdx=0,frameCount=24) {
  const defs={slice_raster:N,lettering:Lettering},canvas={...example.canvas,frameIdx,frameCount};
  const graph=example.make(type=>Object.fromEntries(defs[type].params.map(p=>[p.key,p.def]))),values=new Map();
  const get=id=>{
    if(values.has(id))return values.get(id);
    const node=graph.nodes.find(n=>n.id===id),def=defs[node.type];
    const ins=def.ins.map((_,port)=>{const e=graph.edges.find(e=>e.to===id&&e.toPort===port);return e?get(e.from):undefined;});
    const value=def.compute(ins,node.params,canvas,node);values.set(id,value);return value;
  };
  const node=graph.nodes.at(-1);return {graph,node,result:get(node.id)};
}
export function generate(dir) {
  fs.mkdirSync(dir,{recursive:true});
  const esm=fs.readFileSync(new URL('../src/defs/nodes/slice_raster.js',import.meta.url),'utf8'),custom='('+esm.slice(esm.indexOf('export default ')+15).trim().replace(/;$/,'')+')\n';
  fs.writeFileSync(path.join(dir,'slice_raster.plotternode.js'),custom);
  const records=[],cards=[];
  const examples=EXAMPLES.filter(e=>e.name.startsWith('Slice Raster · '));
  for(const [i,ex]of examples.entries()) {
    const {graph,result}=evaluate(ex),stem='slice-raster-'+(i+1);
    if(!result.paths.length)throw Error('Empty starter '+ex.name);
    fs.writeFileSync(path.join(dir,stem+'.svg'),toSVG(result,ex.canvas));
    fs.writeFileSync(path.join(dir,stem+'.muusia.json'),JSON.stringify({app:'muusia',v:1,name:ex.name,canvas:ex.canvas,customNodes:[{key:N.key,source:custom}],root:graph},null,2));
    fs.writeFileSync(path.join(dir,stem+'.paths.json'),JSON.stringify({canvas:ex.canvas,paths:result.paths,pens:PENS}));
    records.push({name:ex.name,paths:result.paths.length,points:result.paths.reduce((n,p)=>n+p.pts.length,0),slices:[...new Set(result.paths.map(p=>p.slice))]});
    cards.push(`<article><h2>${ex.name.replace('Slice Raster · ','')}</h2><img src="${stem}.svg"><p>${records.at(-1).paths} pen strokes</p></article>`);
  }
  fs.writeFileSync(path.join(dir,'checks.json'),JSON.stringify(records,null,2));
  fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><meta charset="utf-8"><title>Muusia · Slice Raster</title><style>body{font:14px/1.5 system-ui;background:#eae7e0;color:#252827;margin:24px}h1{font-size:24px}h2{font-size:16px}main{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}article{background:#fff;padding:14px}img{width:100%;height:340px;object-fit:contain}</style><h1>Slice Raster</h1><p>One registered image · independent halftones · actual plottable strokes</p><main>${cards.join('')}</main>`);
  return records;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(generate(path.resolve(process.argv[2]||'output/slice-raster')),null,2));
