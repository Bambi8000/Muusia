/* Validator for the Stripe Discs node. Run from the repo root:
   node tools/validate-stripediscs.mjs
   First line tells you which source was tested - read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "stripediscs";

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
const run = (p, inp, ctx) => def.compute([inp], p, ctx || CTX, {});
const discsOf = (p, ctx) => def._discs(p, ctx || CTX);
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();

/* --- static shape --- */
ok(def.cat === "mod" && def.group === "deform", "cat mod / group deform");
ok(def.ins.length === 1 && def.ins[0].type === "paths", "one optional paths input");
ok(typeof def._discs === "function", "_discs shared helper present (compute + overlay)");
ok(typeof def.desc === "string" && def.desc.length > 200, "desc present");

/* --- universal invariants (unwired: built-in stripes) --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 0.05;
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) => x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 297, 210, p0.margin), "built-in stripes stay inside the margin box (A4 wide)");
ok(inb(run(p0, undefined, { W: 210, H: 297 }), 210, 297, p0.margin), "built-in stripes stay inside the margin box (A4 tall)");

/* --- geometry oracles at defaults --- */
{
  const D = discsOf(p0);
  ok(D.length === p0.cols * p0.rows, "grid: cols x rows discs (" + D.length + ")");
  ok(r1.paths.every((q) => q.pts.length === 2), "straight stripes stay 2-point lines after clipping + rotation");
  const which = (pt) => { for (let i = 0; i < D.length; i++) if (Math.hypot(pt[0] - D[i][0], pt[1] - D[i][1]) < D[i][2] - 1e-6) return i; return -1; };
  let insideOK = true, outsideOK = true, angleOK = true, nIn = 0, nOut = 0;
  for (const q of r1.paths) {
    const a = q.pts[0], b = q.pts[1], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const di = which(mid);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const norm = (v) => { v = ((v % Math.PI) + Math.PI) % Math.PI; return Math.min(v, Math.PI - v); };
    if (di >= 0) {
      nIn++;
      const d = D[di];
      if (Math.hypot(a[0] - d[0], a[1] - d[1]) > d[2] + 1e-3 || Math.hypot(b[0] - d[0], b[1] - d[1]) > d[2] + 1e-3) insideOK = false;
      const expect = Math.PI / 2 + d[3];   /* vertical stripes rotated by the disc angle */
      if (norm(ang - expect) > 1e-3) angleOK = false;
    } else {
      nOut++;
      if (Math.abs(a[0] - b[0]) > 1e-6) angleOK = false;   /* untouched stripes are vertical */
      for (const dd of D) { const t = 0.5; const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t; if (Math.hypot(px - dd[0], py - dd[1]) < dd[2] - 1e-3) outsideOK = false; }
    }
  }
  ok(nIn > 0 && nOut > 0, "both rotated (inside) and untouched (outside) runs exist (" + nIn + " / " + nOut + ")");
  ok(insideOK, "every rotated run lies entirely inside its disc");
  ok(outsideOK, "no untouched run passes through a disc");
  ok(angleOK, "inside runs are rotated by exactly the disc angle, outside runs keep the stripe angle");
  /* rim continuity: every rotated run endpoint on the rim has an outside endpoint within the stripe spacing */
  const rimPts = (inside) => { const out = []; for (const q of r1.paths) { const mid = [(q.pts[0][0] + q.pts[1][0]) / 2, (q.pts[0][1] + q.pts[1][1]) / 2]; if ((which(mid) >= 0) !== inside) continue; for (const pt of q.pts) for (const d of D) if (Math.abs(Math.hypot(pt[0] - d[0], pt[1] - d[1]) - d[2]) < 1e-3) out.push(pt); } return out; };
  const ri = rimPts(true), ro = rimPts(false);
  ok(ri.length > 20 && ro.length > 20, "runs terminate exactly on the rims (" + ri.length + " inside, " + ro.length + " outside rim points)");
  /* Rows mode: discs in the same grid row share an angle, rows differ by stepA */
  const rowsA = [...new Set(D.map((d) => Math.round(d[3] * 1e6)))];
  ok(rowsA.length === p0.rows, "Rows mode: one angle per row (" + rowsA.length + ")");
}
/* gap: nothing inside the annulus */
{
  const pg = { ...p0, gap: 2 };
  const D = discsOf(pg), r = run(pg);
  let clear = true;
  for (const q of r.paths) for (const pt of q.pts) for (const d of D) { const dist = Math.hypot(pt[0] - d[0], pt[1] - d[1]); if (dist > d[2] - 2 + 1e-3 && dist < d[2] + 2 - 1e-3) clear = false; }
  ok(clear, "gap 2: no point inside the 2 mm annulus around any rim");
}
/* rim: adds exactly one closed path per disc */
{
  const a = run(p0), b = run({ ...p0, rim: true });
  ok(b.paths.filter((q) => q.closed).length === discsOf(p0).length && a.paths.filter((q) => q.closed).length === 0, "Rim draws one closed circle per disc");
}
/* disc pen recolours only the rotated runs */
{
  const r = run({ ...p0, penMode: "Disc pen", penDisc: 4 });
  const D = discsOf(p0);
  const which = (pt) => D.some((d) => Math.hypot(pt[0] - d[0], pt[1] - d[1]) < d[2] - 1e-6);
  ok(r.paths.every((q) => (q.layer === 4) === which([(q.pts[0][0] + q.pts[1][0]) / 2, (q.pts[0][1] + q.pts[1][1]) / 2])), "Disc pen: rotated runs on pen 4, the rest on the stripe pen");
}
/* angle 0 / step 0: discs vanish into the field (all runs vertical) */
ok(run({ ...p0, angle: 0, stepA: 0 }).paths.every((q) => Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-6), "angle 0, step 0: nothing rotates, every run stays vertical");
/* random layout: discs do not overlap and stay in the margin box */
{
  const pr = { ...p0, layout: "Random", count: 20, radius: 25 };
  const D = discsOf(pr);
  let sep = true, inbox = true;
  for (let i = 0; i < D.length; i++) { const d = D[i]; if (d[0] - d[2] < pr.margin - 1e-6 || d[0] + d[2] > 297 - pr.margin + 1e-6 || d[1] - d[2] < pr.margin - 1e-6 || d[1] + d[2] > 210 - pr.margin + 1e-6) inbox = false; for (let j = i + 1; j < D.length; j++) if (Math.hypot(d[0] - D[j][0], d[1] - D[j][1]) < d[2] + D[j][2] + 1 - 1e-6) sep = false; }
  ok(D.length > 4 && sep, "Random layout: discs pairwise separated (" + D.length + " placed of 20)");
  ok(inbox, "Random layout: discs inside the margin box");
  ok(discsOf({ ...pr, seed: 6 }).length > 0 && JSON.stringify(discsOf({ ...pr, seed: 6 })) !== JSON.stringify(D), "Random layout: seed moves the discs");
}
/* wired field: consumed instead of stripes, never mutated, budget held */
{
  const circles = { paths: [] };
  for (let rr = 8; rr < 160; rr += 4) { const pts = []; for (let i = 0; i < 120; i++) { const a = (i / 120) * Math.PI * 2; pts.push([148.5 + Math.cos(a) * rr, 105 + Math.sin(a) * rr]); } circles.paths.push({ pts, closed: true, layer: 1 }); }
  const snap = JSON.stringify(circles);
  const r = run(p0, circles);
  ok(r.paths.length > 0 && finiteAll(r), "wired field renders (" + r.paths.length + " paths)");
  ok(JSON.stringify(circles) === snap, "wired field is not mutated");
  ok(r.paths.every((q) => q.layer === 1), "wired field keeps its own pen");
  ok(r.paths.some((q) => q.pts.length > 2), "curved wired field keeps its curvature (multi-point runs)");
  ok(run(p0, { paths: [] }).paths.length === r1.paths.length, "EMPTY input falls back to the built-in stripes");
  ok(finiteAll(run(p0, { paths: [{ pts: [[0, 0]], closed: false, layer: 0 }, { pts: [[10, 10], [10, 10]], closed: false, layer: 0 }] })), "degenerate wired paths (1 point, zero length) do not crash");
}

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => { const b = base ? JSON.stringify(run(base)) : bJ; ok(JSON.stringify(run({ ...(base || p0), ...patch })) !== b, "param live: " + label); };
diff({ spacing: 4 }, "spacing"); diff({ stripeAngle: 60 }, "stripeAngle"); diff({ layout: "Random" }, "layout");
diff({ cols: 4 }, "cols"); diff({ rows: 2 }, "rows"); diff({ jitter: 0.4 }, "jitter"); diff({ radius: 15 }, "radius");
diff({ mode: "Progressive" }, "mode"); diff({ angle: 45 }, "angle"); diff({ stepA: 10 }, "stepA"); diff({ gap: 1 }, "gap");
diff({ rim: true }, "rim"); diff({ margin: 20 }, "margin"); diff({ seed: 9 }, "seed"); diff({ layer: 3 }, "layer");
diff({ penMode: "Disc pen" }, "penMode"); diff({ penDisc: 5 }, "penDisc", { ...p0, penMode: "Disc pen" });
const rb = { ...p0, layout: "Random" };
diff({ count: 3 }, "count (Random)", rb); diff({ radVar: 0 }, "radVar (Random)", rb);

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) {
  const r = run({ ...p0, [pd.key]: opt });
  ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, spacing: 0.8, cols: 1, rows: 1, radius: 3, jitter: 0, gap: 6, margin: 0 })), "degenerate params produce no NaN");
