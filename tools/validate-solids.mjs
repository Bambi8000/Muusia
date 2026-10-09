// Regression: sphere rings must stay continuous across their sampled array seam.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import solids from '../src/defs/nodes/solids.js';

const defaults=Object.fromEntries(solids.params.map(p=>[p.key,p.def]));
const params={...defaults,size:76,rx:27,ry:87,rz:12,px:70,py:70};
const compute=p=>solids.compute([],p,{W:140,H:140});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baselines={
  Sphere:'54a06806379fd869b0428d899cd005102f79ea63cd82e746b9903a5077953f2a',
  Cube:'bdf05dfe2d16da3a3d5dc49d781d0cf98da11236d88472e57a93dd9e8546bd66',
  Tetrahedron:'a34543e290c2f0bf68c9858c6dfe42427d875cae9b7efc92db9274f2e4e5f364',
  Octahedron:'ff410928b0466fe6b5f2d8b698801224435388ba810005d1a7a2d66ec2bbff6f',
  Icosahedron:'47ed48d51f02659cb0a146cbb8a1eea63b818b0bc980e9592420fc7e49e507a2',
  Dodecahedron:'4d56b12dc9f2b0d4869f6c68b480bf46d2727d7feaae45487e2a87776a40bb0d',
};
for(const [shape,expected] of Object.entries(baselines)) {
  const p={...params,shape,sstyle:'Transparent'};
  assert.equal(hash(compute(p)),expected,`${shape}: unaffected geometry matches pre-fix capture`);
  if(shape!=='Sphere') assert.deepEqual(compute({...p,sstyle:'Solid (hide back)'}),compute(p));
}

let samples=0;
function check(p) {
  const result=compute(p),r=p.size/2;
  assert.ok(result.paths.length>0 && result.paths.length<=p.lat-1+p.lon,'one visible arc per circular ring');
  // Every open end belongs at the visibility rim. Chords between 5-degree
  // samples lie between the inscribed radius and the exact sphere radius.
  const camera=r*(6-4.8*p.persp),scale=p.persp>0?camera/(camera+.02*r):1;
  const lo=r*Math.sqrt(Math.cos(Math.PI/72)**2-.02**2)*scale-1e-8;
  const hi=r*Math.sqrt(1-.02**2)*scale+1e-8;
  for(const path of result.paths) {
    assert.equal(path.layer,p.layer);
    assert.ok(path.pts.length>=2&&path.pts.length<=74);
    for(const pt of path.pts) assert.ok(pt.length===2&&pt.every(Number.isFinite));
    if(!path.closed) for(const [x,y] of [path.pts[0],path.pts.at(-1)]) {
      const radius=Math.hypot(x-p.px,y-p.py);
      assert.ok(radius>=lo&&radius<=hi,`interior seam at rotation ${p.rx}/${p.ry}/${p.rz}: radius ${radius}`);
    }
  }
  samples++;
  return result;
}
// Reported 08/36 frame plus complete supported plotting loops and perspective.
const reported=check({...params,persp:0});
assert.deepEqual(reported,compute({...params,persp:0}),'deterministic');
for(const N of [24,36,48]) for(const persp of [0,.4,1]) for(let f=0;f<N;f++)
  check({...params,ry:17+360*f/N,persp});
for(const rx of [-180,-90,0,90,180]) for(const ry of [-180,-90,0,90,180])
  check({...params,rx,ry,rz:0,lat:24,lon:24,size:250,persp:0,layer:3});
const transparent=compute({...params,sstyle:'Transparent'});
assert.equal(transparent.paths.length,params.lat-1+params.lon);
assert.ok(transparent.paths.every(p=>p.closed&&p.pts.length===72));
console.log(`Solids: ${samples} sphere views have continuous visible arcs; six pre-fix geometry baselines preserved.`);
