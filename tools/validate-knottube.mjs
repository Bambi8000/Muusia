/* Validator for the Knot Tube node (key "knottube").
   Run from the repo root: node tools/validate-knottube.mjs
   First line says [lab] or [baked] - READ IT.

   Four oracles, each aimed at a failure this node actually had:

   1. VISIBILITY. Re-derived independently: the tube is the boundary of the
      union of spheres along the spine, so for an orthographic camera a point
      is hidden exactly when some sphere's near surface is in front of it. The
      oracle scans every sphere in a plain O(n) loop, sharing none of the node's
      hashing, and the two must agree on how much of the surface survives.

   2. NO FOLDING. The radius must stay under the local curvature radius and
      must not change faster than the surface can follow. Break either and the
      tube's own wall ends up inside its body, every point reports as hidden
      and the drawing dissolves. Both are measured from the built spine.

   3. THE ENVELOPE. Where the radius varies, the boundary circle is pulled back
      along the tangent and shrunk - the naive perpendicular circle dips inside
      the neighbouring spheres and the surface comes out as torn shreds. The
      oracle checks the drawn circles are ON the union's boundary, not inside.

   4. THE SEAM. Parallel transport around a closed loop returns rotated by a
      holonomy angle. Unless that is measured and spread over the loop, and the
      turn count rounded to a whole number, the winding fails to rejoin itself
      and leaves a visible scar. Tested as a geometric closure. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "knottube";

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
const A4 = { W: 297, H: 210 };
const run = (patch, ctx) => def.compute([undefined], { ...p0, ...(patch || {}) }, ctx || A4, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const inb = (r, W, Hh, tol) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
const CURVES = def.params.find((q) => q.key === "curve").options;
const SURFACES = def.params.find((q) => q.key === "surface").options;

/* --- descriptor contract --- */
for (const pd of def.params) {
  if (pd.type === "select") ok(Array.isArray(pd.options) && pd.options.length > 0, "select '" + pd.key + "' uses options[]");
  if (pd.type === "slider") ok([pd.min, pd.max, pd.step, pd.def].every(Number.isFinite), "slider '" + pd.key + "' has finite min/max/step/def");
}
ok(typeof def._build === "function", "_build is shared by compute and overlay");
ok(typeof def.overlay === "function", "node ships an overlay");

/* --- universal invariants --- */
const r1 = run(), r2 = run();
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
ok(inb(r1, 297, 210, 0.6), "in bounds on A4 wide");
ok(inb(run({}, { W: 210, H: 297 }), 210, 297, 0.6), "in bounds on A4 tall");
for (const c of CURVES) for (const s of SURFACES) {
  const r = run({ curve: c, surface: s });
  ok(r.paths.length > 0 && finiteAll(r) && inb(r, 297, 210, 0.6), "draws in bounds: " + c + " / " + s);
}

/* ---------------------------------------------------------------- ORACLE 2
   the radius never folds the tube */
for (const c of CURVES) {
  for (const seed of [1, 5, 12, 31]) {
    const B = def._build({ ...p0, curve: c, seed }, A4);
    if (!B || !B.ok) { ok(false, "build failed for " + c + " seed " + seed); continue; }
    const N = B.N;
    let worstK = 0, worstL = 0;
    for (let i = 0; i < N; i++) {
      const a = B.P[(i - 1 + N) % N], b = B.P[i], cc = B.P[(i + 1) % N];
      const ab = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const bc = Math.hypot(cc[0] - b[0], cc[1] - b[1], cc[2] - b[2]);
      const ca = Math.hypot(a[0] - cc[0], a[1] - cc[1], a[2] - cc[2]);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2];
      const px = uy * vz - uz * vy, py = uz * vx - ux * vz, pz = ux * vy - uy * vx;
      const area2 = Math.hypot(px, py, pz);
      if (area2 > 1e-12 && ab * bc * ca > 1e-12) {
        const kap = (2 * area2) / (ab * bc * ca);
        const ratio = B.rr[i] * kap;            /* must stay below 1 */
        if (ratio > worstK) worstK = ratio;
      }
      const ds = bc;
      if (ds > 1e-9) {
        const slope = Math.abs(B.rr[(i + 1) % N] - B.rr[i]) / ds;
        if (slope > worstL) worstL = slope;
      }
    }
    ok(worstK < 0.95, c + " s" + seed + ": radius stays under the curvature radius (worst r*kappa " + worstK.toFixed(3) + ")");
    ok(worstL < 0.95, c + " s" + seed + ": radius is Lipschitz (worst |dr/ds| " + worstL.toFixed(3) + ")");
    ok(B.rr.every((v) => Number.isFinite(v) && v > 0), c + " s" + seed + ": every radius is finite and positive");
  }
}

