/* Validator for the Calibration Sheet node.
   Run from the repo root: node tools/validate-calib_sheet.mjs

   This node's whole value is that it does NOT scale, so the tests here are
   exact-arithmetic rather than approximate: a side must be 100.000000 mm, not
   100 +/- tolerance. A fit transform sneaking in later must turn this red. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "calib_sheet";
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
const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (p, ctx) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((t) => Number.isFinite(t[0]) && Number.isFinite(t[1])));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const EXACT = 1e-9;

const p0 = defaults();
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -0.01 && x <= W + 0.01 && y >= -0.01 && y <= Hh + 0.01));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297), "in bounds on A4 tall");

/* ---------- the square is EXACTLY the requested size ---------- */
const squares = (r, sz) => r.paths.filter((q) => q.closed && q.pts.length === 4 &&
  Math.abs(dist(q.pts[0], q.pts[1]) - sz) < 1e-6);
for (const [sz, W, Hh] of [[20, 297, 210], [47, 297, 210], [100, 297, 210], [150, 297, 210], [200, 400, 300], [600, 793, 813]]) {
  const r = run({ ...p0, size: sz }, { W, H: Hh });
  const sq = r.paths.filter((q) => q.closed && q.pts.length === 4 && Math.abs(dist(q.pts[0], q.pts[1]) - sz) < 1);
  if (!sq.length) { ok(false, "square present at size " + sz); continue; }
  let worst = 0;
  for (const q of sq) for (let i = 0; i < 4; i++) worst = Math.max(worst, Math.abs(dist(q.pts[i], q.pts[(i + 1) % 4]) - sz));
  ok(worst < EXACT, "size " + sz + " mm: every side exact to 1e-9 (worst error " + worst.toExponential(1) + " mm)");
}
const sq0 = run(p0).paths.find((q) => q.closed && q.pts.length === 4);
ok(Math.abs(dist(sq0.pts[0], sq0.pts[2]) - dist(sq0.pts[1], sq0.pts[3])) < EXACT, "the drawn square's own diagonals are equal (it is square, not a rhombus)");
ok(Math.abs(dist(sq0.pts[0], sq0.pts[2]) - 100 * Math.SQRT2) < 1e-9, "diagonal is exactly size * sqrt(2)");

/* ---------- THE oracle: canvas size must not touch a single coordinate ---------- */
const fixed = { ...p0, anchor: "Custom", posX: 30, posY: 30 };
const base = JSON.stringify(run(fixed, { W: 297, H: 210 }));
let scaled = 0;
for (const [W, Hh] of [[400, 300], [600, 500], [250, 200], [793, 813]]) {
  if (JSON.stringify(run(fixed, { W, Hh: 0, H: Hh })) !== base) {
    console.log("     geometry changed on a " + W + "x" + Hh + " canvas");
    scaled++;
  }
}
ok(scaled === 0, "geometry is byte-identical on 4 different canvas sizes (nothing is fitted)");
const big = run({ ...fixed, size: 200 }, { W: 400, H: 300 });
const bigSq = big.paths.find((q) => q.closed && q.pts.length === 4);
ok(bigSq && Math.abs(dist(bigSq.pts[0], bigSq.pts[1]) - 200) < EXACT, "200 mm square on a 400x300 sheet is still exactly 200 mm");

/* ---------- footprint: nothing may stray outside the square + its marks ----------
   A label that overhangs the square is invisible in the preview and only shows
   up as a pen mark on the table, so this is measured, not eyeballed. */
