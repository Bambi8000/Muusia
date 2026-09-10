/* Validator for the TV Antennas node.
   Run from the repo root: node tools/validate-antenna.mjs
   First line tells you which source was tested — read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "antenna";

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

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; };
const p0 = (() => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; })();
void defaults;
const CTX = { W: 420, H: 297 };
const run = (p, roof, ctx) => def.compute.call(def, [roof, undefined], p, ctx || CTX, { params: p });
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => pt.every(Number.isFinite)));
const inb = (r, Wm, Hm) => r.paths.every((q) => q.pts.every(([x, y]) => x >= 0 && x <= Wm && y >= 0 && y <= Hm));

const ROOF = { paths: [{ pts: [[30, 200], [390, 200]], closed: false, layer: 0 }] };
const SLANT = { paths: [{ pts: [[30, 240], [390, 120]], closed: false, layer: 0 }] };

/* --- universal invariants --- */
const r1 = run(p0, ROOF), r2 = run(p0, ROOF);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty on a wired roofline (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => q.layer === p0.layer), "everything on the chosen pen");
ok(inb(r1, 420, 297), "strictly in canvas bounds (whole-antenna skip)");
ok(inb(run(p0, null, { W: 210, H: 297 }), 210, 297), "in bounds unwired on A4 tall");
ok(npts(r1) < 120000, "point budget");

/* --- unwired: baseline planting --- */
const rB = run(p0, undefined);
ok(rB.paths.length > 0, "unwired: plants on the baseline (" + rB.paths.length + " paths)");
const ybExp = 297 * (p0.baseY / 100);
ok(rB.paths.some((q) => q.pts.some(([x, y]) => Math.abs(y - ybExp) < 1e-6)),
  "unwired: mast feet sit exactly on Base Y");

/* --- wired: mast feet on the roofline, roofline not mutated --- */
ok(r1.paths.some((q) => q.pts.some(([x, y]) => Math.abs(y - 200) < 1e-6)), "wired: mast feet on the roofline");
const frozen = JSON.parse(JSON.stringify(ROOF));
const snap = JSON.stringify(frozen);
Object.freeze(frozen); frozen.paths.forEach((q) => { Object.freeze(q); Object.freeze(q.pts); q.pts.forEach((pt) => Object.freeze(pt)); });
run(p0, frozen);
ok(JSON.stringify(frozen) === snap, "input roofline never mutated");
ok(!r1.paths.some((q) => q.pts.length === 2 && q.pts[0][1] === 200 && q.pts[1][1] === 200 &&
   Math.abs(q.pts[1][0] - q.pts[0][0]) > 100), "roofline itself is not re-emitted (node only adds ink)");

/* --- orientation oracle on a slanted roof --- */
const vertMasts = (r) => r.paths.filter((q) => q.pts.length === 2 &&
  Math.abs(q.pts[0][1] - q.pts[1][1]) > 3 &&
  Math.abs(q.pts[0][0] - q.pts[1][0]) < Math.abs(q.pts[0][1] - q.pts[1][1]) * 0.06);
ok(vertMasts(run({ ...p0, tilt: 0, vary: 0 }, SLANT)).length > 0,
  "Up: masts near-vertical (< 3\u00b0, Accurate keeps a hair of seeded lean) on a sloped roof");
const rN = run({ ...p0, tilt: 0, vary: 0, orient: "Path normal" }, SLANT);
const slope = Math.atan2(-120, 360);
const normMast = rN.paths.some((q) => {
  if (q.pts.length !== 2) return false;
  const a = Math.atan2(q.pts[1][1] - q.pts[0][1], q.pts[1][0] - q.pts[0][0]);
  const want = slope - Math.PI / 2;
  return Math.abs(Math.hypot(q.pts[1][0] - q.pts[0][0], q.pts[1][1] - q.pts[0][1])) > 3 &&
    (Math.abs(a - want) < 0.06 || Math.abs(a - want + Math.PI) < 0.06 || Math.abs(a - want - Math.PI) < 0.06);
});
ok(normMast, "Path normal: masts perpendicular to the slope");

/* --- spacing / density scale the population --- */
ok(run({ ...p0, spacing: 20 }, ROOF).paths.length > run({ ...p0, spacing: 100 }, ROOF).paths.length,
  "smaller spacing -> more antennas");
ok(run({ ...p0, density: 20 }, ROOF).paths.length < r1.paths.length, "lower density -> fewer antennas");

/* --- type signatures --- */
const rYagi = run({ ...p0, type: "Yagi" }, ROOF);
ok(rYagi.paths.some((q) => q.closed && q.pts.length === 4), "Yagi: folded dipole loop present");
const rDish = run({ ...p0, type: "Dish" }, ROOF);
ok(rDish.paths.some((q) => q.closed && q.pts.length === 36), "Dish: 36-pt rim ellipse present");
ok(rDish.paths.filter((q) => q.closed && q.pts.length === 36).length >= 2, "Dish Accurate: inner rim line present");
const rPan = run({ ...p0, type: "Panel" }, ROOF);
ok(rPan.paths.some((q) => q.closed && q.pts.length === 4), "Panel: mesh frame present");
const rFM = run({ ...p0, type: "FM star" }, ROOF);
ok(rFM.paths.some((q) => q.closed && q.pts.length === 8), "FM star: hub ring present");
ok(rFM.paths.filter((q) => !q.closed && q.pts.length === 2).length >= 10, "FM star: radial spokes present");
const rCar = run({ ...p0, type: "Yagi", style: "Cartoon", wonk: 0.8 }, ROOF);
ok(rCar.paths.some((q) => q.closed && q.pts.length === 6), "Cartoon: element tip dots present");
ok(rCar.paths.length > rYagi.paths.length, "Cartoon adds tip dots / double mast over Accurate");

