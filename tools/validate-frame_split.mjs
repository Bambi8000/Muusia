/* Validator for the Frame Split node.
   Run from the repo root: node tools/validate-frame_split.mjs
   First line tells you which source was tested — read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "frame_split";

const bakedPath = resolve("src/defs/nodes/" + KEY + ".js");
const labPath = resolve("nodes-lab/" + KEY + ".plotternode.js");
let def, mode;
if (existsSync(bakedPath)) {
  def = (await import(pathToFileURL(bakedPath).href)).default;
  mode = "[baked]";
} else {
  const src = readFileSync(labPath, "utf8");
  const names = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample",
    "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  def = new Function(...names, '"use strict"; return (' + src + ");")(...names.map((n) => H[n]));
  mode = "[lab]";
}
console.log(mode, def.key, "-", def.name);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };
const near = (a, b, t) => Math.abs(a - b) < (t || 1e-9);

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const CTX = { W: 420, H: 297 };
const run = (p, src) => def.compute.call(def, [src], p, CTX, { params: p });
const flat = (outs) => outs.flatMap((o) => o.paths);
const npts = (outs) => flat(outs).reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (outs) => flat(outs).every((q) => q.pts.every((pt) => pt.every((v) => Number.isFinite(v))));

const p0 = defaults();
const LINE = { paths: [{ pts: [[0, 0], [100, 0]], closed: false, layer: 3 }] };
const MIX = { paths: [
  { pts: [[0, 0], [100, 0]], closed: false, layer: 3 },
  { pts: [[10, 10], [20, 10], [20, 20], [10, 20]], closed: true, layer: 5 },
  { pts: [[0, 50, 0], [10, 50, 2]], closed: false, layer: 1 },
] };

/* --- universal invariants --- */
const r1 = run(p0, MIX), r2 = run(p0, MIX);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(Array.isArray(r1) && r1.length === p0.count, "returns one path set per output (" + r1.length + ")");
ok(npts(r1) > 0 && finiteAll(r1), "non-empty and finite at defaults (" + npts(r1) + " pts)");
ok(flat(r1).every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(flat(r1).every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");

/* outs pin list follows count */
ok(def.outs({ params: { count: 2 } }).length === 2 && def.outs({ params: { count: 16 } }).length === 16 &&
   def.outs({ params: {} }).length === 6 && def.outs(null).length === 6,
  "dynamic outs: 2..16, default 6, null-node safe");
ok(run({ ...p0, count: 16 }, MIX).length === 16, "compute count matches outs count at 16");

/* --- ink-length oracle: 100 mm line, 4 frames --- */
const pW = { ...p0, count: 4, by: "Ink length", mode: "Windows", ease: "Linear", dir: "Forward" };
const w4 = run(pW, LINE);
for (let k = 0; k < 4; k++) {
  const q = w4[k].paths[0];
  ok(q && q.pts.length === 2 &&
     near(q.pts[0][0], 25 * k) && near(q.pts[1][0], 25 * (k + 1)) &&
     near(q.pts[0][1], 0) && q.layer === 3 && !q.closed,
    "Windows frame " + (k + 1) + " = exactly [" + 25 * k + "," + 25 * (k + 1) + "] mm");
}
const b4 = run({ ...pW, mode: "Build-up" }, LINE);
ok(b4[2].paths[0].pts.length === 2 && near(b4[2].paths[0].pts[1][0], 75), "Build-up frame 3 ends at 75 mm");
ok(JSON.stringify(b4[3].paths) === JSON.stringify(LINE.paths.map((q) => ({ ...q }))),
  "Build-up last frame is the complete drawing, byte-identical geometry");

/* z interpolation through a cut */
const zc = run({ ...pW, count: 2 }, { paths: [{ pts: [[0, 0, 0], [10, 0, 2]], closed: false, layer: 0 }] });
ok(near(zc[0].paths[0].pts[1][2], 1) && near(zc[1].paths[0].pts[0][2], 1),
  "z interpolates through the cut (z=1 at midpoint)");

/* closed path: partial cut opens, full inclusion stays closed */
const SQ = { paths: [{ pts: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true, layer: 2 }] };
const sqW = run({ ...pW, count: 2 }, SQ);
ok(sqW[0].paths[0].closed === false && sqW[1].paths[0].closed === false,
  "partial cuts of a closed path emit open");
const sqSum = sqW.reduce((a, o) => a + o.paths.reduce((b, q) => b + H.pathLength(q.pts, false), 0), 0);
ok(near(sqSum, 40, 1e-6), "cut halves of the square sum to the full 40 mm perimeter");
const sqB = run({ ...pW, mode: "Build-up", count: 2 }, SQ);
ok(sqB[1].paths[0].closed === true, "fully included closed path stays closed");

/* windows tile the ink exactly: total length preserved, no overlap */
const wSum = w4.reduce((a, o) => a + o.paths.reduce((b, q) => b + H.pathLength(q.pts, q.closed), 0), 0);
ok(near(wSum, 100, 1e-6), "Windows frames tile the total ink length exactly");

/* --- ease --- */
const eIn = run({ ...pW, ease: "Ease in" }, LINE);
ok(eIn[0].paths[0].pts[1][0] < 25 - 1e-6, "Ease in: first frame shorter than linear");
const eB = run({ ...pW, ease: "Ease in-out", mode: "Build-up" }, LINE);
ok(near(eB[3].paths[0].pts[1][0], 100), "eased Build-up still completes at 100%");
for (const e of ["Linear", "Ease in-out", "Ease in", "Ease out"]) {
  const r = run({ ...pW, ease: e }, LINE);
  const ends = r.map((o) => o.paths.length ? o.paths[o.paths.length - 1].pts.slice(-1)[0][0] : 0);
  ok(ends.every((v, i) => i === 0 || v > ends[i - 1] - 1e-9), "ease '" + e + "' boundaries monotonic");
}

/* --- direction --- */
const rv = run({ ...pW, dir: "Reverse", mode: "Build-up" }, LINE);
ok(near(rv[0].paths[0].pts[0][0], 100) && near(rv[0].paths[0].pts[1][0], 75),
  "Reverse Build-up frame 1 un-draws from the far end");
ok(near(rv[3].paths[0].pts[0][0], 100) && near(rv[3].paths[0].pts[1][0], 0),
  "Reverse Build-up last frame is the whole line, reversed");

/* --- path count mode --- */
const P8 = { paths: Array.from({ length: 8 }, (_, i) => ({
  pts: [[i * 10, 0], [i * 10, 5]], closed: false, layer: i % 12 })) };
const pc = run({ ...p0, count: 4, by: "Path count", mode: "Windows", ease: "Linear" }, P8);
ok(pc.every((o) => o.paths.length === 2), "Path count Windows: 8 paths -> 2 per frame");
ok(JSON.stringify(pc.flatMap((o) => o.paths)) === JSON.stringify(P8.paths),
  "Path count passes geometry through as exact copies, in order");
const pcB = run({ ...p0, count: 4, by: "Path count", mode: "Build-up" }, P8);
ok(pcB[0].paths.length === 2 && pcB[3].paths.length === 8, "Path count Build-up accumulates 2,4,6,8");

/* --- inputs never mutated --- */
const frozen = JSON.parse(JSON.stringify(MIX));
const snap = JSON.stringify(frozen);
Object.freeze(frozen); frozen.paths.forEach((q) => { Object.freeze(q); Object.freeze(q.pts); q.pts.forEach((pt) => Object.freeze(pt)); });
run(p0, frozen); run({ ...p0, dir: "Reverse" }, frozen); run({ ...p0, by: "Path count" }, frozen);
ok(JSON.stringify(frozen) === snap, "inputs never mutated (deep-frozen, both modes + Reverse)");
/* outputs must not alias input arrays */
const alias = run(p0, MIX);
ok(flat(alias).every((q) => q.pts !== MIX.paths[0].pts && q.pts.every((pt) => MIX.paths.every((s) => s.pts.every((ip) => ip !== pt)))),
  "outputs share no point arrays with the input");

/* --- every parameter must do something --- */
const bJ = JSON.stringify(run(p0, MIX));
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch }, MIX)) !== bJ, "param live: " + label);
diff({ count: 3 }, "count");
diff({ by: "Path count" }, "by");
diff({ mode: "Windows" }, "mode");
diff({ ease: "Ease in-out" }, "ease");
diff({ dir: "Reverse" }, "dir");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt }, MIX);
    ok(npts(r) > 0 && finiteAll(r), pd.key + " '" + opt + "' produces finite frames (" + npts(r) + " pts)");
  }
}

/* --- degenerate and extreme values --- */
const rE = run(p0, undefined);
ok(Array.isArray(rE) && rE.length === p0.count && rE.every((o) => o.paths.length === 0), "unwired input: empty frames, no throw");
ok(finiteAll(run(p0, { paths: [] })), "empty path list: no NaN");
const dot = { paths: [{ pts: [[5, 5], [5, 5]], closed: false, layer: 0 }] };
ok(finiteAll(run(p0, dot)) && finiteAll(run({ ...p0, mode: "Windows" }, dot)), "zero-length path: no NaN");
const heavy = { paths: Array.from({ length: 40 }, (_, i) => ({
  pts: Array.from({ length: 2500 }, (_, k) => [k * 0.1, i * 2]), closed: false, layer: 1 })) };
const rH = run({ ...p0, count: 16 }, heavy);
ok(finiteAll(rH), "16 frames of a 100k-pt drawing: finite");
ok(npts([rH[15]]) <= 100001 + 40, "single frame never exceeds the input size");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
