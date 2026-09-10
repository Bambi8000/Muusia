/* Validator for the bg_fill node. Run from the repo root:
   node tools/validate-bg_fill.mjs
   First line tells which source was tested ([lab] or [baked]) - read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "bg_fill";

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
const run = (p, ctx, ins) => def.compute(ins || [undefined, undefined], p, ctx || { W: 297, H: 210 }, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

const MODES = ["Drape", "Magnet", "Grain", "Scales", "Torn", "Pleat", "Circles"];
const p0 = defaults();

/* --- universal invariants, per mode --- */
for (const mo of MODES) {
  const pm = { ...p0, mode: mo };
  const r1 = run(pm), r2 = run(pm);
  ok(JSON.stringify(r1) === JSON.stringify(r2), mo + ": deterministic (double run byte-identical)");
  ok(r1.paths.length > 0, mo + ": non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
  ok(finiteAll(r1), mo + ": all coordinates finite");
  ok(r1.paths.every((q) => q.pts.length >= 2), mo + ": every path >= 2 points");
  ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), mo + ": integer pen layers");
  ok(npts(r1) < 120000, mo + ": point budget at defaults");
  const tol = 0.5;
  const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) =>
    x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
  ok(inb(r1, 297, 210), mo + ": in bounds on A4 wide");
  ok(inb(run(pm, { W: 210, H: 297 }), 210, 297), mo + ": in bounds on A4 tall");
  /* margin respected: nothing inside the margin band */
  const mtol = 0.3;
  ok(r1.paths.every((q) => q.pts.every(([x, y]) =>
    x >= pm.margin - mtol && x <= 297 - pm.margin + mtol && y >= pm.margin - mtol && y <= 210 - pm.margin + mtol)),
    mo + ": margin band stays blank");
  /* seed liveness where the mode is seeded (Pleat is a regular grid by design) */
  if (mo !== "Pleat") {
    ok(JSON.stringify(run({ ...pm, seed: pm.seed + 17 })) !== JSON.stringify(r1), mo + ": seed is live");
  }
  if (mo === "Circles") {
    const rr = run({ ...pm, cStyle: "Rings", pitch: 0.6 });
    ok(finiteAll(rr) && npts(rr) <= 120000, "Circles: Rings at min pitch holds budget (" + npts(rr) + " pts)");
  }
}