/* ---------------------------------------------------------------- ORACLE 3
   the drawn circles lie ON the union's boundary, not inside it */
{
  /* Run this where it bites. At the default radius variation the envelope
     correction is a fraction of a millimetre and a naive circle passes; the
     tearing appeared on the pinched knots with the radius swinging hard, so
     that is where the invariant has to be asserted. */
  const CASES = [
    ["defaults", { }],
    ["tangle, full variation", { curve: "Tangle (seeded)", seed: 12, rmod: 0.8 }],
    ["Lissajous, full variation", { curve: "Lissajous", rmod: 0.8 }],
    ["figure-8, fat tube", { curve: "Figure-8 knot", radius: 30, rmod: 0.6 }],
  ];
  for (const [label, patch] of CASES) {
    const B = def._build({ ...p0, ...patch }, A4);
    if (!B || !B.ok) { ok(false, "envelope: build failed for " + label); continue; }
    const N = B.N;
    /* THE ENVELOPE CONDITION, not a penetration test. Measuring how deep a
       surface point sits inside the union cannot work here: two strands of a
       knot fuse on purpose, and a point of one buried inside the other is a
       correct picture of a merged solid. Two earlier versions of this oracle
       measured exactly that fusion and called it a fault.

       The envelope of the sphere family is characterised locally instead. With
       F(s) = |q - P(s)|^2 - r(s)^2, a point q on the boundary of the union
       satisfies F = 0 AND dF/ds = 0 at its own parameter - it touches its
       sphere and touches the neighbours to first order. The naive
       perpendicular circle satisfies the first and fails the second exactly
       when the radius is changing, which is precisely when the surface tore. */
    const Fat = (q, i) => {
      const dx = q[0] - B.P[i][0], dy = q[1] - B.P[i][1], dz = q[2] - B.P[i][2];
      return dx * dx + dy * dy + dz * dz - B.rr[i] * B.rr[i];
    };
    let worst = 0, worstD = 0;
    for (let k = 0; k < 400; k++) {
      const i = Math.floor((k / 400) * N);
      const phi = (k * 2.39996) % (Math.PI * 2);   /* golden angle: no resonance with the frame */
      const c = Math.cos(phi), s = Math.sin(phi);
      const q = [
        B.CC[i][0] + B.CR[i] * (c * B.U[i][0] + s * B.V[i][0]),
        B.CC[i][1] + B.CR[i] * (c * B.U[i][1] + s * B.V[i][1]),
        B.CC[i][2] + B.CR[i] * (c * B.U[i][2] + s * B.V[i][2]),
      ];
      const ip = (i + 1) % N, im = (i - 1 + N) % N;
      const ds = Math.hypot(B.P[ip][0] - B.P[im][0], B.P[ip][1] - B.P[im][1], B.P[ip][2] - B.P[im][2]);
      const f = Math.abs(Fat(q, i)) / (B.rr[i] * B.rr[i]);
      const fp = ds > 1e-9 ? Math.abs(Fat(q, ip) - Fat(q, im)) / ds / (2 * B.rr[i]) : 0;
      if (f > worst) worst = f;
      if (fp > worstD) worstD = fp;
    }
    ok(worst < 0.06, "envelope touches its own sphere: " + label + " (worst |F|/r^2 " + worst.toFixed(4) + ")");
    ok(worstD < 0.10, "envelope is tangent to the neighbours: " + label + " (worst |dF/ds|/2r " + worstD.toFixed(4) + ")");
  }
  /* the correction must actually grow with the variation it corrects for */
  const B2 = def._build(p0, A4);
  const flat = def._build({ ...p0, rmod: 0 }, A4);
  const vary = def._build({ ...p0, rmod: 0.8 }, A4);
  let shiftFlat = 0, shiftVary = 0;
  for (let i = 0; i < B2.N; i++) {
    shiftFlat = Math.max(shiftFlat, Math.hypot(flat.CC[i][0] - flat.P[i][0], flat.CC[i][1] - flat.P[i][1], flat.CC[i][2] - flat.P[i][2]));
    shiftVary = Math.max(shiftVary, Math.hypot(vary.CC[i][0] - vary.P[i][0], vary.CC[i][1] - vary.P[i][1], vary.CC[i][2] - vary.P[i][2]));
  }
  ok(shiftVary > shiftFlat, "the envelope correction grows with radius variation (" + shiftFlat.toFixed(2) + " -> " + shiftVary.toFixed(2) + " mm)");
}

