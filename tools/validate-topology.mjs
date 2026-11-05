import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { Pin, EMPTY, applyStyle } from "../src/defs/helpers.js";
import meshRender from "../src/defs/nodes/mesh_render.js";
import meshSlice from "../src/defs/nodes/meshslice.js";

const built = new URL("../src/defs/nodes/topology.js", import.meta.url);
const lab = new URL("../nodes-lab/topology.plotternode.js", import.meta.url);
const def = fs.existsSync(built)
  ? (await import(built.href + `?t=${Date.now()}`)).default
  : vm.runInNewContext(fs.readFileSync(lab, "utf8"), { Pin, EMPTY, applyStyle, Math, Number, Array });
const defaults = Object.fromEntries(def.params.map(p => [p.key, p.def]));
const run = (patch = {}, ctx = { W: 210, H: 210 }) => def.compute([undefined], { ...defaults, ...patch }, ctx);
let checks = 0;
const check = (test, message) => { assert.ok(test, message); checks++; };
function meshBoundary(mesh) {
  const counts = new Map();
  const point = k => mesh.v.slice(k, k+3).join(",");
  for (let t=0;t<mesh.tri;t++) {
    const vertices=[point(t*9),point(t*9+3),point(t*9+6)];
    for (let e=0;e<3;e++) {
      const key=[vertices[e],vertices[(e+1)%3]].sort().join("|");
      counts.set(key,(counts.get(key)||0)+1);
    }
  }
  const edges=[...counts].filter(([,n])=>n===1).map(([key])=>key.split("|"));
  const adjacency=new Map();
  for (const [a,b] of edges) {
    if (!adjacency.has(a)) adjacency.set(a,[]);
    if (!adjacency.has(b)) adjacency.set(b,[]);
    adjacency.get(a).push(b); adjacency.get(b).push(a);
  }
  const seen=new Set(); let loops=0;
  for (const start of adjacency.keys()) {
    if (seen.has(start)) continue;
    loops++; const todo=[start];
    while (todo.length) {
      const a=todo.pop(); if (seen.has(a)) continue;
      seen.add(a); todo.push(...adjacency.get(a));
    }
  }
  return { edges:edges.length, loops };
}

check(def.key === "topology" && def.outs.length === 3, "built-in contract");
const shapes = ["Mobius strip", "Cylinder band", "Torus", "Klein bottle", "Trefoil tube", "Hopf link"];
for (const shape of shapes) {
  const [draw, edge, mesh] = run({ shape });
  check(draw.paths.length > 0, `${shape}: drawing exists`);
  check(edge.paths.length === (shape === "Mobius strip" ? 1 : shape === "Cylinder band" ? 2 : 0), `${shape}: boundary count`);
  check(mesh?.kind === "mesh" && mesh.tri > 0 && mesh.v.length === mesh.tri * 9, `${shape}: mesh contract`);
  check(mesh.tri <= 120000 && draw.paths.reduce((n,q)=>n+q.pts.length,0) < 120000, `${shape}: budget`);
  check(mesh.v.every(Number.isFinite) && mesh.dims.every(Number.isFinite), `${shape}: finite mesh`);
  check(Math.max(...mesh.dims) === 1 && mesh.dims.every(v=>v>=0 && v<=1), `${shape}: normalized dimensions`);
  check(draw.paths.every(q => q.layer >= 0 && q.layer <= 11 && q.pts.length >= 2 && q.pts.every(pt => pt.every(Number.isFinite) && pt[0]>=10-1e-6 && pt[0]<=200+1e-6 && pt[1]>=10-1e-6 && pt[1]<=200+1e-6)), `${shape}: bounded drawing`);
  check(edge.paths.every(q=>q.closed && q.layer === defaults.edgeLayer), `${shape}: closed marked boundary`);
  check(JSON.stringify(run({ shape })) === JSON.stringify([draw,edge,mesh]), `${shape}: deterministic`);
  const boundaryMesh=meshBoundary(mesh);
  check(boundaryMesh.loops === (shape === "Mobius strip" ? 1 : shape === "Cylinder band" ? 2 : 0), `${shape}: actual mesh boundary topology`);
}
const [mobDraw,mobEdge,mobMesh] = run();
check(mobEdge.paths[0].pts.length === defaults.segments*2, "Mobius has a single 2U edge loop");
check(mobMesh.tri === defaults.segments*defaults.cross*2, "Mobius triangle grid");
for (const halfTwists of [1,3,5]) check(meshBoundary(run({halfTwists})[2]).loops===1, `${halfTwists} half twists keep one boundary`);
check(JSON.stringify(run({halfTwists:3})[2].v) !== JSON.stringify(mobMesh.v), "twist control changes mesh");
check(JSON.stringify(run({hand:"Left"})[2].v) !== JSON.stringify(mobMesh.v), "handedness changes mesh");
check(JSON.stringify(run({band:90})[2].v) !== JSON.stringify(mobMesh.v), "band width changes mesh");
check(JSON.stringify(run({shape:"Torus",tube:30})[2].v) !== JSON.stringify(run({shape:"Torus"})[2].v), "tube width changes mesh");
check(JSON.stringify(run({viewAz:90})[2].v) === JSON.stringify(mobMesh.v), "camera leaves 3D mesh unchanged");
check(JSON.stringify(run({viewAz:90})[0].paths) !== JSON.stringify(mobDraw.paths), "camera moves drawing");
check(JSON.stringify(run({size:100})[2].v) === JSON.stringify(mobMesh.v), "preview size leaves 3D mesh unchanged");
check(run({wireEvery:4})[0].paths.length < mobDraw.paths.length, "wire thinning changes drawing");
check(run({layer:5,edgeLayer:8})[0].paths.some(q=>q.layer===5) && run({layer:5,edgeLayer:8})[1].paths.every(q=>q.layer===8), "pens assigned");
check(run({}, {W:15,H:15})[2] === null, "too-small sheet is empty");
const high = run({shape:"Hopf link",segments:120,cross:40,wireEvery:1});
check(high[2].tri === 120*40*4 && high[0].paths.reduce((n,q)=>n+q.pts.length,0)<120000, "maximum detail remains bounded");
const klein = run({shape:"Klein bottle"})[2];
check(klein.tri === defaults.segments*defaults.cross*2, "Klein closed grid");
const renderParams=Object.fromEntries(meshRender.params.map(q=>[q.key,q.def]));
const rendered=meshRender.compute([mobMesh,undefined],{...renderParams,drawing:"Edges",detail:40,shadow:false},{W:210,H:210});
check(rendered[0].paths.length>0 && rendered[1]===mobMesh, "Mesh Render accepts and passes through Mobius mesh");
const sliceParams=Object.fromEntries(meshSlice.params.map(q=>[q.key,q.def]));
const torusSlice=meshSlice.compute([undefined,run({shape:"Torus"})[2]],{...sliceParams,mode:"Single slice",slice:12,slices:24,size:120,step:1},{W:297,H:210});
check(torusSlice.paths.length===2 && torusSlice.paths.every(q=>q.closed), "Mesh Slice cuts a closed torus cross-section");
console.log(`${checks} Topology checks passed`);
