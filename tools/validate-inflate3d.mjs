import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as helpers from '../src/defs/helpers.js';
import Spikes from '../src/defs/nodes/spikes3d.js';
import Slice from '../src/defs/nodes/meshslice.js';
import Container from '../src/defs/nodes/container.js';
import Superformula from '../src/defs/nodes/superformula.js';
const lab='nodes-lab/inflate3d.plotternode.js';
const useLab=!process.argv.includes('--baked')&&await fs.access(lab).then(()=>true,()=>false);
const N=useLab?Function(...Object.keys(helpers),'return '+await fs.readFile(lab,'utf8'))(...Object.values(helpers)):(await import('../src/defs/nodes/inflate3d.js')).default;
const defaults=d=>Object.fromEntries(d.params.map(p=>[p.key,p.def]));
const base=defaults(N),ctx={W:297,H:210},path=pts=>({pts,closed:true,layer:0});
const circle=(r=50,cx=100,cy=100,n=64)=>path(Array.from({length:n},(_,i)=>[cx+r*Math.cos(i/n*Math.PI*2),cy+r*Math.sin(i/n*Math.PI*2)]));
const disk={paths:[circle()]},ring={paths:[circle(),circle(22)]};
const concave={paths:[path([[0,0],[100,0],[100,25],[35,25],[35,75],[100,75],[100,100],[0,100]])]};
const islands={paths:[circle(35,40,60),circle(18,140,60)]};
let checks=0;
function evaluate(input=disk,patch={},canvas=ctx){
  const p={...base,...patch},before=JSON.stringify({input,p}),out=N.compute([input],p,canvas);
  assert.equal(JSON.stringify({input,p}),before,'No mutations');assert.equal(out.length,3);
  const m=Math.min(Math.max(0,Number(p.margin)||0),60,Math.max(0,Math.min(canvas.W,canvas.H)/2-.001));
  for(const ps of out.slice(0,2)){
    assert.ok(ps.paths.reduce((n,p)=>n+p.pts.length,0)<=90000,'Projection point budget');
    for(const q of ps.paths){assert.ok(q.pts.length>=2);assert.ok(Number.isInteger(q.layer)&&q.layer>=0&&q.layer<=11);for(const v of q.pts){assert.equal(v.length,2);assert.ok(v.every(Number.isFinite));assert.ok(v[0]>=m-1e-6&&v[0]<=canvas.W-m+1e-6&&v[1]>=m-1e-6&&v[1]<=canvas.H-m+1e-6,'Fits margin');}}
  }
  if(out[2]){
    const mesh=out[2];assert.equal(mesh.kind,'mesh');assert.ok(mesh.tri>0&&mesh.tri<=120000);assert.equal(mesh.v.length,mesh.tri*9);assert.ok(mesh.v.every(Number.isFinite));
    assert.ok(mesh.dims.every(Number.isFinite));assert.equal(Math.max(...mesh.dims),1);
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<mesh.v.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],mesh.v[i+k]);hi[k]=Math.max(hi[k],mesh.v[i+k]);assert.ok(Math.abs(mesh.v[i+k])<=.5001);assert.ok(Math.abs(mesh.v[i+k]*10000-Math.round(mesh.v[i+k]*10000))<1e-8);}
    for(let k=0;k<3;k++)assert.ok(Math.abs(hi[k]-lo[k]-mesh.dims[k])<.00021,'Normalized actual bounds');
  }
  checks++;return out;
}
function solid(mesh,label){
  const edges=new Map();let volume=0;
  for(let i=0;i<mesh.v.length;i+=9){const [a,b,c]=[0,3,6].map(k=>mesh.v.slice(i+k,i+k+3));
    const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-12,'Nondegenerate face');
    volume+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
    for(const [p,q] of [[a,b],[b,c],[c,a]]){const A=p.join(','),B=q.join(','),key=A<B?A+'|'+B:B+'|'+A;const e=edges.get(key)||{count:0,sign:0};e.count++;e.sign+=A<B?1:-1;edges.set(key,e);}
  }
  const bad=[...edges.values()].filter(e=>e.count!==2||e.sign!==0);assert.equal(bad.length,0,`${label}: every edge has two oppositely wound faces (${bad.length} bad)`);assert.ok(volume>1e-6,`${label}: outward positive volume`);checks++;
}
const start=performance.now(),original=evaluate();console.log(`Default: ${original[2]?.tri} triangles, ${original[0].paths.length} strokes, ${(performance.now()-start).toFixed(1)} ms`);
assert.deepEqual(original,evaluate(),'Determinism');assert.ok(original[0].paths.length&&original[1].paths.length);solid(original[2],'disk');
for(const [name,input] of [['ring',ring],['concave',concave],['islands',islands],['nested island',{paths:[circle(),circle(32),circle(12)]}],['rectangle',{paths:[path([[0,0],[120,0],[120,70],[0,70]])]}]]){
  for(const back of ['Inflated','Flat'])solid(evaluate(input,{back,detail:30})[2],name+' '+back);
}
const donut=evaluate(ring,{detail:40})[2];
// All mesh triangle centroids stay outside the central hole in plan.
for(let i=0;i<donut.v.length;i+=9){const x=(donut.v[i]+donut.v[i+3]+donut.v[i+6])/3,y=(donut.v[i+1]+donut.v[i+4]+donut.v[i+7])/3;assert.ok(Math.hypot(x,y)>.208,'Hole stays open at a 0.22 normalized radius');}
const reversed={paths:ring.paths.map(q=>({...q,pts:[...q.pts].reverse()}))};assert.deepEqual(evaluate(reversed)[2],evaluate(ring)[2],'Winding-independent holes');
const translated={paths:disk.paths.map(q=>({...q,pts:q.pts.map(([x,y])=>[x+1000,y-500])}))};assert.deepEqual(evaluate(translated)[2],original[2],'Translation-independent normalized mesh');
for(const patch of [{viewAz:-80},{viewEl:-40},{size:80},{margin:40},{drawing:'Silhouette'},{drawing:'Mesh edges'},{hidden:false},{every:4},{layer:11},{outline:false}])assert.deepEqual(evaluate(disk,patch)[2],original[2],'Preview controls never deform the mesh');
for(const patch of [{depth:10},{depth:80},{roundness:2},{back:'Flat'},{detail:30}])assert.notDeepEqual(evaluate(disk,patch)[2],original[2],'Sculpt controls change the mesh');
const planar=evaluate(disk,{depth:0});assert.equal(planar[2].dims[2],0);assert.ok(planar[0].paths.length);assert.deepEqual(evaluate(disk,{depth:0,back:'Flat',roundness:2})[2],planar[2]);
for(const depth of [.04,.1,1,150])for(const back of ['Flat','Inflated'])solid(evaluate(disk,{depth,back,detail:24})[2],`Thin body ${depth} ${back}`);
for(const input of [{},{paths:[]},{paths:[{...circle(),closed:false}]},{paths:[path([[0,0],[1,1],[2,2]])]},{paths:[path([[0,0],[1,0],[NaN,2]])]},{paths:[circle(1e-10)]},{paths:Array.from({length:30001},()=>path([[0,0],[1,0],[0,1]]))},{paths:[circle(50,100,100,120001)]}]){const q=evaluate(input,{inputShape:"Closed outlines"});assert.equal(q[2]?.tri||0,0,'Invalid or excessive closed input has no mesh');assert.deepEqual(q.slice(0,2).map(p=>p.paths.length),[0,0]);}
assert.deepEqual(N.compute([undefined],base,ctx),[{paths:[]},{paths:[]},null]);
for(const p of [{depth:NaN,detail:Infinity,layer:NaN},{depth:-100,viewAz:9999},{detail:72,depth:200,drawing:'Mesh edges',hidden:false},{margin:60,size:1000}])evaluate(ring,p,{W:100,H:100});
for(const c of [{W:0,H:200},{W:NaN,H:200},{W:200,H:Infinity},{}])assert.deepEqual(N.compute([disk],base,c),[{paths:[]},{paths:[]},null]);
const transparent=evaluate(disk,{drawing:'Mesh edges',hidden:false})[0],opaque=evaluate(disk,{drawing:'Mesh edges'})[0];
const ink=ps=>ps.paths.reduce((n,p)=>n+helpers.pathLength(p.pts,p.closed),0);
assert.ok(ink(opaque)<ink(transparent)*.8,'Hidden-line removal reduces actual drawn length; clipping can increase fragment count');
for(const mode of ['Dashed','Dots','Dash-dot']){const st={kind:'style',mode,dash:4,gap:1,vary:.2,phase:0,seed:7};const r=N.compute([disk,st],base,ctx);assert.deepEqual(r[2],original[2]);assert.ok(r[0].paths.length);assert.ok(r[0].paths.reduce((n,p)=>n+p.pts.length,0)<=90000);assert.ok(r[0].paths.flatMap(p=>p.pts).flat().every(Number.isFinite));checks++;}
const coat=Spikes.compute([donut],{...defaults(Spikes),body:'Wired mesh',count:120,size:120,length:20},ctx);assert.ok(coat.paths.length,'Actual 3D Spikes consumes Inflate mesh');
const slices=Slice.compute([undefined,donut],{...defaults(Slice),size:100,slices:8,step:1},ctx,{});assert.ok(slices.paths.length,'Actual Mesh Slice consumes Inflate mesh');
const rectangle=Container.compute([],{...defaults(Container),shape:'Rectangle',cx:148.5,cy:105,rw:120,rh:80,draw:true,regionPen:0},ctx);
const outer=Container.compute([],{...defaults(Container),shape:'Circle',cx:148.5,cy:105,cr:65,draw:true},ctx);
const inner=Container.compute([],{...defaults(Container),shape:'Circle',cx:148.5,cy:105,cr:27,draw:true},ctx);
const star=Superformula.compute([],{...defaults(Superformula),m:5,n1:2,n2:7,n3:7,rings:1},ctx);
for(const [name,input,patch] of [['Help pillow',rectangle,{}],['Help hole',{paths:[...outer.paths,...inner.paths]},{depth:36}],['Help spikes',star,{depth:35,detail:36}]])solid(evaluate(input,patch)[2],name);
assert.deepEqual(N.overlay(base,{W:0,H:200}),[]);assert.equal(N.overlay(base,ctx)[0].x,12);
console.log(`PASS [${useLab?'lab':'baked'}]: ${checks} Inflate cases; manifold winding/volume, holes, concavity, islands, flat back/sheet, immutable deterministic geometry, normalized mesh, camera separation, budgets/styles, actual Spikes and Mesh Slice.`);
