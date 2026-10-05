import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import def from '../src/defs/nodes/colour_scribble.js';
import * as H from '../src/defs/helpers.js';
const defaults=Object.fromEntries(def.params.map(p=>[p.key,p.def])),ctx={W:420,H:297};
const run=(p={},c=ctx,style)=>def.compute([style],{...defaults,...p},c);
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
const geometry=r=>r.paths.map(({pts,closed})=>({pts,closed}));
let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
function valid(result,p={},c=ctx){
 const r=def._region({...defaults,...p},c),pts=result.paths.flatMap(p=>p.pts);
 check(result.paths.length>0,'nonempty');check(pts.length<=110000,'bounded points');
 check(pts.every(q=>q.length===2&&q.every(Number.isFinite)),'finite 2D points');
 check(pts.every(([x,y])=>x>=r.x0-1e-6&&x<=r.x1+1e-6&&y>=r.y0-1e-6&&y<=r.y1+1e-6),'clipped to margin');
 check(result.paths.every(p=>p.closed===false&&p.pts.length>=2),'open drawable paths');
 check(result.paths.every(p=>Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),'valid pens');
 check(result.paths.every(p=>p.pts.every((q,i)=>!i||Math.hypot(q[0]-p.pts[i-1][0],q[1]-p.pts[i-1][1])>1e-8)),'no zero length segments');
 check(result.paths.every(p=>Object.keys(p).sort().join(',')==='closed,layer,pts'),'real paths only');
}
check(def.ins[0].type==='style'&&def.outs[0].type==='paths','standard ports');
check(new Set(def.params.map(p=>p.key)).size===def.params.length,'unique params');
check(def.params.filter(p=>p.type==='select').every(p=>p.options.includes(p.def)),'valid default choices');
const box={x0:0,y0:0,x1:10,y1:10};
eq(def._clip([[-5,5],[15,5]],box),[[[0,5],[10,5]]],'horizontal segment exact clipping');
eq(def._clip([[5,-5],[5,15]],box),[[[5,0],[5,10]]],'vertical segment exact clipping');
eq(def._clip([[-5,-5],[15,15]],box),[[[0,0],[10,10]]],'diagonal exact clipping');
eq(def._clip([[2,2],[20,2],[20,8],[2,8]],box),[[[2,2],[10,2]],[[10,8],[2,8]]],'excursion splits without drawing along boundary');
eq(def._clip([[-1,-1],[-1,20]],box),[],'outside line removed');
eq(def._clip([[2,2],[2,2],[3,3]],box),[[[2,2],[3,3]]],'repeated points skipped');
const before=JSON.stringify(defaults),start=performance.now(),base=run();valid(base);
eq(hash(run()),hash(base),'seed reproduces output');eq(JSON.stringify(defaults),before,'parameters not mutated');
for(const layout of ['Knot','Burst','River','Islands'])for(const gesture of ['Hatching','Arcs','Zigzags','Mixed']){
 const p={layout,gesture};const result=run(p);valid(result,p);
 eq(hash(run(p)),hash(result),layout+'/'+gesture+' repeatable');
 check(new Set(result.paths.map(p=>p.layer)).size===6,'all six colours used');
}
for(const c of [{W:210,H:297},{W:297,H:420},{W:60,H:40}])valid(run({margin:2},c),{margin:2},c);
for(const p of [{seed:17},{colours:1},{colours:3},{layout:'River',rotation:90,spread:1.5},{layout:'Burst',length:600,width:150,bundles:300,density:36,threads:1},{layout:'Islands',cx:0,cy:0,spread:1.5},{gesture:'Zigzags',bundles:300,density:36,width:150,length:600,threads:1}])valid(run(p),p);
for(const key of ['layout','gesture','bundles','density','length','width','spread','variation','disorder','curve','threads','rotation','cx','cy','margin','seed']){
 const p={layout:'River',gesture:'Arcs',bundles:37,density:5,length:66,width:24,spread:1,variation:0,disorder:0,curve:0,threads:0,rotation:45,cx:30,cy:30,margin:120,seed:999};
 check(hash(run({[key]:p[key]}))!==hash(base),key+' changes geometry');
}
for(const colours of [1,2,3,6]){const r=run({colours});eq(geometry(r),geometry(base),'pens do not change geometry');eq(new Set(r.paths.map(p=>p.layer)).size,colours,'requested pen count');}
eq(geometry(run({layer:11,pen2:0,pen3:2})),geometry(base),'pen selection independent of geometry');
check(run({layer:2,pen2:2,pen3:2,pen4:2,pen5:2,pen6:2}).paths.every(p=>p.layer===2),'same pen collapses colours');
const malformed={};for(const p of def.params)if(['slider','seed','pen'].includes(p.type))malformed[p.key]=NaN;valid(run(malformed),malformed);
const extreme={bundles:1e9,density:1e9,length:1e9,width:1e9,rotation:1e9,margin:-1,colours:1e9,layer:-999};valid(run(extreme),extreme);
eq(run({margin:500},{W:20,H:30}).paths,[],'empty region');eq(run({}, {W:0,H:0}).paths,[],'zero canvas');
const guide=def.overlay({...defaults,margin:20,cx:25,cy:75},ctx);eq(guide,[{kind:'rect',x:20,y:20,w:380,h:257},{kind:'point',x:105,y:222.75}],'guides use exact clipping and centre coordinates');
eq(hash(run({},ctx,{kind:'style',mode:'Solid'})),hash(base),'solid style unchanged');
const dashed=run({bundles:20},ctx,{kind:'style',mode:'Dashed',dash:2,gap:3,vary:0,phase:0,seed:1});valid(dashed,{bundles:20});
check(dashed.paths.length>run({bundles:20}).paths.length,'dashed style is applied');
const lab='nodes-lab/colour_scribble.plotternode.js';
if(fs.existsSync(lab)){const proto=new Function(...Object.keys(H),'return '+fs.readFileSync(lab,'utf8'))(...Object.values(H));eq(hash(proto.compute([],defaults,ctx)),hash(base),'lab/baked parity');}
console.log(`Colour Scribble: ${checks} checks passed; default ${base.paths.length} strokes / ${base.paths.reduce((n,p)=>n+p.pts.length,0)} points; suite ${(performance.now()-start).toFixed(0)} ms.`);