/* ---------------------------------------------------------------- ORACLE 1
   visibility, re-derived with no shared machinery */
{
  const p = { ...p0, strands: 6, turns: 10 };
  const B = def._build(p, A4);
  const N = B.N;
  const hiddenByOracle = (q) => {
    for (let i = 0; i < N; i++) {
      const dx = q[0] - B.P[i][0], dy = q[1] - B.P[i][1];
      const d2 = dx * dx + dy * dy;
      const r = B.rr[i];
      if (d2 >= r * r) continue;
      if (B.P[i][2] + Math.sqrt(r * r - d2) > q[2] + B.rMax * 0.02) return true;
    }
    return false;
  };
  /* rebuild one helix from the geometry and judge it ourselves */
  const steps = 1400;
  let visible = 0, total = 0;
  for (let k = 0; k < steps; k++) {
    const f = k / steps;
    const fi = f * N;
    const i0 = Math.floor(fi) % N, i1 = (i0 + 1) % N, t = fi - Math.floor(fi);
    const phi = f * Math.PI * 2 * 10 - B.hol * f;
    const cx = B.CC[i0][0] + (B.CC[i1][0] - B.CC[i0][0]) * t;
    const cy = B.CC[i0][1] + (B.CC[i1][1] - B.CC[i0][1]) * t;
    const cz = B.CC[i0][2] + (B.CC[i1][2] - B.CC[i0][2]) * t;
    const rr = B.CR[i0] + (B.CR[i1] - B.CR[i0]) * t;
    const ux = B.U[i0][0] + (B.U[i1][0] - B.U[i0][0]) * t, uy = B.U[i0][1] + (B.U[i1][1] - B.U[i0][1]) * t, uz = B.U[i0][2] + (B.U[i1][2] - B.U[i0][2]) * t;
    const vx = B.V[i0][0] + (B.V[i1][0] - B.V[i0][0]) * t, vy = B.V[i0][1] + (B.V[i1][1] - B.V[i0][1]) * t, vz = B.V[i0][2] + (B.V[i1][2] - B.V[i0][2]) * t;
    const c = Math.cos(phi), s = Math.sin(phi);
    const q = [cx + rr * (c * ux + s * vx), cy + rr * (c * uy + s * vy), cz + rr * (c * uz + s * vz)];
    total++;
    if (!hiddenByOracle(q)) visible++;
  }
  const oracleFrac = visible / total;
  const on = npts(run({ ...p, surface: "Right helix" }));
  const off = npts(run({ ...p, surface: "Right helix", hidden: false }));
  const nodeFrac = on / off;
  ok(oracleFrac > 0.2 && oracleFrac < 0.85, "the oracle finds a sensible visible fraction (" + oracleFrac.toFixed(3) + ")");
  ok(Math.abs(nodeFrac - oracleFrac) < 0.12,
    "node and oracle agree on how much survives (node " + nodeFrac.toFixed(3) + " vs oracle " + oracleFrac.toFixed(3) + ")");
  ok(off > on, "Hidden lines off draws strictly more (" + off + " > " + on + ")");
  ok(run({ ...p, hidden: false }).paths.every((q) => q.closed), "with hiding off every winding is a single closed path");
}

/* ---------------------------------------------------------------- ORACLE 4
   the winding rejoins itself: the seam */
for (const c of CURVES) {
  const r = run({ curve: c, hidden: false, surface: "Right helix", strands: 1, turns: 12 });
  const path = r.paths[0];
  ok(!!path && path.closed, c + ": the helix comes back as one closed path");
  if (!path) continue;
  const pts = path.pts;
  const steps = [];
  for (let i = 1; i < pts.length; i++) steps.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  steps.sort((a, b) => a - b);
  const median = steps[Math.floor(steps.length / 2)];
  const seam = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
  ok(seam < median * 2.5, c + ": the seam closes (gap " + seam.toFixed(2) + " mm vs median step " + median.toFixed(2) + ")");
}
{
  /* a fractional turn count cannot close, so it must be rounded away */
  const a = run({ turns: 12, hidden: false, surface: "Right helix", strands: 1 });
  const b = run({ turns: 12.4, hidden: false, surface: "Right helix", strands: 1 });
  ok(JSON.stringify(a) === JSON.stringify(b), "a fractional Turns value is rounded to a whole number");
}

