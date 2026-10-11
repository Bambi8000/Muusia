import assert from 'node:assert/strict';
import def from '../src/defs/nodes/murmuration.js';
import { renderMurmurationScene } from '../src/murmuration-scene.js';
const defaults = Object.fromEntries(def.params.map(p => [p.key, p.def]));
const ctx = { W: 297, H: 210, frameCount: 48 };
const compute = (p, f = 0, ins = []) => def.compute(ins, { ...defaults, birds: 80, spread: 30, ...p }, { ...ctx, frameIdx: f });
const mono = ps => ps.paths.map(path => ({ ...path, layer: 0 }));
const center = p => p.pts.reduce((s,q) => [s[0]+q[0]/p.pts.length,s[1]+q[1]/p.pts.length], [0,0]);
let checked = 0;
for (const behaviour of ['Bird flock', 'Reindeer herd']) for (const shape of ['Dash', 'Chevron', 'Dot']) for (const camera of ['Fixed','Follow group','Follow animal']) {
  const p = { behaviour, shape, herdMark: shape === 'Dot' ? 'Circle' : 'Dash', camera, ground: 'Sparse dots', highlight: 'On', animal: 17, highlightPen: 2, trail: behaviour === 'Bird flock' ? 8 : 0 };
  for(let f=0;f<48;f++) {
    const o = compute({...p,time:f/48},f), base = compute({...p,highlight:'Off',time:f/48},f);
    assert.deepEqual(mono(o),mono(base),'highlight affects only ink, never geometry');
    for(const path of o.paths) {
      assert.ok([0,2].includes(path.layer));
      for(const q of path.pts) assert.ok(q.every(Number.isFinite) && q[0]>=10-1e-8 && q[0]<=287+1e-8 && q[1]>=10-1e-8 && q[1]<=200+1e-8,'clipped to page window');
    }
    if(camera==='Follow animal') {
      const h=o.paths.filter(p=>p.layer===2).at(-1);assert.ok(h,'tracked animal stays visible');
      const c=center(h);assert.ok(Math.hypot(c[0]-148.5,c[1]-105)<4,'camera follows selected glyph');
    }
    checked++;
  }
  assert.deepEqual(compute({...p,time:0},0),compute({...p,time:1},48),'camera+ground seam closes exactly');
}
// Tracking survives styling, where one source path becomes several strokes.
const style={kind:'style',mode:'Dashed',dash:.3,gap:.2,vary:.1,seed:2};
for(const behaviour of ['Bird flock','Reindeer herd']) {
 const p={behaviour,highlight:'On',animal:17,camera:'Follow animal',size:6,trail:8};
 const o=compute(p,5,[style]);assert.ok(o.paths.filter(p=>p.layer===2).length>1);
 assert.deepEqual(mono(o),mono(compute({...p,highlight:'Off'},5,[style])));
 for(const animal of [0,-1,999,Infinity,NaN]) assert.deepEqual(compute({...p,animal,highlight:'On'}),compute({...p,animal,highlight:'Off'}),'missing ID is not another animal');
}
// Same world marks translate exactly opposite to camera; no frame randomisation.
const scene={ground:'Sparse dots',groundSpacing:14,camera:'Follow group',margin:10,seed:3,layer:0};
const a=renderMurmurationScene({paths:[]},scene,ctx,[0,0]).paths;
const b=renderMurmurationScene({paths:[]},scene,ctx,[3,4]).paths;
let same=0;
for(const p of a) if(b.some(q=>Math.hypot(q.pts[0][0]-(p.pts[0][0]-3),q.pts[0][1]-(p.pts[0][1]-4))<1e-8)) same++;
assert.ok(same>a.length*.8,'world-fixed marks, not a fresh field');
const stationary=compute({behaviour:'Reindeer herd',camera:'Follow group',ground:'Off'});
const later=compute({behaviour:'Reindeer herd',camera:'Follow group',ground:'Off'},17);
for(const o of [stationary,later]) {
 const centre=o.paths.map(center).reduce((s,q)=>[s[0]+q[0]/80,s[1]+q[1]/80],[0,0]);
 assert.ok(Math.hypot(centre[0]-148.5,centre[1]-105)<1e-8,'group stays centred');
}
console.log(`Murmuration tracking/camera: ${checked} frames; stable IDs, style/trails, fixed world ground, bounds and exact loop closure pass.`);
