/* Validator for the Shuffle Seams node. Run from the repo root:
   node tools/validate-seams.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "seams";

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

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const p0 = defaults();
const run = (p, input) => def.compute([input], p, { W: 297, H: 210 }, {});

/* synthetic input: 15 concentric circles (all starting at angle 0, the seam
   column bug), one open polyline, one closed path with z values, one tiny path */
const circle = (cx, cy, r, layer) => {
  const pts = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return { pts, closed: true, layer };
};
const rings = () => ({
  paths: [
    ...Array.from({ length: 15 }, (_, i) => circle(148, 105, 60 - i * 3.5, 0)),
    { pts: [[10, 10], [40, 12], [70, 9]], closed: false, layer: 1 },
    { pts: [[200, 20, 1.5], [220, 20, 2.0], [220, 40, 2.5], [200, 40, 3.0]], closed: true, layer: 2 },
    { pts: [[5, 5], [5.001, 5]], closed: true, layer: 3 },
  ],
});
const pathLen = (q) => {
  let L = 0;
  const P = q.closed ? q.pts.concat([q.pts[0]]) : q.pts;
  for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  return L;
};
const startAngle = (q) => Math.atan2(q.pts[0][1] - 105, q.pts[0][0] - 148);

/* --- universal --- */
const r1 = run(p0, rings());
ok(JSON.stringify(r1) === JSON.stringify(run(p0, rings())), "deterministic (double run byte-identical)");
ok(r1.paths.length === rings().paths.length, "path count preserved (" + r1.paths.length + ")");
ok(r1.paths.every((q, i) => q.layer === rings().paths[i].layer), "layers preserved");
ok(r1.paths.every((q) => q.pts.every((pt) => pt.every(Number.isFinite))), "all coordinates finite");
ok(JSON.stringify(r1.paths[15]) === JSON.stringify(rings().paths[15]), "open path passes through untouched");

/* --- geometry preserved: per-ring loop length identical within tolerance --- */
{
  const before = rings().paths.slice(0, 15).map(pathLen);
  const after = r1.paths.slice(0, 15).map(pathLen);
  const worst = Math.max(...before.map((b, i) => Math.abs(b - after[i])));
  ok(worst < 1e-6, "loop lengths untouched at overlap 0 (worst drift " + worst.toExponential(1) + " mm)");
  ok(r1.paths.slice(0, 15).every((q) => q.closed), "rings stay closed at overlap 0");
}

/* --- seams actually disperse --- */
{
  const before = rings().paths.slice(0, 15).map(startAngle);
  const spreadB = Math.max(...before) - Math.min(...before);
  for (const m of ["Golden spiral", "Random", "Fixed step"]) {
    const r = run({ ...p0, mode: m }, rings());
    const angs = r.paths.slice(0, 15).map(startAngle);
    const uniq = new Set(angs.map((a) => Math.round(a * 20))).size;
    ok(uniq >= 10, m + ": seams disperse (" + uniq + "/15 distinct angles, input spread " + spreadB.toFixed(2) + ")");
  }
}

/* --- z values survive the cut --- */
{
  const zq = r1.paths[16];
  ok(zq.pts.every((pt) => pt.length === 3 && Number.isFinite(pt[2])), "z components preserved and interpolated at the cut");
  const zvals = zq.pts.map((pt) => pt[2]);
  ok(Math.min(...zvals) >= 1.5 - 1e-9 && Math.max(...zvals) <= 3.0 + 1e-9, "z stays within original range");
}

/* --- params live --- */
const bJ = JSON.stringify(r1);
ok(JSON.stringify(run({ ...p0, mode: "Random" }, rings())) !== bJ, "param live: mode");
ok(JSON.stringify(run({ ...p0, mode: "Random", seed: 84 }, rings())) !== JSON.stringify(run({ ...p0, mode: "Random", seed: 83 }, rings())), "param live: seed (Random)");
ok(JSON.stringify(run({ ...p0, mode: "Fixed step", step: 90 }, rings())) !== JSON.stringify(run({ ...p0, mode: "Fixed step", step: 45 }, rings())), "param live: step (Fixed)");
ok(JSON.stringify(run({ ...p0, overlap: 2 }, rings())) !== bJ, "param live: overlap");
ok(JSON.stringify(run({ ...p0, mode: "Golden spiral", seed: 999 }, rings())) === bJ, "Golden spiral ignores the seed (by design)");

/* --- overlap contract --- */
{
  const r = run({ ...p0, overlap: 2 }, rings());
  const q = r.paths[3];
  ok(!q.closed, "overlap: ring emitted as an open path");
  const L0 = pathLen(rings().paths[3]);
  const L1 = pathLen(q);
  ok(Math.abs(L1 - (L0 + 2)) < 0.05, "overlap: drawn length = loop + overlap (" + L1.toFixed(2) + " vs " + (L0 + 2).toFixed(2) + ")");
  const dEnds = Math.hypot(q.pts[0][0] - q.pts[q.pts.length - 1][0], q.pts[0][1] - q.pts[q.pts.length - 1][1]);
  ok(dEnds < 2.05 && dEnds > 0.5, "overlap: end runs past the start by ~overlap (" + dEnds.toFixed(2) + " mm chord)");
}

/* --- degenerate --- */
{
  let threw = false, r = null;
  try {
    r = run(p0, { paths: [] });
    run(p0, undefined);
    run({ ...p0, overlap: 5 }, { paths: [{ pts: [[1, 1], [1, 1], [1, 1]], closed: true, layer: 0 }] });
  } catch (e) { threw = true; }
  ok(!threw && r && r.paths.length === 0, "empty / missing / zero-length input: no throw");
}
{
  const tiny = run(p0, rings()).paths[17];
  ok(tiny.pts.length === rings().paths[17].pts.length, "sub-3-point closed path passes through");
}

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(!vis(p0).includes("step") && vis({ ...p0, mode: "Fixed step" }).includes("step"), "showIf: step follows Fixed step mode");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
