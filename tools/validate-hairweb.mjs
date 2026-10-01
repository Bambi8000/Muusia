/* Validator for the Hair Web node. Run from the repo root:
   node tools/validate-hairweb.mjs
   First line tells you which source was tested - read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "hairweb";

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
const CTX = { W: 297, H: 210 };
const run = (p, ctx) => def.compute([undefined], p, ctx || CTX, {});
const anchors = (p, ctx) => def._anchors(p, ctx || CTX);
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();

/* --- static shape --- */
ok(def.cat === "gen" && def.group === "organic", "cat gen / group organic");
ok(typeof def._anchors === "function", "_anchors shared helper (compute + overlay)");
ok(def.params.some((q) => q.type === "seed") && def.params.filter((q) => q.type === "pen").length === 2, "seed + two pens");
ok(typeof def.desc === "string" && def.desc.length > 200, "desc present");

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length === p0.strands, "one path per strand at defaults (" + r1.paths.length + ")");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2 && !q.closed), "every strand is an open polyline");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults (" + npts(r1) + " pts)");
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) => x >= mm - 1e-9 && x <= W - mm + 1e-9 && y >= mm - 1e-9 && y <= Hh - mm + 1e-9));
ok(inb(r1, 297, 210, p0.margin), "inside margin box on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin), "inside margin box on A4 tall");

/* --- anchors --- */
{
  const A = anchors(p0);
  ok(A.length === p0.cols * p0.rows, "Grid: cols x rows anchors (" + A.length + ")");
  const ins = p0.margin + p0.inset;
  ok(A.every((a) => a[0] >= ins - 5 && a[0] <= 297 - ins + 5 && a[1] >= ins - 5 && a[1] <= 210 - ins + 5), "Grid anchors sit inside the inset box (jitter allowed)");
  const R = anchors({ ...p0, layout: "Random", count: 30 });
  ok(R.length === 30, "Random: Count anchors");
  let minD = Infinity; for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) minD = Math.min(minD, Math.hypot(R[i][0] - R[j][0], R[i][1] - R[j][1]));
  ok(minD > 6, "Random anchors kept apart (min " + minD.toFixed(1) + " mm)");
  const G = anchors({ ...p0, layout: "Ring", count: 12 });
  const rr = G.map((a) => Math.hypot(a[0] - 297 / 2, a[1] - 105));
  ok(G.length === 12 && Math.max(...rr) - Math.min(...rr) < 1e-6, "Ring: anchors equidistant from the centre");
  ok(anchors({ ...p0, hubs: 0 }).every((a) => Math.abs(a[2] - 1) < 1e-9), "hubs 0: all anchors equally weighted");
  const w = anchors({ ...p0, hubs: 1 }).map((a) => a[2]);
  ok(Math.max(...w) - Math.min(...w) > 0.3, "hubs 1: weights spread");
}
/* --- strand endpoints land on anchors; loops return to their own anchor --- */
{
  const A = anchors(p0);
  const onAnchor = (q) => A.findIndex((a) => Math.hypot(a[0] - q[0], a[1] - q[1]) < 1e-6);
  const ends = r1.paths.map((q) => [onAnchor(q.pts[0]), onAnchor(q.pts[q.pts.length - 1])]);
  ok(ends.every(([a, b]) => a >= 0 && b >= 0), "every strand starts and ends exactly on an anchor");
  const loops = ends.filter(([a, b]) => a === b).length;
  ok(loops > p0.strands * p0.loops * 0.5 && loops < p0.strands * p0.loops * 1.6, "Loops share: " + loops + " petal loops of " + p0.strands + " (target " + p0.loops + ")");
  ok(run({ ...p0, loops: 0 }).paths.every((q) => onAnchor(q.pts[0]) !== onAnchor(q.pts[q.pts.length - 1])), "loops 0: no strand returns to its own anchor");
}
/* --- geometry oracles --- */
{
  const straight = run({ ...p0, bulge: 0, bulgeVar: 0, scurve: 0, loops: 0 });
  const dev = (q) => { const a = q.pts[0], b = q.pts[q.pts.length - 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return Math.max(...q.pts.map((pt) => Math.abs((pt[0] - a[0]) * (b[1] - a[1]) - (pt[1] - a[1]) * (b[0] - a[0])) / L)); };
  ok(straight.paths.every((q) => dev(q) < 1e-6), "bulge 0 / no S / no loops: strands are straight chords");
  const bowed = run({ ...p0, bulge: 0.5, bulgeVar: 0, scurve: 0, loops: 0 });
  ok(bowed.paths.filter((q) => dev(q) > 2).length > bowed.paths.length * 0.8, "bulge 0.5: strands bow visibly off their chord");
  /* locality 1: partners are near neighbours */
  const A = anchors(p0);
  const near = A.map((a, i) => Math.min(...A.map((b, j) => (i === j ? Infinity : Math.hypot(a[0] - b[0], a[1] - b[1])))));
  const loc1 = run({ ...p0, locality: 1, loops: 0 });
  const onA = (q) => A.findIndex((a) => Math.hypot(a[0] - q[0], a[1] - q[1]) < 1e-6);
  ok(loc1.paths.every((q) => { const i = onA(q.pts[0]), j = onA(q.pts[q.pts.length - 1]); return Math.hypot(A[i][0] - A[j][0], A[i][1] - A[j][1]) <= Math.max(near[i], near[j]) * 1.5 + 1e-6; }), "locality 1: every strand joins near neighbours only (either end may be the origin - strands alternate direction)");
  const loc0 = run({ ...p0, locality: 0, loops: 0 });
  const meanLen = (r) => r.paths.reduce((s, q) => s + Math.hypot(q.pts[0][0] - q.pts[q.pts.length - 1][0], q.pts[0][1] - q.pts[q.pts.length - 1][1]), 0) / r.paths.length;
  ok(meanLen(loc0) > meanLen(loc1) * 1.5, "locality 0 reaches much further than locality 1 (" + meanLen(loc0).toFixed(1) + " vs " + meanLen(loc1).toFixed(1) + " mm)");
  /* light share */
  ok(run({ ...p0, lightShare: 0 }).paths.every((q) => q.layer === p0.layer), "light share 0: all on the main pen");
  ok(run({ ...p0, lightShare: 1 }).paths.every((q) => q.layer === p0.penLight), "light share 1: all on the light pen");
  const share = r1.paths.filter((q) => q.layer === p0.penLight).length / r1.paths.length;
  ok(Math.abs(share - p0.lightShare) < 0.06, "light share at defaults ~ " + share.toFixed(2));
  /* hubs concentrate strands */
  const cnt = (r, hubs) => { const AA = anchors({ ...p0, hubs }); const c = new Array(AA.length).fill(0); for (const q of r.paths) { const i = AA.findIndex((a) => Math.hypot(a[0] - q.pts[0][0], a[1] - q.pts[0][1]) < 1e-6); if (i >= 0) c[i]++; } return c; };
  const c0 = cnt(run({ ...p0, hubs: 0, loops: 0 }), 0), c1 = cnt(run({ ...p0, hubs: 1, loops: 0 }), 1);
  const spread = (c) => Math.max(...c) / Math.max(1, Math.min(...c));
  ok(spread(c1) > spread(c0) * 1.5, "hubs 1: strand counts per anchor far more uneven than hubs 0 (" + spread(c1).toFixed(1) + "x vs " + spread(c0).toFixed(1) + "x)");
}

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => { const b = base ? JSON.stringify(run(base)) : bJ; ok(JSON.stringify(run({ ...(base || p0), ...patch })) !== b, "param live: " + label); };
diff({ layout: "Random" }, "layout"); diff({ cols: 3 }, "cols"); diff({ rows: 3 }, "rows"); diff({ jitter: 0.3 }, "jitter");
diff({ count: 10 }, "count", { ...p0, layout: "Random" }); diff({ strands: 500 }, "strands"); diff({ bulge: 0.8 }, "bulge"); diff({ bulgeVar: 0 }, "bulgeVar");
diff({ scurve: 0 }, "scurve"); diff({ loops: 0 }, "loops"); diff({ locality: 0 }, "locality"); diff({ hubs: 0 }, "hubs");
diff({ lightShare: 0 }, "lightShare"); diff({ inset: 10 }, "inset"); diff({ margin: 20 }, "margin"); diff({ seed: 4 }, "seed");
diff({ layer: 2 }, "layer"); diff({ penLight: 2 }, "penLight");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) {
  const r = run({ ...p0, [pd.key]: opt });
  ok(r.paths.length > 0 && finiteAll(r) && inb(r, 297, 210, p0.margin), pd.key + " '" + opt + "' draws finite paths inside the box (" + r.paths.length + ")");
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, cols: 2, rows: 2, strands: 50, bulge: 0, jitter: 0, inset: 0, margin: 0 })), "degenerate params produce no NaN");
const ext = run({ ...p0, layout: "Random", count: 80, strands: 6000, bulge: 1.2, bulgeVar: 1, scurve: 1, loops: 0.6, locality: 0, hubs: 1, margin: 40, inset: 80 });
ok(finiteAll(ext) && npts(ext) <= 120000 && inb(ext, 297, 210, 40), "extreme params: finite, budget held, inside box (" + npts(ext) + " pts)");
const wild = run({ ...p0, cols: 999, rows: -3, strands: 1e9, bulge: -5, loops: 9, locality: 7, hubs: -1, lightShare: 4, inset: 9999, margin: -20, seed: -1, layer: 40 });
ok(finiteAll(wild) && npts(wild) <= 120000, "wired-out-of-range values: finite + budget held (" + npts(wild) + " pts)");
ok(finiteAll(run(p0, { W: 6, H: 6 })), "tiny canvas: finite");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(vis(p0).includes("cols") && !vis(p0).includes("count") && vis({ ...p0, layout: "Ring" }).includes("count"), "showIf: Grid shows cols/rows/jitter, others show count");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");

/* --- overlay --- */
{
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1[0].kind === "rect" && g1.filter((g) => g.kind === "point").length === p0.cols * p0.rows, "overlay: margin rect + one point per anchor");
  let threw = false;
  try { def.overlay({ ...p0, margin: 999 }, { W: 4, H: 4 }, undefined, undefined); def.overlay(undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
