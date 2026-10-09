/** Shan Shui: actual-helper, painter-order, pen and strict-runtime checks. */
import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import n from '../src/defs/nodes/shan_shui.js';import * as H from '../src/defs/helpers.js';
const defaults=Object.fromEntries(n.params.map(p=>[p.key,p.def])),ctx={W:420,H:297};
const run=(p={},c=ctx,ins=[])=>n.compute(ins,{...defaults,...p},c);
const hash=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
const geometry=r=>r.paths.map(({pts,closed})=>({pts,closed}));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
function valid(r,c=ctx,p={}){const fit=n._fit({...defaults,...p},c),pts=r.paths.flatMap(p=>p.pts);
 ok(r.paths.length>0,'nonempty scene');ok(pts.length<=110000,'base point budget');
 ok(pts.every(p=>p.length===2&&p.every(Number.isFinite)),'finite xy');
 ok(r.paths.every(p=>p.pts.length>=(p.closed?3:2)&&typeof p.closed==='boolean'),'valid path contract');
 ok(r.paths.every(p=>Number.isInteger(p.layer)&&p.layer>=0&&p.layer<12),'valid pen');
 ok(pts.every(([x,y])=>x>=fit.x-1e-7&&y>=fit.y-1e-7&&x<=fit.x+fit.w+1e-7&&y<=fit.y+fit.h+1e-7),'all strokes clipped to margin');
 ok(r.paths.every(p=>p.pts.slice(1).every((q,i)=>Math.hypot(q[0]-p.pts[i][0],q[1]-p.pts[i][1])>1e-8)),'no duplicate neighbours');
}
const t=performance.now(),random=Math.random,globalKeys=Reflect.ownKeys(globalThis),base=run();valid(base);eq(run(),base,'cached deterministic');
n._last=null;eq(run(),base,'uncached deterministic');eq(Math.random,random,'does not replace Math.random');eq(Reflect.ownKeys(globalThis),globalKeys,'no leaked globals');
for(const layout of ['River valley','Mountain range','Islands'])for(const lines of ['Fine lines','Brush outlines']){const r=run({layout,lines});valid(r);if(layout!=='River valley'||lines!=='Fine lines')ok(hash(r)!==hash(base),'mode changes geometry');}
for(const p of [{seed:18},{mountains:1},{mountains:8},{distant:0},{relief:50},{trees:0},{trees:85},{buildings:0},{buildings:4},{boats:0},{boats:3},{water:0},{texture:0},{hidden:false},{margin:30}]){const r=run(p);valid(r,ctx,p);ok(hash(r)!==hash(base),JSON.stringify(p)+' meaningful');}
for(const colours of [2,3,6]){const r=run({colours});eq(geometry(r),geometry(base),'pens preserve all geometry');ok(new Set(r.paths.map(p=>p.layer)).size===colours,'selected palette used');}
eq(geometry(run({layer:5})),geometry(base),'single pen preserves geometry');ok(run({layer:5}).paths.every(p=>p.layer===5),'single pen selected');
const altered=run();altered.paths[0].pts[0][0]=-999;eq(run(),base,'consumer cannot mutate cached geometry');
for(const canvas of [{W:297,H:420},{W:800,H:200},{W:100,H:100},{W:30,H:25}])valid(run({},canvas),canvas);
eq(run({}, {W:0,H:100}).paths,[],'zero width empty');eq(run({margin:60},{W:100,H:100}).paths,[],'full margin empty');
valid(run({mountains:NaN,distant:Infinity,relief:NaN,seed:Infinity,colours:Infinity}));
for(const key of ['trees','buildings','boats','water']){
 const category={trees:2,buildings:3,boats:5,water:4}[key],s=n._scene({...defaults,[key]:0},420/297);
 ok(s.commands.every(c=>c.category!==category),key+' zero removes that scenery');
}
// Painter order: a later white silhouette cuts the old line, without erasing
// its own later details. The original filled white polygons are never plotted.
const mask={kind:'mask',pts:[[4,-2],[6,-2],[6,2],[4,2]],closed:true,category:0};
const back={kind:'path',pts:[[0,0],[10,0]],closed:false,category:0};
const front={kind:'path',pts:[[4.5,0],[5.5,0]],closed:false,category:3};
const hidden=n._visible([back,mask,front],true);
const lengths=hidden.map(p=>H.pathLength(p.pts,p.closed)).sort((a,b)=>a-b);
eq(lengths,[1,4,4],'white silhouette removes exactly the covered interval');
ok(hidden.some(p=>p.category===3),'foreground detail retained');eq(n._visible([back,mask,front],false).length,2,'transparent mode skips masks only');
const second={...mask,pts:[[5,-2],[8,-2],[8,2],[5,2]]};
eq(n._visible([back,mask,second],true).map(p=>H.pathLength(p.pts,p.closed)).sort((a,b)=>a-b),[2,4],'overlapping masks remove union');
const concave={kind:'mask',closed:true,category:0,pts:[[2,-2],[8,-2],[8,2],[6,2],[6,-1],[4,-1],[4,2],[2,2]]};
eq(n._visible([back,concave],true).reduce((s,p)=>s+H.pathLength(p.pts,p.closed),0),6,'non-convex mask preserves separate visible intervals');
const clipped=n._clip([{pts:[[-5,5],[15,5]],closed:false,category:1}],{x:0,y:0,w:10,h:10});eq(clipped[0].pts,[[0,5],[10,5]],'physical page clip');
const split=n._clip([{pts:[[2,2],[20,2],[20,8],[2,8]],closed:false,category:1}],{x:0,y:0,w:10,h:10});eq(split.length,2,'leaving sheet lifts pen instead of drawing along border');
const style={kind:'style',mode:'Dashed',dash:2,gap:2,vary:0,phase:0,seed:2};eq(run({},ctx,[style]),H.applyStyle(base,style),'actual Style helper');
// Strict factory checks exercise real upstream geometry, with no sanitizer
// hiding invalid coordinates. Includes direct original shapes used by the node.
for(const seed of [1,27,42,99]){
 const commands=[],e=n._engine(seed,c=>commands.push(c),1,'Brush outlines',0);
 e.Mount.mountain(300,400,seed,{hei:400,wid:500,tex:100,veg:true});e.Mount.flatMount(700,450,seed,{hei:100,wid:250,tex:40});e.building(500,400,seed,{sto:4});e.boat(500,550,seed,{len:95,sca:.7});
 ok(commands.every(c=>c.pts.every(p=>p.every(Number.isFinite))),'finite upstream geometry, seed '+seed);
}
for(const seed of [3,17,91]){const p={seed,mountains:8,distant:5,trees:100,buildings:4,boats:3,texture:100,lines:'Brush outlines',colours:6};valid(run(p),ctx,p);}
ok(n.license.includes('Copyright (c) 2018 Lingdong Huang')&&n.license.includes('Permission is hereby granted'),'upstream MIT notice retained in runtime');
const src=fs.readFileSync('src/defs/nodes/shan_shui.js','utf8');ok(!/document\.|window\.|fetch\(|new Date\(|eval\(/.test(src),'no DOM, network or time dependencies');
const lab='nodes-lab/shan_shui.plotternode.js';if(fs.existsSync(lab)){const proto=new Function(...Object.keys(H),'"use strict";return '+fs.readFileSync(lab,'utf8'))(...Object.values(H));eq(proto.compute([],defaults,ctx),base,'strict prototype matches baked source');}
console.log(`Shan Shui: ${checks} checks passed (${Math.round(performance.now()-t)} ms).`);
