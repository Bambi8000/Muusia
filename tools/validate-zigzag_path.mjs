/* Validator for zigzag_path.
   Oracles on a straight horizontal spine with vary=0: Sine output is exactly
   y = amp*sin(2*pi*(s/wl + phase)); Zigzag apexes hit exactly +-amp spaced
   wl/2 apart with linear flanks; Coil runs are perpendicular at wl/2 pitch
   reaching +-amp with rounded caps. A closed circle must wrap seamlessly.
   Run from the repo root: node tools/validate-zigzag_path.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "zigzag_path";

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
const OK = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

const line = (y, x0 = 20, x1 = 180, layer = 0) => ({ pts: [[x0, y], [x1, y]], closed: false, layer });
const circle = (cx, cy, r, nn = 128) => {
  const pts = [];
  for (let i = 0; i < nn; i++) pts.push([cx + r * Math.cos((2 * Math.PI * i) / nn), cy + r * Math.sin((2 * Math.PI * i) / nn)]);
  return { pts, closed: true, layer: 0 };
};

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const CTX = { W: 210, H: 297 };
const run = (p, paths) => def.compute([{ paths }], p, CTX);
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

const p0 = defaults();
const CAL = { ...p0, varyamp: 0, varywl: 0, fade: 0, phase: 0, wl: 8, amp: 4 };

/* --- universal invariants --- */
const r1 = run(p0, [line(100), circle(105, 200, 30)]);
OK(JSON.stringify(r1) === JSON.stringify(run(p0, [line(100), circle(105, 200, 30)])), "deterministic (double run byte-identical)");
OK(r1.paths.length >= 2 && finiteAll(r1), "non-empty + finite (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
OK(npts(r1) < 120000, "point budget (" + npts(r1) + ")");
OK(run(p0, []).paths.length === 0, "empty input -> empty, no throw");

/* --- oracle: Sine on a straight line is an exact sine of s --- */
{
  const r = run({ ...CAL, mode: "Sine" }, [line(100)]);
  OK(r.paths.length === 1 && !r.paths[0].closed, "sine: one open path");
  let maxErr = 0;
  for (const [x, y] of r.paths[0].pts) {
    const s = x - 20;
    maxErr = Math.max(maxErr, Math.abs(y - (100 + 4 * Math.sin((2 * Math.PI * s) / 8))));
  }
  OK(maxErr < 0.03, "sine: exact y = amp*sin(2pi*s/wl) (max err " + maxErr.toFixed(4) + "mm)");
}

/* --- oracle: Zigzag apexes exact, flanks linear --- */
{
  const r = run({ ...CAL, mode: "Zigzag" }, [line(100)]);
  const pts = r.paths[0].pts;
  const apex = pts.filter(([, y]) => Math.abs(Math.abs(y - 100) - 4) < 1e-6);
  OK(apex.length >= 35, "zigzag: exact apex points inserted (" + apex.length + ")");
  const ax = [...new Set(apex.map(([x]) => Math.round(x * 1e6) / 1e6))].sort((a, b2) => a - b2);
  let gapErr = 0;
  for (let i = 1; i < ax.length; i++) gapErr = Math.max(gapErr, Math.abs(ax[i] - ax[i - 1] - 4));
  OK(gapErr < 0.02, "zigzag: apex pitch = wl/2 (max err " + gapErr.toFixed(4) + "mm)");
  /* flank linearity: |dy/dx| = 4*amp/wl = 2 between apexes */
  let slopeErr = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    if (dx < 1e-6) continue;
    slopeErr = Math.max(slopeErr, Math.abs(Math.abs((pts[i][1] - pts[i - 1][1]) / dx) - 2));
  }
  OK(slopeErr < 0.02, "zigzag: flanks straight at 4*amp/wl slope (max dev " + slopeErr.toFixed(4) + ")");
}

/* --- oracle: Coil runs perpendicular at wl/2 pitch, reach +-amp --- */
{
  const r = run({ ...CAL, mode: "Coil" }, [line(100)]);
  const pts = r.paths[0].pts;
  const ys = pts.map(([, y]) => y);
  OK(Math.abs(Math.max(...ys) - 104) < 0.05 && Math.abs(Math.min(...ys) - 96) < 0.05,
    "coil: reaches +-amp (" + Math.min(...ys).toFixed(2) + ".." + Math.max(...ys).toFixed(2) + ")");
  /* vertical runs: consecutive point pairs with same x spanning most of the width */
  let runsN = 0;
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i][0] - pts[i - 1][0]) < 1e-6 && Math.abs(pts[i][1] - pts[i - 1][1]) > 4) runsN++;
  }
  OK(Math.abs(runsN - Math.round(160 / 4)) <= 2, "coil: run count ~ L/(wl/2) (" + runsN + ")");
  const xs = [...new Set(pts.filter((q, i) => i > 0 && Math.abs(pts[i - 1] ? q[0] - pts[Math.max(0, i - 1)][0] : 1) < 1e-6).map((q) => Math.round(q[0] * 100) / 100))].sort((a, b2) => a - b2);
  let pitchErr = 0;
  for (let i = 1; i < xs.length; i++) pitchErr = Math.max(pitchErr, Math.abs(xs[i] - xs[i - 1] - 4));
  OK(pitchErr < 0.05, "coil: run pitch = wl/2 (max err " + pitchErr.toFixed(3) + "mm)");
  OK(pts.some(([, y]) => y > 102 && y < 103.9) && pts.some(([, y]) => y < 98 && y > 96.1), "coil: rounded caps sampled");
}