let overhang = 0;
for (const [label, pp, W, Hh] of [
  ["defaults", p0, 297, 210],
  ["small square", { ...p0, size: 25 }, 297, 210],
  ["big text", { ...p0, textSize: 12 }, 297, 210],
  ["6 passes", { ...p0, repeats: 6, size: 40 }, 297, 210],
  ["fat crosses", { ...p0, crossSize: 40, tickLen: 15 }, 297, 210],
  ["no ruler no crosses", { ...p0, ruler: false, crosses: false }, 297, 210],
  ["custom corner", { ...p0, anchor: "Custom", posX: 25, posY: 25, size: 60 }, 297, 210],
]) {
  const r = run(pp, { W, H: Hh });
  const sq = r.paths.find((q) => q.closed && q.pts.length === 4 && Math.abs(dist(q.pts[0], q.pts[1]) - pp.size) < 1);
  if (!sq) { console.log("FAIL footprint: " + label + " (no square)"); overhang++; continue; }
  const sx = sq.pts.map((t) => t[0]), sy = sq.pts.map((t) => t[1]);
  const lx = Math.min(...sx), rx = Math.max(...sx), ty = Math.min(...sy), by = Math.max(...sy);
  const pad = (pp.crosses ? pp.crossSize / 2 : 0) + (pp.ruler ? pp.tickLen : 0);
  const lab = pp.labels ? pp.textSize * 1.6 : 0;
  /* the origin cross is a machine fiducial by design: it belongs outside */
  const oa = pp.crossSize / 2;
  const oxx = Math.min(Math.max(pp.originX, oa), Math.max(oa, W - oa));
  const oyy = Math.min(Math.max(pp.originY, oa), Math.max(oa, Hh - oa));
  const isFid = (q) => pp.originCross && q.pts.every(([x, y]) =>
    Math.abs(x - oxx) <= oa + 1e-6 && Math.abs(y - oyy) <= oa + 1e-6);
  let bad = null;
  for (const q of r.paths) { if (isFid(q)) continue; for (const [x, y] of q.pts) {
    if (x < lx - pad - 0.01 || x > rx + pad + 0.01 || y < ty - pad - 0.01 || y > by + pad + lab + 0.01) { bad = [x, y]; break; }
  } }
  ok(!bad, "footprint holds: " + label + (bad ? " (stray at " + bad[0].toFixed(1) + "," + bad[1].toFixed(1) + ")" : ""));
  if (bad) overhang++;
}
ok(overhang === 0, "no annotation ever overhangs the square's own footprint");
/* the label must shrink rather than run past a narrow square */
const tiny = run({ ...p0, size: 25, textSize: 12 });
const tsq = tiny.paths.find((q) => q.closed && q.pts.length === 4);
const txs = tiny.paths.flatMap((q) => q.pts.map((t) => t[0]));
ok(Math.max(...txs) <= Math.max(...tsq.pts.map((t) => t[0])) + p0.crossSize / 2 + p0.tickLen + 0.01,
  "an oversized label is shrunk to the square's width, not allowed to overhang");

/* ---------- refusal instead of silent shrinking ---------- */
const tooBig = run({ ...p0, size: 400 }, { W: 297, H: 210 });
ok(tooBig.paths.length > 0, "an oversize square still draws something (the warning)");
ok(!tooBig.paths.some((q) => q.closed && q.pts.length === 4 &&
  Math.abs(dist(q.pts[0], q.pts[1]) - dist(q.pts[1], q.pts[2])) < EXACT &&
  Math.abs(dist(q.pts[0], q.pts[1]) - 400) < 1), "no 400 mm square is emitted when it cannot fit");
const shrunk = tooBig.paths.filter((q) => q.closed && q.pts.length === 4)
  .some((q) => { const s = dist(q.pts[0], q.pts[1]); return s > 150 && s < 399 && Math.abs(s - dist(q.pts[1], q.pts[2])) < EXACT; });
ok(!shrunk, "the oversize square is NOT quietly scaled down to fit");
ok(inb(tooBig, 297, 210), "the warning stays on the sheet");
ok(finiteAll(tooBig), "warning branch is finite");
const edge = run({ ...p0, size: 100, anchor: "Custom", posX: 0, posY: 0 });
ok(edge.paths.length > 0, "a square flush against the origin still resolves");