/* --- size is a real millimetre measurement --- */
{
  const extent = (patch) => {
    const r = run(patch);
    const xs = r.paths.flatMap((q) => q.pts.map((pt) => pt[0]));
    const ys = r.paths.flatMap((q) => q.pts.map((pt) => pt[1]));
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  };
  const e60 = extent({ size: 60 }), e120 = extent({ size: 120 });
  ok(e120 > e60 * 1.7 && e120 < e60 * 2.3, "doubling Size doubles the drawing (" + e60.toFixed(1) + " -> " + e120.toFixed(1) + " mm)");
  ok(Math.abs(e120 - 120) < 14, "Size 120 really measures about 120 mm (" + e120.toFixed(1) + ")");
  ok(extent({ size: 280 }) <= 273.6, "an oversized knot is pulled back onto the sheet");
}

/* --- every parameter must do something --- */
{
  const base = JSON.stringify(run());
  const live = (patch, label) => ok(JSON.stringify(run(patch)) !== base, "param live: " + label);
  live({ curve: "Figure-8 knot" }, "curve");
  live({ kp: 5 }, "kp");
  live({ kq: 4 }, "kq");
  live({ size: 110 }, "size");
  live({ radius: 22 }, "radius");
  live({ rmod: 0.7 }, "rmod");
  live({ surface: "Rings" }, "surface");
  live({ turns: 30 }, "turns");
  live({ strands: 8 }, "strands");
  live({ hidden: false }, "hidden");
  live({ yaw: 70 }, "yaw");
  live({ pitch: -40 }, "pitch");
  live({ margin: 45 }, "margin");
  ok(run({ layer: 6 }).paths.every((q) => q.layer === 6), "param live: layer");
  const bL = JSON.stringify(run({ curve: "Lissajous" }));
  for (const k of ["nx", "ny", "nz"]) ok(JSON.stringify(run({ curve: "Lissajous", [k]: 4 })) !== bL, "param live: " + k);
  const bT = JSON.stringify(run({ curve: "Tangle (seeded)" }));
  ok(JSON.stringify(run({ curve: "Tangle (seeded)", harm: 6 })) !== bT, "param live: harm");
  ok(JSON.stringify(run({ curve: "Tangle (seeded)", seed: 12 })) !== bT, "param live: seed (on the seeded curve)");
  const bR = JSON.stringify(run({ surface: "Rings" }));
  ok(JSON.stringify(run({ surface: "Rings", ringGap: 12 })) !== bR, "param live: ringGap");
  const bG = JSON.stringify(run({ surface: "Longitudinals" }));
  ok(JSON.stringify(run({ surface: "Longitudinals", longs: 20 })) !== bG, "param live: longs");
}

