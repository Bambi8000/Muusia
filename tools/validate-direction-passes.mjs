import assert from "node:assert/strict";
import fs from "node:fs";
import * as H from "../src/defs/helpers.js";
import { directionPassFiles } from "../src/direction-pass-export.js";
import { cropTestPiece } from "../src/preview-crop.js";
import { EXAMPLES } from "../src/examples.js";
import grid from "../src/defs/nodes/grid.js";
import move from "../src/defs/nodes/move_scale.js";
import array from "../src/defs/nodes/array.js";

const baked = new URL("../src/defs/nodes/direction_passes.js", import.meta.url);
const raw = new URL("../nodes-lab/direction_passes.plotternode.js", import.meta.url);
const N = fs.existsSync(baked) ? (await import(baked.href)).default
  : new Function(...Object.keys(H), `return ${fs.readFileSync(raw, "utf8")}`)(...Object.values(H));
const params = { tolerance: .1, preview: "All" };
const path = (pts, extra = {}) => ({ pts, closed: false, layer: 0, ...extra });
const compute = (paths, p = {}) => N.compute([{ paths }], { ...params, ...p });
const edges = paths => paths.flatMap(p => {
  const points = p.closed ? [...p.pts, p.pts[0]] : p.pts;
  return points.slice(1).map((b, i) => JSON.stringify([points[i], b, p.layer]));
}).sort();
const partition = (src, p = {}) => {
  const before = JSON.stringify(src), out = compute(src, p);
  assert.deepEqual(edges(out.slice(1).flatMap(o => o.paths)), edges(src), "Every directed segment is retained exactly once, with its pen and depth");
  assert.equal(JSON.stringify(src), before, "Source is immutable");
  assert.deepEqual(compute(src, p), out, "Deterministic");
  return out;
};

assert.equal(N.key, "direction_passes");
assert.equal(N.cat, "mod");
assert.equal(N.ins[0].type, "paths");
assert.equal(N.outs.length, 4);
assert.ok(N.outs.every(pin => pin.type === "paths"));
assert.deepEqual(N.compute([undefined], params).map(o => o.paths), [[], [], [], []]);
const source = [
  path([[10, 20], [50, 20]], { layer: 3 }),
  path([[30, 80], [30, 10]], { layer: 7 }),
  path([[5, 5], [20, 20]], { layer: 1 }),
  path([[0, 0], [100, 0], [100, 80], [0, 80]], { closed: true, layer: 11 }),
];
const out = partition(source);
assert.deepEqual(out.slice(1).map(o => o.paths.length), [3, 3, 1]);
assert.deepEqual(out[0].paths, source);
for (const [mode, port] of [["Horizontal", 1], ["Vertical", 2], ["Other", 3]]) {
  const selected = compute(source, { preview: mode });
  assert.deepEqual(selected[0], out[port]);
  assert.deepEqual(selected.slice(1), out.slice(1), "Preview selection never solos the exported passes");
}
assert.deepEqual(compute(source, { preview: "Unknown" })[0], out[0]);