/* ---------- repeat passes: same geometry, different travel direction ---------- */
for (const n of [1, 2, 3, 6]) {
  const r = run({ ...p0, repeats: n });
  const sq = r.paths.filter((q) => q.closed && q.pts.length === 4 && Math.abs(dist(q.pts[0], q.pts[1]) - 100) < EXACT);
  ok(sq.length === n, "Repeat passes " + n + " draws " + n + " traces (" + sq.length + ")");
}
const reps = run({ ...p0, repeats: 4 }).paths.filter((q) => q.closed && q.pts.length === 4);
const keyOf = (q) => q.pts.map((t) => t[0].toFixed(6) + "," + t[1].toFixed(6)).sort().join(" ");
ok(new Set(reps.map(keyOf)).size === 1, "every repeat visits the same four corners");
ok(new Set(reps.map((q) => q.pts.map((t) => t[0].toFixed(3) + "," + t[1].toFixed(3)).join(">"))).size === 4,
  "every repeat starts at a different corner");
const wind = reps.map((q) => Math.sign(H.signedArea(q.pts)));
ok(wind[0] !== wind[1] && wind[1] !== wind[2], "repeats alternate direction, so backlash cannot hide in one winding");

/* ---------- the step-loss detector ---------- */
const oc = run(p0);
const first2 = oc.paths.slice(0, 2), last2 = oc.paths.slice(-2);
ok(JSON.stringify(first2.map((q) => q.pts)) === JSON.stringify(last2.map((q) => q.pts)),
  "origin cross is byte-identical as the first and the last stroke of the file");
const noOc = run({ ...p0, originCross: false });
ok(noOc.paths.length === oc.paths.length - 4, "turning the origin cross off removes exactly the four strokes");
const moved = run({ ...p0, originX: 40, originY: 55 });
ok(Math.abs(moved.paths[0].pts[0][1] - 55) < EXACT, "origin cross lands exactly on the requested coordinate");

/* ---------- ruler ticks fall on exact multiples ---------- */
const rl = run({ ...p0, tickStep: 10, ruler: true });
const sqB = rl.paths.find((q) => q.closed && q.pts.length === 4);
const xs = sqB.pts.map((t) => t[0]), left = Math.min(...xs), bottom = Math.max(...sqB.pts.map((t) => t[1]));
const vt = rl.paths.filter((q) => !q.closed && q.pts.length === 2 &&
  Math.abs(q.pts[0][0] - q.pts[1][0]) < EXACT && Math.abs(q.pts[0][1] - bottom) < EXACT);
ok(vt.length === 11, "a 100 mm edge at 10 mm steps gets 11 ticks (" + vt.length + ")");
let tickBad = 0;
for (const q of vt) { const d = q.pts[0][0] - left; if (Math.abs(d - Math.round(d / 10) * 10) > EXACT) tickBad++; }
ok(tickBad === 0, "every tick sits on an exact multiple of the step");
const vt5 = run({ ...p0, tickStep: 5 }).paths.filter((q) => !q.closed && q.pts.length === 2 &&
  Math.abs(q.pts[0][0] - q.pts[1][0]) < EXACT && Math.abs(q.pts[0][1] - bottom) < EXACT);
ok(vt5.length === 21, "5 mm steps give 21 ticks (" + vt5.length + ")");
const lens = [...new Set(vt.map((q) => +(q.pts[1][1] - q.pts[0][1]).toFixed(6)))];
ok(lens.length === 2, "ticks come in two lengths, long every fifth");

/* ---------- pens ---------- */
const two = run({ ...p0, layer: 2, markPen: 7 });
ok([...new Set(two.paths.map((q) => q.layer))].sort((a, b) => a - b).join() === "2,7", "square pen and mark pen are separate layers");
ok(two.paths.filter((q) => q.closed && q.pts.length === 4).every((q) => q.layer === 2), "the measured square is on the square pen");