/* --- degenerate and extreme --- */
const hostile = [
  [{ radius: 1 }, "hairline tube"],
  [{ radius: 40 }, "fattest tube (curvature will clamp it)"],
  [{ radius: 40, size: 40 }, "fat tube on a tiny knot"],
  [{ size: 40 }, "smallest knot"],
  [{ size: 280, margin: 0 }, "largest knot, no margin"],
  [{ kp: 9, kq: 8 }, "densest torus knot"],
  [{ kp: 2, kq: 2 }, "degenerate p = q (not a knot)"],
  [{ turns: 1, strands: 1 }, "one turn, one strand"],
  [{ turns: 400, strands: 64 }, "turns and strands at the stops"],
  [{ surface: "Rings", ringGap: 1 }, "finest rings"],
  [{ surface: "Longitudinals", longs: 24 }, "most longitudinals"],
  [{ rmod: 0.8 }, "maximum radius variation"],
  [{ pitch: 89 }, "extreme pitch"],
  [{ pitch: 0, yaw: 0 }, "dead-on view"],
  [{ curve: "Lissajous", nx: 9, ny: 9, nz: 9 }, "Lissajous at maximum frequencies"],
  [{ curve: "Tangle (seeded)", harm: 6, seed: 77 }, "richest tangle"],
  [{ margin: 60 }, "maximum margin"],
];
for (const [patch, label] of hostile) {
  const t0 = Date.now();
  const r = run(patch);
  const ms = Date.now() - t0;
  ok(finiteAll(r) && inb(r, 297, 210, 0.6) && npts(r) <= 120000,
    "finite, in bounds, in budget: " + label + " (" + npts(r) + " pts, " + ms + " ms)");
}
{
  const tiny = run({}, { W: 40, H: 30 });
  ok(Array.isArray(tiny.paths) && finiteAll(tiny), "a canvas smaller than the margin returns cleanly");
}

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  for (const c of CURVES) for (const s of SURFACES) {
    let threw = false;
    try { vis({ ...p0, curve: c, surface: s }); } catch (e) { threw = true; }
    ok(!threw, "showIf never throws (" + c + " / " + s + ")");
  }
  ok(vis({ ...p0, curve: "Torus knot" }).indexOf("kp") >= 0, "p and q shown for the torus knot");
  ok(vis({ ...p0, curve: "Lissajous" }).indexOf("kp") < 0, "p hidden for the Lissajous");
  ok(vis({ ...p0, curve: "Tangle (seeded)" }).indexOf("harm") >= 0, "Harmonics shown for the tangle");
  ok(vis({ ...p0, surface: "Rings" }).indexOf("turns") < 0, "Turns hidden for Rings");
  ok(vis({ ...p0, surface: "Longitudinals" }).indexOf("longs") >= 0, "Longitudinals count shown for its own mode");
  ok(vis({ ...p0, surface: "Cross" }).indexOf("ringGap") < 0, "Ring spacing hidden for Cross");
  ok(vis({ ...p0, surface: "Cross + rings" }).indexOf("ringGap") >= 0, "Ring spacing shown for Cross + rings");
  /* hidden rows must be inert, or hiding one conceals a live control */
  const bR = JSON.stringify(run({ surface: "Cross" }));
  ok(JSON.stringify(run({ surface: "Cross", ringGap: 15, longs: 22 })) === bR, "ring and longitudinal params are inert for Cross");
  const bK = JSON.stringify(run({ curve: "Figure-8 knot" }));
  ok(JSON.stringify(run({ curve: "Figure-8 knot", kp: 8, kq: 7, nx: 9, harm: 6 })) === bK, "other curves' params are inert");
}

/* --- overlay --- */
{
  let threw = false, guides = null;
  try { guides = def.overlay(p0, A4); } catch (e) { threw = true; }
  ok(!threw && Array.isArray(guides) && guides.length > 0, "overlay returns guides without throwing");
  ok(guides.every((g) => ["rect", "circle", "point", "arrow", "poly"].includes(g.kind)), "overlay uses only known guide kinds");
  const nums = guides.flatMap((g) => g.kind === "poly" ? g.pts.flat() : Object.values(g).filter((v) => typeof v === "number"));
  ok(nums.every(Number.isFinite), "overlay coordinates are all finite");
  const poly = guides.find((g) => g.kind === "poly");
  ok(!!poly && poly.pts.every(([x, y]) => x >= -1 && x <= 298 && y >= -1 && y <= 211), "the spine guide sits on the sheet");
  for (const bad of [{ margin: 200 }, { size: 0 }, { radius: 0 }, { kp: 0, kq: 0 }]) {
    let t2 = false;
    try { def.overlay({ ...p0, ...bad }, A4); } catch (e) { t2 = true; }
    ok(!t2, "overlay survives " + JSON.stringify(bad));
  }
  let t3 = false;
  try { def.overlay(p0, undefined); } catch (e) { t3 = true; }
  ok(!t3, "overlay survives a missing ctx");
}

/* --- purity --- */
{
  const p = { ...p0 };
  const snap = JSON.stringify(p);
  def.compute([undefined], p, A4, {});
  ok(JSON.stringify(p) === snap, "compute does not mutate the params object");
  const src = String(def.compute) + String(def._build);
  ok(!/Math\.random|document|window|navigator|Date\.now|performance\./.test(src), "no clock, DOM or device API");
  ok(/mulberry32|noise2/.test(src), "randomness comes from seeded helpers");
}

console.log(fails ? "\n" + fails + " FAILURE(S)" : "\nALL OK");
process.exitCode = fails ? 1 : 0;