// Top-edge seam of a rectangle is one continuous stroke, not two.
const seam = partition([path([[50, 0], [100, 0], [100, 80], [0, 80], [0, 0]], { closed: true, __stop: { mode: "Pause", msg: "refill" } })]);
assert.equal(seam[1].paths.length, 2);
assert.deepEqual(seam[1].paths[0].pts, [[0, 0], [50, 0], [100, 0]]);
assert.equal(seam.slice(1).flatMap(o => o.paths).filter(p => p.__stop).length, 1);
assert.ok(seam.slice(1).flatMap(o => o.paths).every(p => !p.closed));
const diamond = path([[50, 0], [100, 50], [50, 100], [0, 50]], { closed: true });
assert.deepEqual(partition([diamond])[3].paths, [diamond]);
const depth = path([[0, 0, 1], [0, 0, 2], [100, 0, -1], [100, 0, 3], [100, 100, .5]]);
partition([depth]);
partition([path([[1, 2, 1], [1, 2, 2]])]);
const tilted = path([[0, 0], [100, 1]]);
assert.equal(partition([tilted], { tolerance: 0 })[3].paths.length, 1);
assert.deepEqual(partition([tilted], { tolerance: 1 })[1].paths[0].pts, tilted.pts, "Tolerance classifies without straightening");
for (const tolerance of [-99, 999, NaN, Infinity]) partition(source, { tolerance });
const rng = H.mulberry32(931);
for (let trial = 0; trial < 250; trial++) {
  const points = [[rng() * 100, rng() * 100]];
  for (let i = 0; i < 35; i++) {
    const last = points.at(-1), axis = Math.floor(rng() * 3), amount = (rng() - .5) * 20;
    points.push([last[0] + (axis !== 1 ? amount : 0), last[1] + (axis !== 0 ? amount : 0)]);
  }
  partition([path(points, { closed: trial % 2 === 0, layer: trial % 12 })]);
}

const contexts = [], jobs = directionPassFiles(out, { W: 594, H: 420 }, (ps, ctx) => {
  contexts.push(ctx); return JSON.stringify(ps);
});
assert.deepEqual(jobs.filter(f => f.pass).map(f => f.name), ["01-horizontal.gcode", "02-vertical.gcode", "03-other.gcode"]);
assert.ok(contexts.every(ctx => ctx.W === 594 && ctx.H === 420));
const manifest = JSON.parse(jobs.find(f => f.name === "manifest.json").text);
assert.deepEqual(manifest.canvasMm, { W: 594, H: 420 });
assert.deepEqual(manifest.passes.map(p => p.paths), [3, 3, 1]);
assert.match(jobs.find(f => f.name === "README.txt").text, /turn the tool manually 90 degrees/);
const vertical = compute([source[1]]);
const one = directionPassFiles(vertical, { W: 594, H: 420 }, () => "G21");
assert.deepEqual(one.filter(f => f.pass).map(f => f.name), ["02-vertical.gcode"]);
assert.equal(JSON.parse(one.at(-1).text).passes[0].file, null);
const sample = directionPassFiles(out, { W: 210, H: 297 }, ps => JSON.stringify(ps), ps => cropTestPiece(ps, { x: 0, y: 0, w: 210, h: 297, margin: 10 }));
assert.deepEqual(JSON.parse(sample.at(-1).text).canvasMm, { W: 210, H: 297 });
assert.equal(directionPassFiles([], { W: 594, H: 420 }, () => "").filter(f => f.pass).length, 0);
const defs = { grid, move_scale: move, array, direction_passes: N };
const starter = EXAMPLES.find(ex => ex.name === "Direction Passes · Grid islands");
const graph = starter.make(type => Object.fromEntries(defs[type].params.map(p => [p.key, p.def])));
const results = {};
for (const node of graph.nodes) {
  const def = defs[node.type], ins = def.ins.map((_, port) => {
    const edge = graph.edges.find(e => e.to === node.id && e.toPort === port);
    return edge ? results[edge.from][edge.fromPort] : undefined;
  });
  const result = def.compute(ins, node.params, starter.canvas);
  results[node.id] = Array.isArray(result) ? result : [result];
}
const exampleOutput = results[9004];
assert.deepEqual(exampleOutput.slice(1).map(o => o.paths.length), [49, 63, 0]);
assert.deepEqual(edges(exampleOutput.slice(1).flatMap(o => o.paths)), edges(results[9003][0].paths));
for (const p of exampleOutput[0].paths) for (const [x, y] of p.pts) {
  assert.ok(Number.isFinite(x) && Number.isFinite(y));
  assert.ok(x >= 0 && x <= starter.canvas.W && y >= 0 && y <= starter.canvas.H);
}
console.log(`PASS (${fs.existsSync(baked) ? "baked" : "lab"}): 250 segment-conservation trials, axis routing, closed seams, depth, markers, immutable source, preview independence, phase files and sample coordinates.`);