/* ---------- param liveness ---------- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ size: 120 }, "size");
diff({ anchor: "Custom" }, "anchor");
diff({ diagonals: false }, "diagonals");
diff({ repeats: 5 }, "repeats");
diff({ crosses: false }, "crosses");
diff({ crossSize: 25 }, "crossSize");
diff({ ruler: false }, "ruler");
diff({ tickStep: 25 }, "tickStep");
diff({ tickLen: 9 }, "tickLen");
diff({ originCross: false }, "originCross");
diff({ originX: 40 }, "originX");
diff({ originY: 40 }, "originY");
diff({ labels: false }, "labels");
diff({ textSize: 8 }, "textSize");
diff({ layer: 3 }, "layer");
diff({ markPen: 9 }, "markPen");
const cust = { ...p0, anchor: "Custom" };
ok(JSON.stringify(run({ ...cust, posX: 55 })) !== JSON.stringify(run(cust)), "param live: posX (Custom)");
ok(JSON.stringify(run({ ...cust, posY: 55 })) !== JSON.stringify(run(cust)), "param live: posY (Custom)");

/* Centre really centres, to the micron */
const c = run(p0).paths.find((q) => q.closed && q.pts.length === 4);
const cxs = c.pts.map((t) => t[0]), cys = c.pts.map((t) => t[1]);
ok(Math.abs((Math.min(...cxs) + Math.max(...cxs)) / 2 - 148.5) < EXACT &&
   Math.abs((Math.min(...cys) + Math.max(...cys)) / 2 - 105) < EXACT, "Centre places the square exactly at the sheet centre");

/* ---------- degenerate ---------- */
ok(finiteAll(run({ ...p0, size: 20, crossSize: 4, tickLen: 2, tickStep: 5, textSize: 2, repeats: 1 })), "minimum params produce no NaN");
ok(finiteAll(run({ ...p0, size: 600, repeats: 6, tickStep: 5 }, { W: 793, H: 813 })), "a 600 mm square on the Viivain bed is finite");
ok(finiteAll(run(p0, { W: 30, H: 20 })), "tiny canvas produces no NaN");
ok(inb(run({ ...p0, crossSize: 40, originX: 5, originY: 5 }), 297, 210), "a fat origin cross near the corner is clamped onto the sheet");
ok(inb(run({ ...p0, crossSize: 40, originX: 295, originY: 208 }), 297, 210), "a fat origin cross past the far corner is clamped onto the sheet");
ok(finiteAll(run(p0, undefined)), "missing ctx produces no NaN");
ok(run({ ...p0, size: 600 }, { W: 793, H: 813 }).paths.some((q) => q.closed && q.pts.length === 4 &&
  Math.abs(dist(q.pts[0], q.pts[1]) - 600) < EXACT), "600 mm square is exact on the 793x813 bed");

/* ---------- showIf ---------- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
ok(!vis(p0).includes("posX") && vis(cust).includes("posX"), "showIf: position fields only in Custom");

/* ---------- overlay ---------- */
const g = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
ok(Array.isArray(g) && g.length > 0, "overlay returns guides (" + g.length + ")");
const gr = g.find((q) => q.kind === "rect");
ok(gr && Math.abs(gr.w - 100) < EXACT && Math.abs(gr.h - 100) < EXACT, "overlay rect is the true 100 mm square");
ok(gr && Math.abs(gr.x - 98.5) < EXACT && Math.abs(gr.y - 55) < EXACT, "overlay rect sits exactly where the ink does");
const gTooBig = def.overlay({ ...p0, size: 400 }, { W: 297, H: 210 }, undefined, {});
ok(gTooBig.length > 0, "overlay still guides in the refusal branch");
let threw = false;
try { def.overlay(p0, { W: 4, H: 4 }); def.overlay(p0, undefined); def.overlay({ ...p0, size: 1 }, { W: 297, H: 210 }); } catch (e) { threw = true; }
ok(!threw, "overlay never throws on degenerate input");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
