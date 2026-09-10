/* Validator for the Collect Frames node (definition contract + fallback
   compute). The engine seam itself is proven by tools/era/patch-frame-fan.mjs,
   which extracts the patched evalLevel and runs a real fan-out through it.
   Run from the repo root: node tools/validate-collect_frames.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "collect_frames";

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

const p0 = {}; for (const pr of def.params) p0[pr.key] = pr.def;
const SRC = { paths: [{ pts: [[10, 10], [50, 50, 2]], closed: false, layer: 4 }] };
const run = (p, src, ctx) => def.compute([src], p, ctx || { W: 420, H: 297, frameIdx: 0, frameCount: 6 }, { params: p });

ok(def.frameFan === true, "definition carries frameFan: true (the engine seam key)");
ok(def.outs({ params: { count: 2 } }).length === 2 && def.outs({ params: { count: 16 } }).length === 16 &&
   def.outs({ params: {} }).length === 6 && def.outs(null).length === 6,
  "dynamic outs: 2..16, default 6, null-node safe");
ok(def.outs({ params: { count: 5 } }).every((q, i) => q.label === "frame " + (i + 1)), "output pins labeled frame 1..N");

const r1 = run(p0, SRC), r2 = run(p0, SRC);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(Array.isArray(r1) && r1.length === p0.count, "fallback returns one path set per output (" + r1.length + ")");
ok(r1[0].paths.length === 1 && r1.slice(1).every((o) => o.paths.length === 0),
  "fallback: frame 0 routes the input to output 1 only");
const r4 = run(p0, SRC, { W: 420, H: 297, frameIdx: 3, frameCount: 6 });
ok(r4[3].paths.length === 1 && r4[3].paths[0].layer === 4 && r4[3].paths[0].pts[1][2] === 2,
  "fallback: frame 3 routes to output 4, layer and z intact");
ok(run(p0, SRC, { W: 420, H: 297, frameIdx: 99, frameCount: 6 })[p0.count - 1].paths.length === 1,
  "fallback: frameIdx clamps to the last output");
ok(run(p0, SRC, { W: 420, H: 297 })[0].paths.length === 1, "fallback survives a ctx without frameIdx");
ok(run({ count: 3 }, SRC).length === 3 && run({ count: 99 }, SRC).length === 16 && run({}, SRC).length === 6,
  "param live: count (clamped 2..16, default 6)");
ok(run(p0, undefined).every((o) => o.paths.length === 0), "unwired input: empty frames, no throw");
ok(run(p0, { paths: [] }).every((o) => Array.isArray(o.paths)), "empty path list: clean empties");

const frozen = JSON.parse(JSON.stringify(SRC));
const snap = JSON.stringify(frozen);
Object.freeze(frozen); frozen.paths.forEach((q) => { Object.freeze(q); Object.freeze(q.pts); q.pts.forEach((pt) => Object.freeze(pt)); });
run(p0, frozen);
ok(JSON.stringify(frozen) === snap, "inputs never mutated (deep-frozen run)");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
