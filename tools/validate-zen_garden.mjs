/* Validator for zen_garden.
   Oracles: (1) a single circular stone in Rings-only mode must produce
   concentric circles at radii clearance + group offsets + k*spacing;
   (2) Straight mode far from any stone must produce straight lines with
   the exact groove pitch, and Tines must split each groove into the
   tg,tg,...,(s-(n-1)*tg) parallel-gap pattern.
   Run from the repo root: node tools/validate-zen_garden.mjs */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "zen_garden";

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

/* keep the standard helper shape */
const OK = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

const circle = (cx, cy, r, n = 96) => {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
  return { pts, closed: true, layer: 0 };
};
const stones1 = { paths: [circle(105, 148, 18)] };
const stones2 = { paths: [circle(70, 100, 15), circle(150, 190, 22)] };

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const CTX = { W: 210, H: 297 };
const run = (p, stones, ctx) => def.compute([stones === undefined ? stones1 : stones, undefined], p, ctx || CTX);
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

const p0 = defaults();

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
OK(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
OK(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
OK(finiteAll(r1), "all coordinates finite");
OK(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
OK(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
OK(npts(r1) < 120000, "point budget at defaults (" + npts(r1) + ")");
const tol = 1.0;
OK(r1.paths.every((q) => q.pts.every(([x, y]) => x >= p0.margin - tol && x <= 210 - p0.margin + tol && y >= p0.margin - tol && y <= 297 - p0.margin + tol)),
  "in margin box");
OK(finiteAll(run(p0, stones1, { W: 297, H: 210 })), "A4 wide renders");

/* --- no line enters a stone (minus a small marching-cell tolerance) --- */
function minDistToStone(r, cx, cy, R, penSkip) {
  let dmin = Infinity;
  for (const q of r.paths) {
    if (q.layer === penSkip) continue;
    for (const [x, y] of q.pts) dmin = Math.min(dmin, Math.hypot(x - cx, y - cy) - R);
  }
  return dmin;
}
{
  const d = minDistToStone(r1, 105, 148, 18, Math.round(p0.stonepen));
  OK(d > p0.clearance - 1.3, "rake stays >= clearance from the stone (min " + d.toFixed(2) + "mm, clearance " + p0.clearance + ")");
  OK(d > 0, "no rake line inside the stone");
}

/* --- oracle 1: Rings only around one circular stone => concentric circles --- */
{
  const p = { ...p0, rake: "Rings only", wobble: 0, tines: 1, spacing: 2, clearance: 2, detail: 1.0, keep: false };
  const r = run(p);
  OK(r.paths.length >= 5, "rings-only: several rings (" + r.paths.length + ")");
  let radialSpreadMax = 0, offGrid = 0;
  for (const q of r.paths) {
    const rs = q.pts.map(([x, y]) => Math.hypot(x - 105, y - 148));
    const mean = rs.reduce((a2, b2) => a2 + b2, 0) / rs.length;
    const spread = Math.max(...rs) - Math.min(...rs);
    if (q.closed) radialSpreadMax = Math.max(radialSpreadMax, spread);
    const kk = (mean - 18 - 2) / 2;
    if (q.closed && Math.abs(kk - Math.round(kk)) * 2 > 0.7) offGrid++;
  }
  OK(radialSpreadMax <= 1.1, "rings are round (max radial spread " + radialSpreadMax.toFixed(2) + "mm)");
  OK(offGrid === 0, "ring radii sit at clearance + k*spacing (" + offGrid + " off-grid)");
}

/* --- oracle 2: Straight rake far from stones is straight with exact pitch --- */
function lineFits(r, xmin, xmax) {
  /* collect horizontal-ish paths confined to a stone-free strip */
  const ys = [];
  let maxResid = 0;
  for (const q of r.paths) {
    const pts = q.pts.filter(([x]) => x >= xmin && x <= xmax);
    if (pts.length < 8) continue;
    const my = pts.reduce((a2, q2) => a2 + q2[1], 0) / pts.length;
    let resid = 0;
    for (const [, y] of pts) resid = Math.max(resid, Math.abs(y - my));
    maxResid = Math.max(maxResid, resid);
    ys.push(my);
  }
  ys.sort((a2, b2) => a2 - b2);
  return { ys, maxResid };
}
{
  const p = { ...p0, rake: "Straight", dir: 0, wobble: 0, tines: 1, spacing: 3, rings: 4, detail: 1.0, keep: false };
  const r = run(p);
  const { ys, maxResid } = lineFits(r, 30, 70); /* strip far left of the stone at x=105 */
  OK(ys.length >= 10, "straight rake: many lines in the test strip (" + ys.length + ")");
  OK(maxResid <= 0.35, "far lines are straight (max residual " + maxResid.toFixed(3) + "mm)");
  let gapErr = 0;
  for (let i = 1; i < ys.length; i++) gapErr = Math.max(gapErr, Math.abs(ys[i] - ys[i - 1] - 3));
  OK(gapErr <= 0.35, "groove pitch = spacing (max gap error " + gapErr.toFixed(3) + "mm)");
}

/* --- oracle 3: Tines splits grooves into tg,tg,(s-2*tg) gap pattern --- */
{
  const p = { ...p0, rake: "Straight", dir: 0, wobble: 0, tines: 3, tinegap: 0.8, spacing: 4, rings: 3, detail: 0.8, keep: false };
  const r = run(p);
  const { ys } = lineFits(r, 30, 70);
  OK(ys.length >= 12, "tines: many lines (" + ys.length + ")");
  const gaps = [];
  for (let i = 1; i < ys.length; i++) gaps.push(ys[i] - ys[i - 1]);
  const near = (v, t2) => Math.abs(v - t2) <= 0.3;
  let bad = 0;
  for (const g2 of gaps) if (!near(g2, 0.8) && !near(g2, 4 - 2 * 0.8)) bad++;
  OK(bad === 0, "tine gaps are tg or s-(n-1)tg (" + bad + " odd gaps of " + gaps.length + ")");
  const small = gaps.filter((g2) => near(g2, 0.8)).length;
  OK(small >= gaps.length * 0.5, "majority of gaps are tine gaps (" + small + "/" + gaps.length + ")");
}

/* --- parameter liveness --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => OK(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ rake: "Waves" }, "rake");
diff({ dir: 45 }, "dir");
diff({ spacing: 3 }, "spacing");
diff({ tines: 3 }, "tines");
diff({ clearance: 6 }, "clearance");
diff({ rings: 10 }, "rings");
diff({ wobble: 0.9 }, "wobble");
diff({ detail: 2.0 }, "detail");
diff({ margin: 25 }, "margin");
diff({ seed: 99 }, "seed (wobble on at defaults)");
diff({ keep: false }, "keep");
diff({ stonepen: 5 }, "stonepen");
diff({ layer: 4 }, "layer");
{
  const base = JSON.stringify(run({ ...p0, tines: 3, spacing: 4 }));
  OK(JSON.stringify(run({ ...p0, tines: 3, spacing: 4, tinegap: 1.4 })) !== base, "param live: tinegap (tines 3, spacing 4)");
  const w = JSON.stringify(run({ ...p0, rake: "Waves" }));
  OK(JSON.stringify(run({ ...p0, rake: "Waves", wamp: 15 })) !== w, "param live: wamp");
  OK(JSON.stringify(run({ ...p0, rake: "Waves", wlen: 120 })) !== w, "param live: wlen");
}

/* --- rake ends at the ring pool boundary; pool has the right ring count --- */
{
  const p = { ...p0, rake: "Straight", dir: 0, wobble: 0, tines: 1, spacing: 3, rings: 5, clearance: 2, detail: 1.0, keep: false };
  const r = run(p);
  const rOuter = 2 + 4 * 3 + 1.5;
  let rakeMin = Infinity, ringPaths = 0;
  for (const q of r.paths) {
    const rs = q.pts.map(([x, y]) => Math.hypot(x - 105, y - 148) - 18);
    const mn = Math.min(...rs), mx = Math.max(...rs);
    if (q.closed && mx < rOuter) ringPaths++;
    else rakeMin = Math.min(rakeMin, mn);
  }
  OK(rakeMin >= rOuter - 1.2, "rake lines end at the pool boundary (min " + rakeMin.toFixed(2) + "mm, rOuter " + rOuter + ")");
  OK(ringPaths === 5, "exactly Rings closed rings in the pool (" + ringPaths + ")");
}

/* --- straight rake covers all four quadrants --- */
{
  const p = { ...p0, rake: "Straight", dir: 0, wobble: 0, keep: false };
  const r = run(p);
  const quad = [0, 0, 0, 0];
  for (const q of r.paths) for (const [x, y] of q.pts) quad[(x > 105 ? 1 : 0) + (y > 148 ? 2 : 0)]++;
  OK(quad.every((c) => c > 200), "straight rake covers all quadrants (" + quad.join("/") + ")");
}

/* --- select options render --- */
for (const opt of def.params.find((q) => q.key === "rake").options) {
  const r = run({ ...p0, rake: opt });
  OK(r.paths.length > 0 && finiteAll(r), "rake '" + opt + "' draws finite paths (" + r.paths.length + ")");
}

/* --- stones input edge cases --- */
OK(run(p0, { paths: [] }).paths.length > 0, "no stones: plain rake still draws");
OK(run({ ...p0, rake: "Rings only", keep: false }, { paths: [] }).paths.length === 0, "rings-only without stones: empty");
{
  const open = { paths: [{ pts: [[50, 50], [150, 150]], closed: false, layer: 0 }] };
  const r = run(p0, open);
  OK(finiteAll(r) && r.paths.length > 0, "open path in Stones: ignored, rake draws");
}
OK(run(p0, stones2).paths.length > 0 && finiteAll(run(p0, stones2)), "two stones render");
OK(run(p0, undefined) && finiteAll(run({ ...p0 }, null || stones1)), "wired input shape sane");
{
  const r = run({ ...p0, keep: true, stonepen: 5 });
  OK(r.paths.some((q) => q.layer === 5 && q.closed), "keep stones passes outlines on stone pen");
  const r2b = run({ ...p0, keep: false });
  OK(!r2b.paths.some((q) => q.layer === Math.round(p0.stonepen) && q.closed && q.pts.length === stones1.paths[0].pts.length), "keep off: no stone outline");
}

/* --- budget and degenerates --- */
{
  const dense = run({ ...p0, spacing: 0.8, tines: 4, tinegap: 0.4, detail: 0.6, wobble: 1 }, stones2, { W: 297, H: 420 });
  OK(finiteAll(dense) && npts(dense) <= 120000, "max density on A3: finite + budget (" + npts(dense) + " pts)");
  OK(finiteAll(run({ ...p0, margin: 60 })), "margin 60 no NaN");
  OK(run({ ...p0, margin: 200 }).paths.length === 0, "margin > canvas: empty, no throw");
  OK(finiteAll(run({ ...p0, clearance: 12, rings: 20 })), "extreme clearance/rings no NaN");
  const tiny = run(p0, { paths: [circle(105, 148, 1.5, 12)] });
  OK(finiteAll(tiny), "tiny stone no NaN");
}

/* --- showIf sanity --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  OK(!vis({ ...p0, rake: "Rings only" }).includes("rings"), "showIf: rings hidden in Rings only");
  OK(vis({ ...p0, rake: "Waves" }).includes("wamp"), "showIf: wamp visible in Waves");
  OK(!vis({ ...p0, tines: 1 }).includes("tinegap"), "showIf: tinegap hidden at tines 1");
}

/* --- proof dump --- */
try {
  const proof = run({ ...defaults(), rake: "Straight", dir: 12 }, stones2, { W: 210, H: 297 });
  writeFileSync("/tmp/zen_garden_proof.json", JSON.stringify({ paths: proof.paths.slice(0, 4000) }));
} catch (e) { /* optional */ }

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