/* --- closed path wraps seamlessly --- */
{
  const r = run({ ...CAL, mode: "Sine" }, [circle(105, 150, 30)]);
  OK(r.paths.length === 1 && r.paths[0].closed, "closed input -> closed output");
  const pts = r.paths[0].pts;
  const rads = pts.map(([x, y]) => Math.hypot(x - 105, y - 150));
  /* the wrap jump may not exceed the steepest legitimate sine flank over the
     closing gap: slope_max = 2*pi*amp/wl */
  const gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  const seam = Math.abs(rads[0] - rads[rads.length - 1]);
  const seamMax = (2 * Math.PI * CAL.amp / CAL.wl) * gap * 1.3 + 0.05;
  OK(seam <= seamMax, "closed sine: wrap continuous within flank slope (seam " + seam.toFixed(3) + " <= " + seamMax.toFixed(3) + "mm over " + gap.toFixed(2) + "mm gap)");
  OK(Math.max(...rads) > 33 && Math.min(...rads) < 27, "closed sine: wave actually swings");
}

/* --- layer inheritance + per-path variation --- */
{
  const r = run(p0, [line(100, 20, 180, 7), line(120, 20, 180, 3)]);
  OK(r.paths[0].layer === 7 && r.paths[1].layer === 3, "layers inherited per path");
  const y0 = r.paths[0].pts.map(([x, y]) => [x, y - 100]);
  const y1 = r.paths[1].pts.map(([x, y]) => [x, y - 120]);
  OK(JSON.stringify(y0) !== JSON.stringify(y1), "parallel paths get different organic variation");
}

/* --- parameter liveness --- */
const base = run(p0, [line(100)]);
const bJ = JSON.stringify(base);
const diff = (patch, label, paths) => OK(JSON.stringify(run({ ...p0, ...patch }, paths || [line(100)])) !== bJ, "param live: " + label);
diff({ mode: "Sine" }, "mode");
diff({ wl: 12 }, "wl");
diff({ amp: 8 }, "amp");
diff({ varyamp: 0.9 }, "varyamp");
diff({ varywl: 0.9 }, "varywl");
diff({ phase: 0.4 }, "phase");
diff({ keepsrc: true }, "keepsrc");
diff({ seed: 99 }, "seed (vary on at defaults)");
{
  const a = JSON.stringify(run({ ...p0, varyamp: 0.9, varylen: 10 }, [line(100)]));
  const b2 = JSON.stringify(run({ ...p0, varyamp: 0.9, varylen: 120 }, [line(100)]));
  OK(a !== b2, "param live: varylen");
  const t1 = run({ ...p0, fade: 12, varyamp: 0, varywl: 0 }, [line(100)]);
  const t0 = run({ ...p0, fade: 0, varyamp: 0, varywl: 0 }, [line(100)]);
  OK(JSON.stringify(t1) !== JSON.stringify(t0), "param live: fade");
  const ay = t1.paths[0].pts.filter(([x]) => x < 22).map(([, y]) => Math.abs(y - 100));
  OK(Math.max(...ay, 0) < 0.35, "fade: amplitude ~0 near the start");
  const cf = run({ ...p0, mode: "Coil", fade: 15, varyamp: 0, varywl: 0, wl: 4, amp: 5 }, [line(100)]);
  const tipY = cf.paths[0].pts.filter(([x]) => x < 24).map(([, y]) => Math.abs(y - 100));
  const midY = cf.paths[0].pts.filter(([x]) => x > 90 && x < 110).map(([, y]) => Math.abs(y - 100));
  OK(Math.max(...tipY, 0) < Math.max(...midY, 1) * 0.5, "coil fade: runs shrink toward the tip (" + Math.max(...tipY, 0).toFixed(1) + " vs " + Math.max(...midY, 0).toFixed(1) + "mm)");
}

/* --- closed-path drift wraps seamlessly --- */
{
  const p = { ...p0, mode: "Sine", varyamp: 0.9, varywl: 0, varylen: 30, phase: 0, wl: 6, amp: 4 };
  const r = run(p, [circle(105, 150, 35)]);
  const pts = r.paths[0].pts;
  const off = pts.map(([x, y]) => Math.abs(Math.hypot(x - 105, y - 150) - 35));
  const n2 = off.length;
  const wlPts = Math.round(n2 * (6 / (2 * Math.PI * 35)));
  const aStart = Math.max(...off.slice(0, wlPts * 2));
  const aEnd = Math.max(...off.slice(n2 - wlPts * 2));
  OK(Math.abs(aStart - aEnd) < 1.2, "closed vary-amp: envelope continuous over the seam (" + aStart.toFixed(2) + " vs " + aEnd.toFixed(2) + "mm)");
}

/* --- select options render --- */
for (const opt of def.params.find((q) => q.key === "mode").options) {
  const r = run({ ...p0, mode: opt }, [line(100), circle(105, 200, 25)]);
  OK(r.paths.length >= 2 && finiteAll(r), "mode '" + opt + "' renders finite (" + npts(r) + " pts)");
}

/* --- degenerates and budget --- */
{
  OK(run(p0, [{ pts: [[50, 50]], closed: false, layer: 0 }]).paths.length === 1, "1-pt path passes through");
  OK(run(p0, [{ pts: [[50, 50], [50.2, 50]], closed: false, layer: 0 }]).paths.length === 1, "tiny path passes through, no throw");
  const many = [];
  for (let i = 0; i < 60; i++) many.push(line(15 + i * 4.5));
  const dense = run({ ...p0, mode: "Coil", wl: 1, amp: 2 }, many);
  OK(finiteAll(dense) && npts(dense) <= 120000, "dense coil grid: finite + budget (" + npts(dense) + ")");
  OK(finiteAll(run({ ...p0, wl: 1, amp: 20, varywl: 1, varyamp: 1 }, [circle(105, 150, 40)])), "extreme vary no NaN");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
