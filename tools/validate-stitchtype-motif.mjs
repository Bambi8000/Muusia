import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import def from '../src/defs/nodes/stitchtype.js';
import hairs from '../src/defs/nodes/grid_hairs.js';
import microbes from '../src/defs/nodes/microbes.js';
import stroke from '../src/defs/nodes/viiva.js';
const defaults = d => Object.fromEntries(d.params.map(p=>[p.key,p.def]));
const p=defaults(def), ctx={W:200,H:140};
const run=(source,over={},style)=>def.compute([style,source],{...p,...over},ctx,{});
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
const base={text:'TYPE',font:'Sampler 5x7',px:2,preset:'Custom',coreMark:'None',edgeMark:'None',haloMark:'None',auraMark:'None',pinMark:'None',rings:0};
const source={paths:[{pts:[[10,10],[20,10],[15,20]],closed:true,layer:2},{pts:[[11,12],[18,14]],closed:false,layer:6}]};
const original=JSON.stringify(source), a=run(source,base);
assert.ok(a.paths.length>0);assert.equal(hash(a),hash(run(source,base)));assert.equal(JSON.stringify(source),original,'input immutable');
assert.deepEqual(def.ins.map(p=>p.type),['style','paths']);
const layout=def._layout({...p,...base},ctx);const count=Array.from(layout.kind).filter(k=>k===1||k===2).length;
assert.equal(a.paths.length,count*2,'both motif paths repeated in every letter cell');
assert.ok(a.paths.some(q=>q.closed)&&a.paths.some(q=>!q.closed),'closure preserved');
assert.deepEqual([...new Set(run(source,{...base,motifPens:'Source pens'}).paths.map(q=>q.layer))].sort(),[2,6]);
assert.ok(run(source,{...base,motifPens:'Region pens'}).paths.every(q=>[p.penCore,p.penEdge].includes(q.layer)));
assert.notEqual(hash(a),hash(run(source,{...base,motifAngle:90})));
assert.notEqual(hash(a),hash(run(source,{...base,motifTurn:80,motifVary:.4,motifJitter:1,seed:8})));
assert.equal(hash(run(source,{markSource:'Built-in'})),hash(run(undefined)),'Built-in ignores source');
assert.equal(hash(run({paths:[]})),hash(run(undefined)),'empty Auto falls back');
assert.equal(run(undefined,{...base,markSource:'Wired motif'}).paths.length,0,'empty explicit motif leaves chosen cells empty');
assert.equal(hash(run({paths:[{pts:[[1,1],[1,1]],closed:false,layer:0}]})),hash(run(undefined)),'zero-size source fallback');
assert.equal(hash(run({paths:[{pts:[[NaN,0],[1,2]],closed:false,layer:0}]})),hash(run(undefined)),'invalid source ignored');
for(const target of ['Letter','Core','Edge','Halo','All rings']){
 const over={...base,motifCells:target,rings:2,motifSize:1,motifAngle:37,motifTurn:180,motifVary:.4,motifJitter:1};
 const l=def._layout({...p,...over},ctx), r=run(source,over);
 assert.ok(r.paths.length);
 for(const q of r.paths)for(const [x,y] of q.pts){
   assert.ok(Number.isFinite(x)&&Number.isFinite(y));
   const col=Math.floor((x-l.x0)/l.cell+1e-9), row=Math.floor((y-l.y0)/l.cell+1e-9), k=l.kind[row*l.cols+col];
   assert.ok(target==='All rings'?k>=1:target==='Letter'?k===1||k===2:target==='Core'?k===1:target==='Edge'?k===2:k===3,'mark remains in selected cell class');
 }
}
const huge={paths:Array.from({length:25},(_,j)=>({pts:Array.from({length:160},(_,i)=>[j+Math.cos(i/160*Math.PI*2),Math.sin(i/160*Math.PI*2)]),closed:true,layer:j%12}))};
const reduced=run(huge,base);assert.ok(reduced.paths.reduce((s,q)=>s+q.pts.length,0)<=112000);
assert.equal(reduced.paths.length%count,0,'detail reduction is equal across all cells');
const touched=new Set(reduced.paths.map(q=>{const [x,y]=q.pts[0];return Math.floor((x-layout.x0)/layout.cell)+','+Math.floor((y-layout.y0)/layout.cell);}));
assert.equal(touched.size,count,'budget preserves all letter cells');
for(const d of [hairs,microbes]){
 const motif=d.compute([], {...defaults(d),...(d===hairs?{cellW:60,cellH:60,margin:45,count:5}:{count:1,organism:'Rod',size:40,colours:1})},ctx,{});
 const r=run(motif,{...base,text:'INK',px:1});assert.ok(r.paths.length);assert.ok(r.paths.every(q=>q.pts.every(pt=>pt.every(Number.isFinite))));
}
const style=stroke.compute([],{...defaults(stroke),mode:'Dashed',dash:.4,gap:.3},ctx,{});
assert.notEqual(hash(a),hash(run(source,base,style)),'existing Style input still operates');
// Baseline hashes from the unmodified v2.117 node, before adding the Motif pin.
const legacy = [[{},"772b0b9f4b4fcfd897d45c1fa78565a8125bb55a94477ea1fc50575cf96a0696"],[{"preset":"Sampler"},"772b0b9f4b4fcfd897d45c1fa78565a8125bb55a94477ea1fc50575cf96a0696"],[{"preset":"Circuit"},"9f78c343d0a860f93485e8eca88b583fb591bb6c91b2b2c753fc52d038f517bc"],[{"preset":"Knit"},"5eedeab47b44965eec477ace46f70acdf8a875c3e571da70fc32fc9fec4306bf"],[{"preset":"Dotted"},"72ca580776736b7a0b260f30e38c12da32650d67dafa658cf8dc9a7f1532f1ce"],[{"text":"ÄÖÅ|TYPE","font":"Tiny 3x5"},"08ee749b207c0e47fa0109003efa5535c3a59f4fa315614c97a6c0f361a4e8a4"],[{"font":"Sampler 5x7","seed":99},"6632de1b0c1c6a65308e18bf1d3288235885c8901fdc860901fb7e7248e8c041"],[{"preset":"Custom","edgeMark":"Outline","coreMark":"Rings"},"aeeffff1bc20e27d33ca77a6849866c0e350c5fc84896b83f55b9651c984485d"]];
for(const [over,expected] of legacy)assert.equal(hash(run(undefined,over)),expected,'unwired v2.117 geometry: '+JSON.stringify(over));
console.log('Stitch Type motif checks passed: legacy geometry, pins, cell bounds, pens, determinism, source integrity, budgets, Style and real Grid Hairs/Microbes motifs.');
