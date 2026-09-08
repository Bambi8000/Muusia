/* Validator for galaxy.
   Structure oracles: face-on (pitch 90) the bulge is centrally concentrated
   and the arms show m-fold angular clustering that loosens with Arm spread;
   edge-on (pitch 0) the disc is thin; the bounding-sphere scaling is
   rotation-invariant so orbiting never changes the footprint.
   Run from the repo root: node tools/validate-galaxy.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "galaxy";

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

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const CTX = { W: 210, H: 297 };
const run = (p, ctx) => def.compute([undefined], p, ctx || CTX);
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const centers = (r, pen) => r.paths
  .filter((q) => pen === undefined || q.layer === pen)
  .map((q) => q.pts.reduce((a, b2) => [a[0] + b2[0] / q.pts.length, a[1] + b2[1] / q.pts.length], [0, 0]));

const p0 = defaults();

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
OK(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
OK(r1.paths.length > 500, "non-empty at defaults (" + r1.paths.length + " dots, " + npts(r1) + " pts)");
OK(finiteAll(r1), "all coordinates finite");
OK(r1.paths.every((q) => q.closed && q.pts.length >= 5), "Circle dots are closed rings >= 5 pts");
OK(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
OK(npts(r1) < 120000, "point budget at defaults (" + npts(r1) + ")");
OK(r1.paths.every((q) => q.pts.every(([x, y]) => x >= p0.margin - 0.01 && x <= 210 - p0.margin + 0.01 && y >= p0.margin - 0.01 && y <= 297 - p0.margin + 0.01)),
  "all dots inside the margin box");
{
  const pens = new Set(r1.paths.map((q) => q.layer));
  OK(pens.has(0) && pens.has(1) && pens.has(2), "all three pens present at defaults (" + [...pens].join(",") + ")");
}

/* --- oracle: face-on structure --- */
const faceOn = { ...p0, pitch: 90, persp: 0, yaw: 0, halo: 0, grow: 0 };
{
  const r = run(faceOn);
  const core = centers(r, Math.round(p0.corepen));
  const arm = centers(r, Math.round(p0.armpen));
  const rad = (c) => Math.hypot(c[0] - 105, c[1] - 148.5);
  const med = (a) => { const s = a.map(rad).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  OK(core.length > 100 && arm.length > 300, "face-on: core and arm populations (" + core.length + "/" + arm.length + ")");
  OK(med(core) < med(arm) * 0.45, "bulge concentrated: median core radius << arm radius (" + med(core).toFixed(1) + " vs " + med(arm).toFixed(1) + "mm)");
}
/* m-fold angular clustering in a narrow radius band, tight vs loose arms */
function armConcentration(armw) {
  const r = run({ ...faceOn, armw, sparkle: 0 });
  const arm = centers(r, Math.round(p0.armpen));
  const rmax = Math.max(...arm.map((c) => Math.hypot(c[0] - 105, c[1] - 148.5)));
  let re = 0, im = 0, n = 0;
  for (const c of arm) {
    const rr = Math.hypot(c[0] - 105, c[1] - 148.5);
    if (rr < rmax * 0.2 || rr > rmax * 0.85) continue;
    /* de-rotate by the expected spiral phase so the m-fold clustering
       is measured in the arm frame, not smeared by the winding */
    const th = Math.atan2(c[1] - 148.5, c[0] - 105) + p0.twist * 2 * Math.PI * Math.sqrt(rr / rmax);
    re += Math.cos(p0.arms * th); im += Math.sin(p0.arms * th); n++;
  }
  return n > 100 ? Math.hypot(re, im) / n : -1;
}
{
  const tight = armConcentration(0.05), loose = armConcentration(0.6);
  OK(tight > 0.6, "tight arms: strong m-fold clustering (" + tight.toFixed(2) + ")");
  OK(loose >= 0 && loose < 0.35, "loose arms: clustering washes out (" + loose.toFixed(2) + ")");
  OK(tight > loose + 0.2, "arm spread is live and monotone (" + tight.toFixed(2) + " > " + loose.toFixed(2) + ")");
}

/* --- oracle: edge-on disc is thin --- */
{
  const r = run({ ...p0, pitch: 0, persp: 0, halo: 0, bulge: 0, grow: 0, flat: 6 });
  const cs = centers(r);
  const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
  const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
  OK(spanY < spanX * 0.45, "edge-on: thin disc (y span " + spanY.toFixed(0) + " vs x span " + spanX.toFixed(0) + "mm)");
}

/* --- oracle: rotation-invariant footprint --- */
{
  const ext = (r) => {
    const cs = centers(r);
    return Math.max(...cs.map((c) => Math.hypot(c[0] - 105, c[1] - 148.5)));
  };
  const e1 = ext(run({ ...p0, yaw: 0, persp: 0 }));
  const e2 = ext(run({ ...p0, yaw: 137, persp: 0 }));
  const e3 = ext(run({ ...p0, yaw: 137, pitch: -20, persp: 0 }));
  const mx = Math.max(e1, e2, e3), mn = Math.min(e1, e2, e3);
  OK(mx - mn < mx * 0.12, "orbit keeps footprint (" + mn.toFixed(1) + ".." + mx.toFixed(1) + "mm)");
}

/* --- sparkle fraction --- */
{
  const r = run({ ...p0, sparkle: 30, halo: 0 });
  const spk = r.paths.filter((q) => q.layer === Math.round(p0.sparklepen)).length;
  const armN = r.paths.filter((q) => q.layer === Math.round(p0.armpen)).length;
  const frac = spk / (spk + armN);
  OK(Math.abs(frac - 0.3) < 0.06, "sparkle 30% lands ~30% of disc stars on sparkle pen (" + (frac * 100).toFixed(1) + "%)");
}

/* --- parameter liveness --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => OK(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ stars: 800 }, "stars");
diff({ arms: 5 }, "arms");
diff({ twist: 3.5 }, "twist");
diff({ armw: 0.5 }, "armw");
diff({ bulge: 50 }, "bulge");
diff({ bulger: 30 }, "bulger");
diff({ flat: 25 }, "flat");
diff({ halo: 12 }, "halo");
diff({ yaw: 200 }, "yaw");
diff({ pitch: 0 }, "pitch");
diff({ persp: 0.8 }, "persp");
diff({ size: 50 }, "size");
diff({ dot: 1.5 }, "dot");
diff({ grow: 0 }, "grow");
diff({ shape: "Dash" }, "shape");
diff({ sparkle: 35 }, "sparkle");
diff({ corepen: 5 }, "corepen");
diff({ armpen: 6 }, "armpen");
diff({ sparklepen: 7 }, "sparklepen");
diff({ margin: 30 }, "margin");
diff({ seed: 9 }, "seed");

/* --- dot shapes --- */
{
  const dash = run({ ...p0, shape: "Dash" });
  OK(dash.paths.length > 500 && dash.paths.every((q) => !q.closed && q.pts.length === 2), "Dash: 2-pt open strokes (" + dash.paths.length + ")");
  const pt = run({ ...p0, shape: "Point" });
  OK(pt.paths.every((q) => !q.closed && q.pts.length === 2 && Math.abs(Math.hypot(q.pts[1][0] - q.pts[0][0], q.pts[1][1] - q.pts[0][1]) - 0.1) < 1e-6),
    "Point: 0.1mm pokes (" + pt.paths.length + ")");
  /* face-on dashes are tangential: stroke direction perpendicular to radius */
  const fd = run({ ...faceOn, shape: "Dash", halo: 0, bulge: 0 });
  let tang = 0, n = 0;
  for (const q of fd.paths) {
    const mxp = (q.pts[0][0] + q.pts[1][0]) / 2 - 105, myp = (q.pts[0][1] + q.pts[1][1]) / 2 - 148.5;
    const rr = Math.hypot(mxp, myp);
    if (rr < 15) continue;
    let dx = q.pts[1][0] - q.pts[0][0], dy = q.pts[1][1] - q.pts[0][1];
    const dl = Math.hypot(dx, dy) || 1;
    const cosr = Math.abs((dx * mxp + dy * myp) / (dl * rr));
    if (cosr < 0.25) tang++;
    n++;
  }
  OK(n > 300 && tang / n > 0.9, "Dash streaks are tangential face-on (" + tang + "/" + n + ")");
  for (const opt of def.params.find((q) => q.key === "shape").options) {
    const r = run({ ...p0, shape: opt });
    OK(r.paths.length > 500 && finiteAll(r), "shape '" + opt + "' renders finite (" + r.paths.length + ")");
  }
}

/* --- extremes and degenerates --- */
{
  const ext = run({ ...p0, stars: 4000, dot: 3, grow: 1, persp: 1, size: 120 }, { W: 297, H: 420 });
  for (const sh of ["Circle", "Dash", "Point"]) {
    const e2 = run({ ...p0, shape: sh, stars: 4000, dot: 3 }, { W: 297, H: 420 });
    OK(finiteAll(e2) && npts(e2) <= 120000, "max stars shape " + sh + ": budget (" + npts(e2) + ")");
  }
  OK(finiteAll(ext) && npts(ext) <= 120000, "max params on A3: finite + budget (" + npts(ext) + ")");
  OK(finiteAll(run({ ...p0, stars: 200, bulge: 60, halo: 15 })), "min stars no NaN");
  OK(run({ ...p0, margin: 200 }).paths.length === 0, "margin > canvas: empty, no throw");
  OK(finiteAll(run({ ...p0, pitch: -90 })), "pitch -90 no NaN");
  OK(finiteAll(run({ ...p0, size: 120, persp: 1 })), "size 120 + persp 1: clipped, finite");
  const t0 = performance.now();
  run(p0);
  const ms = performance.now() - t0;
  OK(ms < 400, "compute time sane (" + ms.toFixed(0) + "ms)");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