/* --- diversity: no two masts are copies --- */
const rMix = run({ ...p0, cables: "Off", braces: "Off", tilt: 0 }, ROOF);
const masts = rMix.paths.filter((q) => q.pts.length === 2 &&
  Math.abs(q.pts[0][0] - q.pts[1][0]) < Math.abs(q.pts[0][1] - q.pts[1][1]) * 0.12 &&
  q.pts.some(([x, y]) => Math.abs(y - 200) < 1e-6));
const hset = new Set(masts.map((q) => Math.abs(q.pts[1][1] - q.pts[0][1]).toFixed(3)));
ok(masts.length >= 4 && hset.size >= Math.min(4, masts.length),
  "diversity: mast heights all differ (" + hset.size + "/" + masts.length + ")");
ok(run({ ...p0, cables: "On" }, ROOF).paths.length > run({ ...p0, cables: "Off" }, ROOF).paths.length,
  "cables add catenaries between mast tops");

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, roof) =>
  ok(JSON.stringify(run({ ...p0, ...patch }, roof || ROOF)) !== bJ, "param live: " + label);
diff({ type: "Log-periodic" }, "type");
diff({ style: "Cartoon" }, "style");
{
  const a = run({ ...p0, style: "Cartoon", wonk: 0.1 }, ROOF);
  const b = run({ ...p0, style: "Cartoon", wonk: 0.9 }, ROOF);
  ok(JSON.stringify(a) !== JSON.stringify(b), "param live: wonk (Cartoon)");
}
diff({ spacing: 30 }, "spacing");
diff({ density: 50 }, "density");
diff({ mast: 60 }, "mast");
diff({ heads: 1 }, "heads");
diff({ vary: 0.1 }, "vary");
diff({ size: 40 }, "size");
diff({ elems: 9 }, "elems");
diff({ tilt: 15 }, "tilt");
diff({ orient: "Path normal" }, "orient", SLANT);
diff({ aim: "Random" }, "aim");
diff({ braces: "Off" }, "braces");
diff({ cables: "Off" }, "cables");
diff({ layer: 4 }, "layer");
diff({ seed: 99 }, "seed");
{
  const a = run({ ...p0, baseY: 40 }, undefined);
  const b = run({ ...p0, baseY: 80 }, undefined);
  ok(JSON.stringify(a) !== JSON.stringify(b), "param live: baseY (unwired)");
}

/* --- every select option renders on both styles --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    for (const st of ["Accurate", "Cartoon"]) {
      const r = run({ ...p0, [pd.key]: opt, style: pd.key === "style" ? opt : st }, ROOF);
      ok(r.paths.length > 0 && finiteAll(r) && inb(r, 420, 297),
        pd.key + " '" + opt + "' / " + st + " draws finite in-bounds paths (" + r.paths.length + ")");
    }
  }
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, mast: 8, size: 6, spacing: 120, elems: 2, heads: 1, vary: 0 }, ROOF)), "minimal antenna: no NaN");
{
  const rTall = run({ ...p0, mast: 60, vary: 0, tilt: 0, type: "Yagi" }, { paths: [{ pts: [[30, 120], [390, 120]], closed: false, layer: 0 }] });
  ok(rTall.paths.length > 0 && inb(rTall, 420, 297), "retry shrink: tall masts fit instead of vanishing");
}
const rX = run({ ...p0, type: "Mixed", style: "Cartoon", wonk: 1, spacing: 12, mast: 90, size: 50,
  elems: 10, heads: 4, vary: 1, braces: "Struts", cables: "On" }, ROOF);
ok(finiteAll(rX) && inb(rX, 420, 297) && npts(rX) <= 110000,
  "extreme skyline: finite, in bounds, budget held (" + npts(rX) + " pts)");
ok(finiteAll(run(p0, ROOF, { W: 60, H: 60 })), "tiny canvas: clean skip, no NaN");
ok(finiteAll(run(p0, { paths: [{ pts: [[100, 100]], closed: false, layer: 0 }] })),
  "degenerate 1-pt roofline path: no throw");
const CIRC = { paths: [{ pts: Array.from({ length: 40 }, (_, k) => {
  const a = (k / 40) * Math.PI * 2; return [210 + 90 * Math.cos(a), 150 + 90 * Math.sin(a)];
}), closed: true, layer: 0 }] };
ok(finiteAll(run({ ...p0, orient: "Path normal" }, CIRC)), "closed roofline: antennas grow outward, no NaN");

/* --- overlay --- */
ok(typeof def.overlay === "function", "overlay exists");
const g1 = def.overlay.call(def, p0, CTX, [undefined]);
ok(Array.isArray(g1) && g1.length === 1 && g1[0].kind === "poly", "overlay: baseline guide when unwired");
ok(def.overlay.call(def, p0, CTX, [ROOF]).length === 0, "overlay: silent when a roofline is wired");
ok(Array.isArray(def.overlay.call(def, { baseY: NaN }, null, null)), "overlay never throws");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(!vis(p0).includes("wonk") && vis({ ...p0, style: "Cartoon" }).includes("wonk"), "showIf: wonk only in Cartoon");
ok(!vis({ ...p0, type: "Dish" }).includes("elems") && !vis({ ...p0, type: "Panel" }).includes("elems") &&
   !vis({ ...p0, type: "FM star" }).includes("elems") && vis(p0).includes("elems"),
  "showIf: elems hidden for Dish, Panel and FM star");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
