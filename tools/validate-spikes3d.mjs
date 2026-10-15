import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as helpers from '../src/defs/helpers.js';
import blob from '../src/defs/nodes/blobmesh.js';
const lab='nodes-lab/spikes3d.plotternode.js';
const useLab=!process.argv.includes('--baked')&&await fs.access(lab).then(()=>true,()=>false);
const N=useLab?Function(...Object.keys(helpers),'return '+await fs.readFile(lab,'utf8'))(...Object.values(helpers)):(await import('../src/defs/nodes/spikes3d.js')).default;
const base=Object.fromEntries(N.params.map(p=>[p.key,p.def]));
const ctx={W:210,H:297};let checks=0;
function verify(patch={},canvas=ctx,ins=[],node={}) {
  const p={...base,...patch},before=JSON.stringify({p,ins,node}),q=N.compute(ins,p,canvas,node);
  assert.deepEqual(q,N.compute(ins,p,canvas,node),'Repeatability');
  assert.equal(JSON.stringify({p,ins,node}),before,'Immutable inputs');
  const margin=Math.min(Number.isFinite(+p.margin)?Math.max(0,Math.min(60,+p.margin)):12,Math.min(canvas.W,canvas.H)/2-.001);
  assert.ok(q.paths.reduce((s,p)=>s+p.pts.length,0)<=115000,'Point budget');
  for(const path of q.paths) {
    assert.ok(path.pts.length>=2);assert.equal(path.closed,false);
    assert.ok(Number.isInteger(path.layer)&&path.layer>=0&&path.layer<12);
    for(const pt of path.pts){assert.equal(pt.length,2,'Projection never writes pressure Z');assert.ok(pt.every(Number.isFinite));const [x,y]=pt;assert.ok(x>=margin-1e-7&&x<=canvas.W-margin+1e-7&&y>=margin-1e-7&&y<=canvas.H-margin+1e-7,'Margin fit');}
  }
  checks++;return q;
}
for(const body of ['Capsule','Sphere','Torus','Cube'])for(const mode of ['Lines','Spikes','Straws'])for(const occlusion of [false,true])for(const host of ['None','Silhouette','Wireframe'])assert.ok(verify({body,mode,count:45,occlusion,host}).paths.length);
assert.equal(verify({count:0}).paths.length,0);assert.equal(verify({length:0}).paths.length,0);
for(const body of ['Capsule','Sphere','Torus','Cube'])assert.ok(verify({body,count:0,host:'Silhouette'}).paths.length);
const transparent=verify({occlusion:false});assert.equal(transparent.paths.length,1400);
assert.ok(verify().paths.length<transparent.paths.length,'Body hides back portions');
for(const patch of [{seed:42},{count:1450},{length:50},{variation:0},{spread:0},{viewAz:110},{viewEl:65},{normals:'Flip'}])assert.notDeepEqual(verify(patch),verify());
assert.deepEqual(verify({diameter:6,occlusion:false}),transparent,'Lines ignore diameter');
assert.deepEqual(verify({count:0,host:'Wireframe',seed:0,length:0,normals:'Flip',layer:7}),verify({count:0,host:'Wireframe',seed:99,length:90,normals:'As mesh',layer:2}),'Unused controls do not change host');
assert.deepEqual(verify({body:'Sphere',width:10,tube:10,smooth:false}),verify({body:'Sphere',width:90,tube:70,smooth:true}));
assert.deepEqual(verify({occlusion:false,detail:128}),verify({occlusion:false,detail:640}));
assert.ok(verify({layer:11,host:'Silhouette',hostPen:4}).paths.some(q=>q.layer===4));
assert.ok(verify({layer:11}).paths.every(q=>q.layer===11));
const bp=Object.fromEntries(blob.params.map(p=>[p.key,p.def]));
const mesh=blob.compute([],{...bp,balls:3,rings:14,segs:20,radZ:160},{W:210,H:297})[2];
assert.equal(mesh.kind,'mesh');assert.ok(verify({body:'Wired mesh',count:180},ctx,[mesh]).paths.length);
assert.notDeepEqual(verify({body:'Wired mesh',count:180,smooth:false},ctx,[mesh]),verify({body:'Wired mesh',count:180,smooth:true},ctx,[mesh]));
for(const bad of [null,helpers.EMPTY,{kind:'mesh',tri:1,v:[0,0]},{kind:'mesh',tri:1,v:Array(9).fill(NaN)},{kind:'mesh',tri:1,v:Array(9).fill(0)},{kind:'mesh',tri:120001,v:[]}])assert.equal(verify({body:'Wired mesh'},ctx,[bad]).paths.length,0);
// Planar triangles: roots stay on the face; normal growth is exactly projected +Z.
const plane={kind:'mesh',tri:1,v:[-1,-.5,0,1,-.5,0,0,.5,0],dims:[1,.5,0]};
const flat=verify({body:'Wired mesh',size:100,count:200,length:10,variation:0,spread:0,viewAz:0,viewEl:0,occlusion:false,smooth:false,normals:'As mesh'},{W:500,H:500},[plane]);
assert.equal(flat.paths.length,200);for(const q of flat.paths){assert.ok(Math.abs(q.pts[1][0]-q.pts[0][0])<1e-7);assert.ok(Math.abs(q.pts[1][1]-q.pts[0][1]+10)<1e-7);}
// Two disconnected triangles, 4:1 area: equal face counts must not mean equal density.
const uneven={kind:'mesh',tri:2,v:[-4,0,0,-2,0,0,-4,2,0,2,0,0,3,0,0,2,1,0],dims:[1,1,0]};
const samples=verify({body:'Wired mesh',size:150,count:4000,length:3,variation:0,spread:0,viewAz:0,viewEl:0,occlusion:false},{W:500,H:500},[uneven]).paths.map(p=>p.pts[0][0]).sort((a,b)=>a-b);
let gap=0,split=0;for(let i=1;i<samples.length;i++)if(samples[i]-samples[i-1]>gap){gap=samples[i]-samples[i-1];split=i;}
assert.ok(split/samples.length>.77&&split/samples.length<.83,'Area-weighted 80/20 distribution');
// STL intake uses the actual file API, including normalized equivalence with wires.
const ascii='solid surface\nfacet normal 0 0 1\nouter loop\nvertex -1 -0.5 0\nvertex 1 -0.5 0\nvertex 0 0.5 0\nendloop\nendfacet\nendsolid';
const binary=Buffer.alloc(134);binary.writeUInt32LE(1,80);plane.v.forEach((n,k)=>binary.writeFloatLE(n,96+4*k));
const importedA=N.onFile('data:application/octet-stream;base64,'+Buffer.from(ascii).toString('base64'));
const importedB=N.onFile('data:application/octet-stream;base64,'+binary.toString('base64'));
assert.deepEqual(importedA,importedB);
const imported=verify({body:'Imported STL',count:80},ctx,[],{data:{svg:importedA}});
assert.deepEqual(imported,verify({body:'Wired mesh',count:80},ctx,[importedA]));
assert.equal(verify({body:'Imported STL'}).paths.length,0);
for(const bad of ['garbage','data:application/octet-stream;base64,'+Buffer.from('solid bad\nvertex 0 0 0\nendsolid').toString('base64')])assert.throws(()=>N.onFile(bad));
assert.ok(N.params.some(p=>p.type==='file'));assert.equal(N.fileBinary,true);
for(const mode of ['Lines','Spikes','Straws'])verify({mode,count:5000,length:1000,diameter:100,margin:60,spread:89,viewEl:-89},{W:420,H:594});
const denseSpikes=verify({mode:'Spikes',count:5000,occlusion:false},{W:420,H:594});
assert.ok(denseSpikes.paths.some(p=>Math.hypot(p.pts[1][0]-p.pts[0][0],p.pts[1][1]-p.pts[0][1])>10),'Dense cones retain axes, not just base rings');
verify({count:Infinity,size:NaN,length:-100,viewEl:NaN,margin:Infinity,layer:NaN});
verify({count:50,margin:60},{W:10,H:10});
for(const c of [{W:0,H:210},{W:NaN,H:200},{W:200,H:Infinity},{}])assert.deepEqual(N.compute([],base,c),helpers.EMPTY);
const styled={kind:'style',mode:'Dashed',dash:.2,gap:.2,vary:.1,phase:0,seed:4};verify({mode:'Straws',count:800},ctx,[null,styled]);
for(const mode of ['Dashed','Dots','Dash-dot'])verify({mode:'Straws',count:1000,length:300,occlusion:false},{W:420,H:594},[null,{...styled,mode,dash:100,gap:.1,vary:1}]);
verify({count:3,margin:60},{W:.0001,H:.0001});
assert.equal(N.overlay(base,ctx)[0].w,186);assert.deepEqual(N.overlay(base,{W:0,H:200}),[]);
console.log(`PASS [${useLab?'lab':'baked'}]: ${checks} 3D Spikes cases; four bodies, three marks, surface-normal growth, area sampling, actual Blob Mesh and ASCII/binary STL, host occlusion, cameras, mode controls, pens, determinism, immutable inputs, margin fit and point budget.`);
