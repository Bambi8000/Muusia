import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as helpers from '../src/defs/helpers.js';
const baked=existsSync('src/defs/nodes/coral.js');
const def=baked ? (await import('../src/defs/nodes/coral.js')).default : new Function(...Object.keys(helpers),'return '+readFileSync('nodes-lab/coral.plotternode.js','utf8'))(...Object.values(helpers));
console.log(`${baked?'[baked]':'[lab]'} Coral — real helpers`);
const defaults=Object.fromEntries(def.params.map(p=>[p.key,p.def]));
const ctx={W:420,H:297};
const run=(p={},c=ctx,style)=>def.compute([style],{...defaults,...p},c);
let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const geometry=r=>r.paths.map(({pts,closed})=>({pts,closed}));
const points=r=>r.paths.reduce((n,p)=>n+p.pts.length,0);
function valid(r,label){
 check(r.paths.length>0,label+': nonempty');
 check(points(r)<=112000,label+': point budget');
 check(r.paths.every(p=>p.closed===true && p.pts.length>=3),label+': closed contours');
 check(r.paths.every(p=>Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),label+': valid pens');
 check(r.paths.every(p=>p.pts.every(pt=>pt.length===2&&pt.every(Number.isFinite))),label+': finite points');
 check(r.paths.every(p=>helpers.signedArea(p.pts)>0),label+': consistent winding');
 check(r.paths.every(p=>JSON.stringify(p.pts[0])!==JSON.stringify(p.pts.at(-1))),label+': no duplicate closure');
}
check(def.ins[0].type==='style'&&def.outs[0].type==='paths','pin contract');
check(new Set(def.params.map(p=>p.key)).size===def.params.length,'unique params');
check(def.params.filter(p=>p.type==='select').every(p=>p.options.includes(p.def)),'select contract');
// Marching squares is checked against an analytic disc and annulus, independent
// of the simulator. Exact grid-edge stitching must close both hole boundaries.
const N=61,disc=new Float32Array(N*N),annulus=new Float32Array(N*N);
for(let y=0;y<N;y++)for(let x=0;x<N;x++){const r=Math.hypot(x-30,y-30);disc[y*N+x]=20-r;annulus[y*N+x]=Math.min(r-10,20-r);}
const disk=def._contours({N,values:disc},0.13);
check(disk.length===1,'analytic disc has one complete contour');
check(disk[0].every(([x,y])=>Math.abs(Math.hypot(x-30,y-30)-19.87)<0.02),'disc interpolation accuracy');
const rings=def._contours({N,values:annulus},0.13);
check(rings.length===2,'annulus retains both inner and outer boundaries');
check(rings.every(p=>Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<1.5),'stitched closure has no long chord');
const started=performance.now(),base=run();const coldMs=performance.now()-started;
valid(base,'defaults');eq(run(),base,'memo replay deterministic');
const baselineJSON=JSON.stringify(base);
const changedSeed=run({seed:29});check(JSON.stringify(changedSeed)!==baselineJSON,'seed changes growth');
eq(run(),base,'cache invalidation restores original geometry');
const first=base.paths[0].pts[0][0];base.paths[0].pts[0][0]=-12345;check(run().paths[0].pts[0][0]===first,'returned geometry cannot mutate cached field');base.paths[0].pts[0][0]=first;
for(const form of ['Brain coral','Radial coral','Cells']){
 const r=run({form});valid(r,form);
 check(r.paths.every(p=>p.pts.every(([x,y])=>Math.hypot(x-210,y-148.5)<=138.5+1e-7)),form+': circular bounds');
 check(r.paths.length>=8,form+': meaningful pattern');
 for(const colours of [1,2,3,4,5,6]){
  const col=run({form,colours});eq(geometry(col),geometry(r),form+': colour preserves geometry');
  check(new Set(col.paths.map(p=>p.layer)).size===colours,form+': all selected pens represented');
 }
 const bands=run({form,bands:4});valid(bands,form+' four bands');
 check(bands.paths.length>r.paths.length,form+': bands add contours');
 const dense=run({form,density:32,growth:1,bands:4});valid(dense,form+' maximum work');
 check(dense.paths.every(p=>p.pts.every(([x,y])=>Math.hypot(x-210,y-148.5)<=138.5+1e-7)),form+': maximum stays bounded');
}
for(const key of ['density','growth','width','edge']){const value=key==='density'?12:0.1;check(JSON.stringify(run({[key]:value}))!==baselineJSON,key+' changes drawing');}
const small=run({diameter:100}),large=run({diameter:200});
eq(large.paths.map(p=>p.pts.length),small.paths.map(p=>p.pts.length),'physical sizing preserves topology');
check(large.paths.every((p,i)=>p.pts.every(([x,y],j)=>Math.abs(x-210-2*(small.paths[i].pts[j][0]-210))<1e-7&&Math.abs(y-148.5-2*(small.paths[i].pts[j][1]-148.5))<1e-7)),'diameter scales geometry exactly');
const rotated=run({rotation:90});check(rotated.paths.every((p,i)=>p.pts.every(([x,y],j)=>Math.abs(x-210+(base.paths[i].pts[j][1]-148.5))<1e-6&&Math.abs(y-148.5-(base.paths[i].pts[j][0]-210))<1e-6)),'rotation preserves true geometry');
for(const c of [{W:297,H:210},{W:210,H:297},{W:60,H:80}]){
 const r=run({cx:-10,cy:900,diameter:10000},c);valid(r,'fit extremes');
 check(r.paths.every(p=>p.pts.every(([x,y])=>x>=10-1e-6&&y>=10-1e-6&&x<=c.W-10+1e-6&&y<=c.H-10+1e-6)),'fit respects margins');
}
check(run({},{W:10,H:10}).paths.length===0,'empty footprint returns empty');
check(def.overlay({...defaults,diameter:420,sizing:'Exact diameter'},ctx)[0].r===210,'exact size is not normalised');
const pens=run({colours:6,layer:11,pen2:11,pen3:11,pen4:11,pen5:11,pen6:11});check(pens.paths.every(p=>p.layer===11),'shared pens collapse correctly');
const malformed={};for(const p of def.params)if(['slider','pen','seed'].includes(p.type))malformed[p.key]=NaN;
valid(run(malformed),'nonfinite fallbacks');
const extreme=run({form:'Radial coral',density:1e9,bands:1e9,colours:1e9,layer:-900,pen2:800,width:-900,edge:900,growth:900});valid(extreme,'numeric wire clamps');
// Use the actual style node to construct the engine's style contract.
const stroke=(await import('../src/defs/nodes/viiva.js')).default;
const styleParams=Object.fromEntries(stroke.params.map(p=>[p.key,p.def]));
const actualStyle=stroke.compute([],{...styleParams,dash:2,gap:1},ctx);
const styled=run({},ctx,actualStyle);check(JSON.stringify(styled)!==baselineJSON,'real Style input changes strokes');
console.log(`${checks} checks passed; ${base.paths.length} contours / ${points(base)} points; cold compute ${coldMs.toFixed(0)} ms`);
