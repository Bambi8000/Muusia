import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as H from '../src/defs/helpers.js';
const keys=['circpack','hitomezashi','tessellation','venation','truchet'],defs={},lab=process.argv.includes('--lab');
for(const key of keys){const f='nodes-lab/'+key+'.plotternode.js';defs[key]=lab&&fs.existsSync(f)?Function(...Object.keys(H),'return '+fs.readFileSync(f,'utf8'))(...Object.values(H)):(await import('../src/defs/nodes/'+key+'.js')).default;}
const ctx={W:297,H:210},hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),defaults=k=>Object.fromEntries(defs[k].params.map(q=>[q.key,q.def]));let cases=0;
function check(v,c=ctx){if(Array.isArray(v)){v.forEach(q=>check(q,c));return;}assert.ok(v&&Array.isArray(v.paths));assert.ok(v.paths.reduce((n,q)=>n+q.pts.length,0)<=120000,'point budget');for(const q of v.paths){assert.ok(q.pts.length>=(q.closed?3:2));assert.ok(Number.isInteger(q.layer)&&q.layer>=0&&q.layer<12);for(const [x,y]of q.pts){assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(x>=-1e-6&&x<=c.W+1e-6&&y>=-1e-6&&y<=c.H+1e-6,'page bounds');}}}
function run(k,over={},ins=[],c=ctx){const p={...defaults(k),...over},before=hash({p,ins,c}),v=defs[k].compute(ins,p,c);assert.equal(hash({p,ins,c}),before,'pure '+k);check(v,c);cases++;return v;}
for(const k of keys){assert.equal(new Set(defs[k].params.map(q=>q.key)).size,defs[k].params.length);for(const p of defs[k].params)if(p.type==='select')assert.ok(p.options.includes(p.def));}
// Legacy output is compared with the actual published implementation, not a copied current formula.
for(const key of ['circpack','truchet']){const raw=execFileSync('git',['show','8b4fe01:src/defs/nodes/'+key+'.js'],{encoding:'utf8'}).replace(/^import[^;]+;\s*/,'').replace('export default','');const old=Function(...Object.keys(H),'return '+raw)(...Object.values(H)),p=Object.fromEntries(old.params.map(q=>[q.key,q.def]));for(const over of key==='truchet'?[{mode:'Tiles'},{mode:'Loop'},{mode:'Concentric bands'},{mode:'Butterfly'}]:[{},{seed:22,minR:2.25}])assert.equal(hash(run(key,over)),hash(old.compute([],{...p,...over},ctx)),'legacy '+key);}
const outer=[[35,25],[262,25],[262,185],[35,185]],hole=[[110,75],[187,75],[187,135],[110,135]],region={paths:[outer,hole].map(pts=>({pts,closed:true,layer:0}))};
const inside=([x,y])=>x>=35-1e-6&&x<=262+1e-6&&y>=25-1e-6&&y<=185+1e-6&&!(x>110+1e-6&&x<187-1e-6&&y>75+1e-6&&y<135-1e-6);
for(const k of keys)for(const over of k==='circpack'?[{fill:'Spiral'},{fill:'Rings'}]:k==='truchet'?[{mode:'Custom tile'}]:k==='tessellation'?[{family:'Rhombus'},{family:'Floret'}]:[{}])assert.equal(hash(run(k,over)),hash(run(k,over)),'deterministic '+k);
for(const fill of ['Outline','Spiral','Rings']){
 const over={fill,colours:4,clearance:1},v=run('circpack',over,[undefined,region]);assert.ok(v.paths.length);for(const q of v.paths)for(const p of q.pts)assert.ok(inside(p),'packing region hole');
 const circles=defs.circpack._pack([undefined,region],{...defaults('circpack'),...over},ctx);for(let i=0;i<circles.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(circles[i][0]-circles[j][0],circles[i][1]-circles[j][1])>=circles[i][2]+circles[j][2]+1-1e-6,'circle clearance');
 assert.equal(new Set(v.paths.map(q=>q.layer)).size,4);
}
for(const phase of ['Seeded','Alternating','Binary strings'])for(const colours of [1,2,3,4])for(const angle of [0,37,90]){const v=run('hitomezashi',{phase,colours,angle},[undefined,region]);assert.ok(v.paths.length);for(const q of v.paths)for(let j=0;j<=10;j++)assert.ok(inside(q.pts[0].map((a,k)=>a+(q.pts[1][k]-a)*j/10)),'stitch region');assert.equal(new Set(v.paths.map(q=>q.layer)).size,colours);}
for(const family of ['Rhombus','Floret'])for(const drawing of ['Edges','Inset bands','Both'])for(const angle of [0,23]){const v=run('tessellation',{family,drawing,angle,colours:4},[undefined,region]);assert.ok(v.paths.length);for(const q of v.paths)for(let i=0;i<q.pts.length-(q.closed?0:1);i++)for(let j=0;j<8;j++){const a=q.pts[i],b=q.pts[(i+1)%q.pts.length];assert.ok(inside(a.map((v,k)=>v+(b[k]-v)*j/8)),'tessellation region');}}
// Independent tiling oracles: no duplicate edges and exactly one tile at generic interior samples.
const pointIn=(q,pts)=>{let b=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],d=pts[j];if((a[1]>q[1])!==(d[1]>q[1])&&q[0]<(d[0]-a[0])*(q[1]-a[1])/(d[1]-a[1])+a[0])b=!b;}return b;};
for(const family of ['Rhombus','Floret']){
 const ts=defs.tessellation._tiles({...defaults('tessellation'),family},ctx);if(family==='Rhombus')assert.equal(ts.length,3*7*7,'lozenge tile count');
 if(family==='Floret')for(let x=25.137;x<270;x+=8.919)for(let y=24.271;y<185;y+=9.317)assert.equal(ts.filter(t=>pointIn([x,y],t.pts)).length,1,'Floret exact tiling');
 for(const t of ts)for(let i=0;i<t.pts.length;i++){const a=t.pts[(i+t.pts.length-1)%t.pts.length],b=t.pts[i],c=t.pts[(i+1)%t.pts.length],u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]],angle=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)))))*180/Math.PI;assert.ok(Math.abs(angle-60)<1e-6||Math.abs(angle-120)<1e-6,'tile corner angle');}
 const v=run('tessellation',{family,drawing:'Edges',colours:1}),seen=new Set();for(const q of v.paths){const k=q.pts.map(p=>p.map(v=>v.toFixed(5)).join(',')).sort().join('|');assert.ok(!seen.has(k),'shared edge only once');seen.add(k);}
}
for(const cornerLink of ['Linked','Alternate','Paired','Independent'])for(const insetCopies of [0,2]){const over={mode:'Custom tile',cornerLink,insetCopies,customColours:4,knotsTR:[[.6,.3,0]],knotsBR:[[.1,.7,1]],knotsBL:[[.7,.7,1]]},v=run('truchet',over);assert.ok(v.paths.length);assert.equal(new Set(v.paths.map(q=>q.layer)).size,4);}
const tiny=run('truchet',{mode:'Custom tile',tile:4,insetCopies:4,copyGap:3,margin:0},[],{W:12,H:12});assert.equal(new Set(tiny.paths.map(q=>JSON.stringify(q.pts))).size,tiny.paths.length,'collapsed inset copies are not repeated');
const custom=defs.truchet._gesture([[.5,.3,1]],.8);assert.deepEqual(custom[0],[0,.25]);assert.deepEqual(custom.at(-1),[.25,0]);
for(const motion of ['Manual','Timeline']){let prev=new Set();for(const growth of [0,20,50,100]){const c={...ctx,frameIdx:growth/100*20,frameCount:21},v=run('venation',{motion,growth,colours:4},[undefined,region],c)[0],edges=new Set(v.paths.flatMap(q=>q.pts.slice(1).map((p,i)=>JSON.stringify([q.pts[i],p]))));for(const e of prev)assert.ok(edges.has(e),'growth prefix retains geometry');prev=edges;for(const q of v.paths)for(let i=1;i<q.pts.length;i++)for(let j=0;j<9;j++)assert.ok(inside(q.pts[i-1].map((a,k)=>a+(q.pts[i][k]-a)*j/8)),'veins avoid holes');}assert.ok(prev.size>20);}
assert.notEqual(hash(run('venation',{seed:1})),hash(run('venation',{seed:2})));
for(const k of keys){const over=k==='truchet'?{mode:'Custom tile',tile:1.5,insetCopies:4}:k==='circpack'?{fill:'Rings',pitch:.3,attempts:6000,minR:.25}:k==='tessellation'?{family:'Floret',cell:2,bands:8}:{};run(k,over,[],{W:594,H:420});run(k,{...over,margin:600},[],{W:10,H:8});}
console.log('PlotterFiles suite passed: '+cases+' geometry cases; legacy equality, tiling coverage, fixed anchors, region holes, growth prefixes, colour mapping and bounds.');