/* --- every parameter must do something in its owning mode --- */
const OWNER = {
  folds: "Drape", foldDepth: "Drape", bandW: "Drape", bandGap: "Drape", strokeLen: "Drape", fuzz: "Drape",
  poles: "Magnet", poleDist: "Magnet", dashLen: "Magnet", density: "Magnet", falloff: "Magnet",
  gDir: "Grain", wobble: "Grain", wscale: "Grain", voids: "Grain", voidSize: "Grain", push: "Grain", crack: "Grain",
  scaleW: "Scales", rowOver: "Scales", lenVary: "Scales",
  spineAng: "Torn", voidLen: "Torn", voidW: "Torn", vWobble: "Torn", fan: "Torn",
  cellW: "Pleat", cellH: "Pleat", foldP: "Pleat", stagger: "Pleat",
  cMin: "Circles", cMax: "Circles", cGap: "Circles", cStyle: "Circles",
};
const bump = (pd) => {
  if (pd.type === "select") return pd.options.find((o) => o !== pd.def);
  if (pd.type === "check") return !pd.def;
  if (pd.type === "pen") return (pd.def + 1) % 12;
  const span = (pd.max - pd.min) || 1;
  return pd.def === pd.max ? pd.min : Math.min(pd.max, pd.def + span * 0.4);
};
for (const pd of def.params) {
  if (pd.key === "mode" || pd.key === "rayMode" || pd.key === "vClear") continue;
  const mo = OWNER[pd.key] || "Grain";
  const base = { ...p0, mode: mo };
  const bJ = JSON.stringify(run(base));
  const r = run({ ...base, [pd.key]: bump(pd) });
  ok(JSON.stringify(r) !== bJ, "param live in " + mo + ": " + pd.key);
}

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const mo = OWNER[pd.key];
    const r = run({ ...p0, ...(mo ? { mode: mo } : {}), [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* --- degenerate and extreme values hold budget and stay finite --- */
for (const mo of MODES) {
  const lo = { ...p0, mode: mo };
  const hi = { ...p0, mode: mo };
  for (const pd of def.params) {
    if (pd.type !== "slider") continue;
    lo[pd.key] = pd.min;
    hi[pd.key] = pd.max;
  }
  lo.margin = 0; hi.margin = 0; hi.pitch = 0.6;
  const rl = run(lo), rh = run(hi);
  ok(finiteAll(rl), mo + ": min-slider params produce no NaN (" + npts(rl) + " pts)");
  ok(finiteAll(rh) && npts(rh) <= 120000, mo + ": max-density params finite + budget held (" + npts(rh) + " pts)");
  ok(finiteAll(run({ ...p0, mode: mo }, { W: 30, H: 30 })), mo + ": tiny canvas produces no NaN");
  const rz = run({ ...p0, mode: mo, margin: 200 });
  ok(rz.paths.length === 0, mo + ": over-margin returns EMPTY");
}

/* --- wired Void input: true polygon cut in every mode --- */
const star = [];
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 ? 18 : 42;
  star.push([148 + Math.cos(a) * r, 105 + Math.sin(a) * r]);
}
const voidIn = { paths: [{ pts: star, closed: true, layer: 0 }] };
const inPoly = (pts, x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/* mutation smoke: the oracle itself must catch an uncut fill */
{
  const rNo = run({ ...p0, mode: "Pleat" });
  const hits = rNo.paths.reduce((a, q) => a + q.pts.filter((pt) => inPoly(star, pt[0], pt[1])).length, 0);
  ok(hits > 50, "oracle smoke: uncut fill has points inside the star (" + hits + ")");
}
for (const mo of MODES) {
  const r = run({ ...p0, mode: mo }, undefined, [undefined, voidIn]);
  const inside = r.paths.reduce((a, q) => a + q.pts.filter((pt) => inPoly(star, pt[0], pt[1])).length, 0);
  ok(inside === 0, mo + ": wired void cuts all points out (inside=" + inside + ")");
  ok(r.paths.length > 0, mo + ": still draws around the wired void (" + r.paths.length + " paths)");
}
/* Torn + wired path: rays radiate out of the shape */
{
  const blob = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = 30 * (1 + 0.3 * Math.sin(a * 3));
    blob.push([150 + Math.cos(a) * r * 1.3, 100 + Math.sin(a) * r]);
  }
  const blobIn = { paths: [{ pts: blob, closed: true, layer: 0 }] };
  const rA = run({ ...p0, mode: "Torn", rayMode: "From center" }, undefined, [undefined, blobIn]);
  const rB = run({ ...p0, mode: "Torn", rayMode: "Perpendicular" }, undefined, [undefined, blobIn]);
  ok(rA.paths.length > 50 && finiteAll(rA), "Torn wired: From center draws rays (" + rA.paths.length + ")");
  ok(rB.paths.length > 50 && finiteAll(rB), "Torn wired: Perpendicular draws rays (" + rB.paths.length + ")");
  ok(JSON.stringify(rA) !== JSON.stringify(rB), "Torn wired: rayMode is live");
  const insA = rA.paths.reduce((a, q) => a + q.pts.filter((pt) => inPoly(blob, pt[0], pt[1])).length, 0);
  ok(insA === 0, "Torn wired: no ray points inside the shape (inside=" + insA + ")");
  const wave = [];
  for (let x = 60; x <= 240; x += 3) wave.push([x, 105 + 22 * Math.sin((x - 60) * 0.05)]);
  const lineIn = { paths: [{ pts: wave, closed: false, layer: 0 }] };
  const rL = run({ ...p0, mode: "Torn", rayMode: "Perpendicular" }, undefined, [undefined, lineIn]);
  ok(rL.paths.length > 50 && finiteAll(rL), "Torn wired open line: draws rays (" + rL.paths.length + ")");
  const above = rL.paths.some((q) => q.pts.some((pt) => pt[1] < 60));
  const below = rL.paths.some((q) => q.pts.some((pt) => pt[1] > 150));
  ok(above && below, "Torn wired open line: rays on both sides");
  const rLr = run({ ...p0, mode: "Torn", rayMode: "From center" }, undefined, [undefined, lineIn]);
  ok(rLr.paths.length > 20 && finiteAll(rLr), "Torn wired open line: From center draws (" + rLr.paths.length + ")");
  const d1 = JSON.stringify(run({ ...p0, mode: "Torn" }, undefined, [undefined, blobIn]));
  const d2 = JSON.stringify(run({ ...p0, mode: "Torn", seed: p0.seed + 9 }, undefined, [undefined, blobIn]));
  ok(d1 !== d2, "Torn wired: seed wobbles the rays");
}
/* wired voids replace the built-in Grain voids */
{
  const seen = JSON.stringify(run({ ...p0, mode: "Grain", voids: 5 }, undefined, [undefined, voidIn]));
  const seen2 = JSON.stringify(run({ ...p0, mode: "Grain", voids: 0 }, undefined, [undefined, voidIn]));
  ok(seen === seen2, "Grain: built-in voids are ignored while Void is wired");
}
/* open input paths occupy a clearance band, Negative Space style */
{
  const wavePts = [];
  for (let x = 50; x <= 250; x += 2) wavePts.push([x, 105 + 30 * Math.sin((x - 50) * 0.04)]);
  const open = { paths: [{ pts: wavePts, closed: false, layer: 0 }] };
  const segD = (x, y) => {
    let dm = Infinity;
    for (let i = 1; i < wavePts.length; i++) {
      const ax = wavePts[i - 1][0], ay = wavePts[i - 1][1], bx2 = wavePts[i][0], by2 = wavePts[i][1];
      const dx = bx2 - ax, dy = by2 - ay;
      const L2 = dx * dx + dy * dy;
      const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
      const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
      if (d < dm) dm = d;
    }
    return dm;
  };
  for (const mo of MODES) {
    const r = run({ ...p0, mode: mo, vClear: 3 }, undefined, [undefined, open]);
    const viol = r.paths.reduce((a, q) => a + q.pts.filter((pt) => segD(pt[0], pt[1]) < 3 - 0.35).length, 0);
    ok(viol === 0 && r.paths.length > 0, mo + ": open line carves a clearance band (violations=" + viol + ", " + r.paths.length + " paths)");
  }
  const rA = JSON.stringify(run({ ...p0, mode: "Pleat", vClear: 0 }));
  const rB = JSON.stringify(run({ ...p0, mode: "Pleat", vClear: 0 }, undefined, [undefined, open]));
  ok(rA === rB, "open line with zero clearance leaves the fill untouched (Pleat)");
  const w2 = JSON.stringify(run({ ...p0, mode: "Pleat", vClear: 2 }, undefined, [undefined, open]));
  const w8 = JSON.stringify(run({ ...p0, mode: "Pleat", vClear: 8 }, undefined, [undefined, open]));
  ok(w2 !== w8, "vClear is live when a void is wired");
  const g1 = JSON.stringify(run({ ...p0, mode: "Grain", push: 0.2 }, undefined, [undefined, open]));
  const g2 = JSON.stringify(run({ ...p0, mode: "Grain", push: 0.9 }, undefined, [undefined, open]));
  ok(g1 !== g2, "Grain: open line deflection responds to Flow push");
}
/* closed voids keep a clearance halo around their edges too */
{
  const edgeD = (x, y) => {
    let dm = Infinity;
    for (let i = 0, j = star.length - 1; i < star.length; j = i++) {
      const ax = star[j][0], ay = star[j][1], bx2 = star[i][0], by2 = star[i][1];
      const dx = bx2 - ax, dy = by2 - ay;
      const L2 = dx * dx + dy * dy;
      const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
      const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
      if (d < dm) dm = d;
    }
    return dm;
  };
  const r = run({ ...p0, mode: "Pleat", vClear: 3 }, undefined, [undefined, voidIn]);
  const viol = r.paths.reduce((a, q) => a + q.pts.filter((pt) => edgeD(pt[0], pt[1]) < 3 - 0.35).length, 0);
  ok(viol === 0, "closed void edges keep the clearance halo (violations=" + viol + ")");
}

/* --- style passthrough --- */
{
  const r = run(p0);
  ok(r && Array.isArray(r.paths), "returns a path set through applyStyle");
}

/* --- showIf visibility --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  for (const mo of MODES) {
    const v = vis({ ...p0, mode: mo });
    const owned = Object.keys(OWNER).filter((k) => OWNER[k] === mo);
    ok(owned.every((k) => v.includes(k)), mo + ": showIf reveals all " + owned.length + " own params");
    const foreign = Object.keys(OWNER).filter((k) => OWNER[k] !== mo);
    ok(foreign.every((k) => !v.includes(k)), mo + ": showIf hides all foreign params");
  }
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined),
    "showIf: hidden params still carry defaults");
}

/* --- overlay --- */
{
  const g1 = def.overlay({ ...p0, mode: "Magnet" }, { W: 297, H: 210 }, undefined);
  ok(Array.isArray(g1) && g1.some((g) => g.kind === "point"), "overlay: Magnet shows pole points");
  const g2 = def.overlay({ ...p0, mode: "Torn" }, { W: 297, H: 210 }, undefined);
  ok(g2.some((g) => g.kind === "arrow"), "overlay: Torn shows the spine arrow");
  const g3 = def.overlay({ ...p0, mode: "Grain" }, { W: 297, H: 210 }, undefined);
  ok(g3.some((g) => g.kind === "circle"), "overlay: Grain shows built-in voids");
  const g4 = def.overlay({ ...p0, mode: "Grain" }, { W: 297, H: 210 }, [undefined, voidIn]);
  ok(g4.some((g) => g.kind === "poly"), "overlay: wired void paths shown as poly guides");
  let threw = false;
  try {
    def.overlay({ ...p0 }, { W: 4, H: 4 }, undefined, undefined);
    def.overlay({}, undefined, undefined, undefined);
  } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