const ext = run({ ...p0, spacing: 0.8, cols: 10, rows: 10, radius: 120, gap: 0, rim: true, margin: 0, stripeAngle: 37 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
ok(finiteAll(run({ ...p0, layout: "Random", count: 40, radius: 120, radVar: 0.8 })), "Random with oversized radius: finite (discs that cannot fit are skipped)");
const wild = run({ ...p0, spacing: -5, cols: 999, rows: -3, radius: 1e6, angle: 1e5, stepA: -1e4, gap: -9, margin: 500, seed: -2, layer: 40, count: 1e4 });
ok(finiteAll(wild) && npts(wild) <= 120000, "wired-out-of-range values: finite + budget held (" + npts(wild) + " pts)");
ok(finiteAll(run(p0, undefined, { W: 4, H: 4 })), "tiny canvas: finite");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(vis(p0).includes("cols") && !vis({ ...p0, layout: "Random" }).includes("cols") && vis({ ...p0, layout: "Random" }).includes("count"), "showIf: Grid shows cols/rows, Random shows count");
ok(vis(p0).includes("stepA") && !vis({ ...p0, mode: "Noise" }).includes("stepA"), "showIf: stepA hidden for Random / Noise rotation");
ok(!vis(p0).includes("penDisc") && vis({ ...p0, penMode: "Disc pen" }).includes("penDisc"), "showIf: penDisc only with Disc pen");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");

/* --- overlay --- */
{
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1[0].kind === "rect" && g1.filter((g) => g.kind === "circle").length === p0.cols * p0.rows, "overlay: margin rect + one circle per disc");
  const D = discsOf(p0), gc = g1.filter((g) => g.kind === "circle");
  ok(gc.every((g, i) => Math.abs(g.cx - D[i][0]) < 1e-9 && Math.abs(g.r - D[i][2]) < 1e-9), "overlay circles match compute's discs exactly");
  let threw = false;
  try { def.overlay({ ...p0, margin: 999 }, { W: 4, H: 4 }, undefined, undefined); def.overlay(undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
