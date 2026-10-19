import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import * as H from '../src/defs/helpers.js';
const lab=process.argv.includes('--lab'),d=lab?Function(...Object.keys(H),'return '+fs.readFileSync('nodes-lab/region_hatch.plotternode.js','utf8'))(...Object.values(H)):(await import('../src/defs/nodes/region_hatch.js')).default;
const base=Object.fromEntries(d.params.map(q=>[q.key,q.def])),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');let cases=0;
function img(w,h,f){const g=[],rgb=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=f(x,y);if(Array.isArray(c)){rgb.push(...c);g.push(1-(c[0]*.299+c[1]*.587+c[2]*.114)/255);}else{g.push(c);const b=(1-c)*255;rgb.push(b,b,b);}}return {w,h,g,rgb};}
const art=img(64,48,(x,y)=>(x-32)**2+(y-24)**2<80?.05:y<14?.25:y<30?.6:.9);
function run(over={},im=art,ctx={W:297,H:210}){const p={...base,...over},node={data:{img:im}},before=hash({p,node,ctx}),out=d.compute([],p,ctx,node);assert.equal(hash({p,node,ctx}),before,'pure');assert.equal(out.length,2);for(const ps of out){let points=0;for(const q of ps.paths){points+=q.pts.length;assert.ok(q.pts.length>=(q.closed?3:2));assert.ok(Number.isInteger(q.layer)&&q.layer>=0&&q.layer<12);for(const [x,y]of q.pts)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=-1e-6&&x<=ctx.W+1e-6&&y>=-1e-6&&y<=ctx.H+1e-6,'finite bounds');}assert.ok(points<=120000,'per-output point budget');}cases++;return out;}
assert.ok(d.params.some(p=>p.type==='file'));assert.equal(d.fileImage,true);assert.equal(new Set(d.params.map(p=>p.key)).size,d.params.length);assert.deepEqual(run({},null),[{paths:[]},{paths:[]}]);
for(const method of ['Posterize','SLIC'])for(const colours of [1,2,4])for(const wobble of [0,.3]){const a=run({method,colours,wobble});assert.ok(a[0].paths.length&&a[1].paths.length);assert.equal(hash(a),hash(run({method,colours,wobble})));assert.ok(a[1].paths.every(p=>p.closed));}
assert.notEqual(hash(run({method:'Posterize'})),hash(run({method:'SLIC'})));
assert.deepEqual(run({method:'Posterize',cell:3,compact:.02}),run({method:'Posterize',cell:30,compact:1}),'hidden SLIC controls');assert.deepEqual(run({wobble:0,seed:1,wave:1}),run({wobble:0,seed:999,wave:30}),'hidden wobble controls');assert.deepEqual(run({angleMode:'Fixed',angleMax:1}),run({angleMode:'Fixed',angleMax:180}),'hidden angle maximum');
assert.deepEqual(run({colours:1,pen2:4,pen3:5,pen4:6,mapping:'Tone bands'}),run({colours:1,pen2:9,pen3:10,pen4:11,mapping:'Source colours'}),'hidden pens');
for(const key of ['levels','resolution','smooth','minRegion']){const over={method:'Posterize',[key]:key==='levels'?9:key==='resolution'?40:key==='smooth'?4:100};assert.notEqual(hash(run({method:'Posterize'})),hash(run(over)),key+' changes segmentation');}
const solid=img(20,20,()=>.8),rect=run({method:'Posterize',smooth:0,resolution:32,angleMode:'Fixed',angleMin:0},solid);assert.equal(rect[1].paths.length,1);assert.equal(rect[1].paths[0].pts.length,4);assert.ok(rect[0].paths.every(q=>q.pts.every(pt=>Math.abs(pt[1]-q.pts[0][1])<1e-7)),'fixed horizontal');
const hole=img(40,40,(x,y)=>x>=12&&x<28&&y>=12&&y<28?0:.8),holed=run({method:'Posterize',smooth:0,minRegion:1,resolution:40,angleMode:'Fixed',angleMin:0},hole);assert.equal(holed[1].paths.length,2,'outer and hole');assert.ok(H.signedArea(holed[1].paths[0].pts)*H.signedArea(holed[1].paths[1].pts)<0,'opposite winding');
// Independent raster membership oracle checks every wobbly segment midpoint.
for(const wobble of [0,1,2]){const p={...base,method:'Posterize',smooth:0,minRegion:1,resolution:40,angleMode:'Fixed',angleMin:27,wobble},v=run(p,hole),fit=d._fit(p,{W:297,H:210},hole);for(const q of v[0].paths)for(let i=1;i<q.pts.length;i++)for(const t of [.2,.5,.8]){const x=q.pts[i-1][0]*(1-t)+q.pts[i][0]*t,y=q.pts[i-1][1]*(1-t)+q.pts[i][1]*t,ix=(x-fit.x)/fit.w*40,iy=(y-fit.y)/fit.h*40;assert.ok(!(ix>12+1e-6&&ix<28-1e-6&&iy>12+1e-6&&iy<28-1e-6),'hole remains blank');}}
const tone=run({method:'Posterize',smooth:0,minRegion:1,colours:4,mapping:'Tone bands',layer:4,pen2:6,pen3:1,pen4:5},img(40,40,(x,y)=>[.1,.35,.6,.9][Math.floor(y/10)]));assert.deepEqual([...new Set(tone[0].paths.map(q=>q.layer))].sort((a,b)=>a-b),[1,4,5,6]);
assert.equal(run({},img(8,8,()=>0))[0].paths.length,0);run({},img(1,30,()=>.5));run({},img(30,1,()=>.5));run({},art,{W:10,H:10});
for(const method of ['Posterize','SLIC'])run({method,resolution:144,cell:3,minRegion:1,minSpacing:.2,maxSpacing:1,penWidth:1.5,wobble:2,wave:1},img(40,40,(x,y)=>(x+y)%2?.2:.9),{W:841,H:594});
const grey={...art};delete grey.rgb;assert.deepEqual(run({colours:4,mapping:'Source colours'},grey),run({colours:4,mapping:'Tone bands'},grey));
// Independent contour area oracle: every region has exactly its cell area,
// including diagonal contacts, nested holes and merged tiny components.
for(const method of ['Posterize','SLIC'])for(const minRegion of [1,12,100]){
 const p={...base,method,minRegion,resolution:40,smooth:0},im=img(40,32,(x,y)=>((x*31+y*17)%23)/23),seg=d._segment(p,im);
 for(const region of seg.regions){const loops=d._loops(region.edges);assert.ok(loops.length);const area=loops.reduce((s,pts)=>s+H.signedArea(pts),0);assert.ok(Math.abs(area-region.count)<1e-7,'closed contour area equals raster material');}
 cases++;
}
// Physical principal axis: a tall rectangle produces vertical strokes.
const tall=run({method:'Posterize',angleMin:0,angleMax:180,cutoff:.1,smooth:0,minRegion:1,resolution:40},img(40,40,(x,y)=>x>17&&x<23&&y>4&&y<36?.8:0));assert.ok(tall[0].paths.every(q=>Math.abs(q.pts[0][0]-q.pts.at(-1)[0])<1e-6));
assert.ok(run({penWidth:.7},solid)[0].paths.length<run({penWidth:.2},solid)[0].paths.length,'physical width controls spacing');
run({method:'SLIC',resolution:32,cell:3,wobble:2,wave:1,minSpacing:.2,maxSpacing:1,penWidth:1.5},art,{W:100000,H:100000});
const {patch,lessons}=await import('../learn/regions/fixtures.mjs'),fixture=patch(lessons[0]),contours=d.compute([],fixture.root.nodes[0].params,fixture.canvas,fixture.root.nodes[0])[1];
for(const key of ['hatch','warp','inflate3d']){const consumer=(await import('../src/defs/nodes/'+key+'.js')).default,pa=Object.fromEntries(consumer.params.map(q=>[q.key,q.def]));if(key==='warp')pa.mode='Cell interpolation';if(key==='inflate3d')pa.inputShape='Closed outlines';const out=consumer.compute([contours],pa,fixture.canvas);assert.ok((Array.isArray(out)?out[0]:out).paths.length,key+' consumes region contours');if(key==='inflate3d')assert.ok(out[2]?.tri>0);cases++;}
console.log('PASS Region Hatch:',cases,'cases; deterministic, bounded, holes/winding, fixed angles, hidden controls, four pen preservation, dense output and grayscale fallback.');
