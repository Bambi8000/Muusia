import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { Pin, EMPTY, applyStyle } from "../src/defs/helpers.js";

const built = new URL("../src/defs/nodes/drawn_path.js", import.meta.url);
const lab = new URL("../nodes-lab/drawn_path.plotternode.js", import.meta.url);
const def = fs.existsSync(built)
  ? (await import(built.href + `?t=${Date.now()}`)).default
  : vm.runInNewContext(fs.readFileSync(lab, "utf8"), { Pin, EMPTY, applyStyle, Math, Number, Array });
const defaults = Object.fromEntries(def.params.map(p => [p.key, p.def]));
const run = (patch = {}, ctx = { W: 210, H: 297 }, style) => def.compute([style], { ...defaults, ...patch }, ctx);
let checks = 0;
const check = (test, label) => { assert.ok(test, label); checks++; };
const hash = result => JSON.stringify(result);
const length = result => result.paths[0].pts.reduce((sum, q, i, a) => i ? sum + Math.hypot(q[0] - a[i-1][0], q[1] - a[i-1][1]) : 0, 0);

check(def.key === "drawn_path" && def.ins[0].type === "style" && def.outs[0].type === "paths", "node contract");
check(def.params.find(p => p.key === "points")?.type === "drawpath", "editor parameter");
const open = run();
check(open.paths.length === 1 && !open.paths[0].closed, "default open path");
check(open.paths[0].pts.length > defaults.points.length, "curve is sampled");
check(open.paths[0].pts[0][0] === 12 + .1 * 186 && open.paths[0].pts.at(-1)[0] === 12 + .9 * 186, "open endpoints preserved");
check(hash(run()) === hash(open), "deterministic output");
check(hash(run({ smoothness: 0 })) !== hash(open), "smoothness changes geometry");
const shaky = Array.from({length:80}, (_,i) => [.05 + .9*i/79, i%2 ? .52 : .48]);
check(length(run({ points: shaky, smoothness: 100 })) < length(run({ points: shaky, smoothness: 0 })) * .55,
  "smoothness visibly filters a densely sampled freehand stroke");
check(hash(run({ smoothness: 0 }).paths[0].pts) === hash(run({ smoothness: -20 }).paths[0].pts), "smoothness clamps below zero");
check(hash(run({ margin: 20 })) !== hash(open), "margin changes placement");
check(run({ layer: 8 }).paths[0].layer === 8 && run({ layer: 99 }).paths[0].layer === 11, "pen index clamps");
const ring = run({ points: [[.2,.2],[.8,.2],[.8,.8],[.2,.8]], closed: true });
check(ring.paths.length === 1 && ring.paths[0].closed, "closed shape");
check(hash(ring.paths[0].pts[0]) !== hash(ring.paths[0].pts.at(-1)), "closed path omits repeated starting point");
check(run({ points: [[.1,.1]], closed: false }).paths.length === 0, "one point is empty");
check(run({ points: [[.1,.1],[.9,.9]], closed: true }).paths.length === 0, "two points cannot close");
check(run({ points: [[.1,.1],[NaN,.2],[.9,.9]] }).paths.length === 1, "invalid point is skipped");
check(run({ points: [[-1,2],[.8,.2]] }).paths[0].pts.every(([x,y]) => x>=12 && x<=198 && y>=12 && y<=285), "coordinates stay inside margin");
check(run({ points: [[.1,.1],[.1,.1],[.9,.9]] }).paths[0].pts.length > 2, "duplicate input points are ignored");
check(run({ points: [] }).paths.length === 0, "cleared editor is empty");
check(run({ points: [[.1,.1],[.9,.9]], margin: 50 }, { W: 80, H: 60 }).paths.length === 0, "collapsed drawing area is empty");
const dense = run({ points: Array.from({length:256}, (_,i) => [i%2 ? 1 : 0, i/255]), smoothness:100 }, {W:10000,H:10000});
check(dense.paths[0].pts.length <= 100001, "large canvas respects point budget");
check(dense.paths[0].pts.every(q => q.every(Number.isFinite) && q[0]>=12 && q[0]<=9988 && q[1]>=12 && q[1]<=9988), "large canvas remains finite and bounded");
const overlay = def.overlay(defaults, {W:210,H:297});
check(overlay.length === 1 && overlay[0].kind === "rect", "preview keeps the smoothed path unobscured");
check(def.overlay(defaults, {}).length === 0, "overlay tolerates invalid context");
check(run({}, {W: Infinity, H: 210}).paths.length === 0, "invalid sheet dimensions are rejected");
const styled = run({}, undefined, {kind:"style",mode:"Dashed",dash:3,gap:2,vary:0,phase:0,seed:1});
check(styled.paths.length > 1 && styled.paths.every(q => q.layer === 0), "Style input applies to path");
console.log(`${checks} Draw Path checks passed`);
