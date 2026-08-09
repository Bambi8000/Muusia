/* tools/validate-sweep3d.mjs — Sweep 3D oracles
 *
 * Auto-switches: baked src/defs/nodes/sweep3d.js when present, otherwise
 * nodes-lab/sweep3d.plotternode.js. Run from repo root:
 *   node tools/validate-sweep3d.mjs
 *
 * Oracles:
 *   S1 determinism
 *   S2 instance count == paths (parametric), == instances x subpaths (wired)
 *   S3 analytic centroids: Helix, tilt=0 yaw=0, Circle profile — instance
 *      centroid_x == X + pathW*cos(theta_t), centroid_y == Y - rise*(t-1/2)
 *   S4 taper: End scale 40% -> last/first instance mean radius == 0.40
 *   S5 modulation: cycles=1, amount=50 -> size at t=1/4 is 1.5x t=0 size
 *   S6 twist: Line path (rise 0), Rectangle profile, tilt=0 -> projected
 *      height goes from profile Height (t=0) to profile Width (twist 90)
 *   S7 cone: top view (tilt 90) — last centroid distance from center ==
 *      pathEnd% of first; Flat spiral stays in plane (side view = line)
 *   S8 wired profile: known square normalized into Width/Height box
 *   S9 budget: 800 instances x fine circle stays under the point cap
 *   S10 degenerates: pathW=0+pathD=0, turns=0.25, rise=0, every path and
 *       profile type — no throw, all coords finite
 */
import { readFileSync, existsSync } from "node:fs";
import { Pin, EMPTY, applyStyle } from "../src/defs/helpers.js";

const BAKED = new URL("../src/defs/nodes/sweep3d.js", import.meta.url);
const LAB = new URL("../nodes-lab/sweep3d.plotternode.js", import.meta.url);
let def, mode;
if (existsSync(BAKED)) { def = (await import(BAKED.href)).default; mode = "baked"; }
else { def = eval(readFileSync(LAB, "utf8")); mode = "lab"; }

let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const close = (a, b, t) => Math.abs(a - b) <= t;
const deep = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CTX = { W: 300, H: 200 };
const base = () => { const o = {}; def.params.forEach((pd) => (o[pd.key] = pd.def)); return o; };
const centroid = (pa) => {
  let sx = 0, sy = 0;
  for (const q of pa.pts) { sx += q[0]; sy += q[1]; }
  return [sx / pa.pts.length, sy / pa.pts.length];
};
const meanRad = (pa) => {
  const [cx, cy] = centroid(pa);
  let s = 0;
  for (const q of pa.pts) s += Math.hypot(q[0] - cx, q[1] - cy);
  return s / pa.pts.length;
};
const finiteAll = (r) => r.paths.every((pa) => pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])));

/* S1 + S2 parametric */
{
  const p = { ...base(), instances: 60 };
  const r = def.compute([null, null], p, CTX);
  ok(deep(r, def.compute([null, null], p, CTX)), "S1: determinism");
  ok(r.paths.length === 60, `S2: 60 instances -> 60 paths (got ${r.paths.length})`);
}

/* S3 analytic centroids on a Helix */
{
  const p = { ...base(), profile: "Circle", path: "Helix", pathW: 45, pathD: 45, rise: 150, turns: 1.5, phase: 0, tilt: 0, yaw: 0, endScale: 100, modAmt: 0, twist: 0, instances: 25 };
  const r = def.compute([null, null], p, CTX);
  let good = true;
  r.paths.forEach((pa, i) => {
    const t = i / 24;
    const th = t * 1.5 * Math.PI * 2;
    const [gx, gy] = centroid(pa);
    /* profile ring is symmetric: centroid == path point projected */
    if (!close(gx, 150 + 45 * Math.cos(th), 1e-6)) good = false;
    if (!close(gy, 100 - 150 * (t - 0.5), 1e-6)) good = false;
  });
  ok(good, "S3: helix instance centroids match the analytic path (25 samples)");
}

/* S4 taper */
{
  const p = { ...base(), profile: "Circle", path: "Line", rise: 0, pathW: 80, tilt: 90, endScale: 40, modAmt: 0, twist: 0, instances: 20 };
  const r = def.compute([null, null], p, CTX);
  const ratio = meanRad(r.paths[19]) / meanRad(r.paths[0]);
  ok(close(ratio, 0.4, 1e-9), `S4: End scale 40% -> last/first size ratio 0.40 (got ${ratio.toFixed(6)})`);
}

/* S5 modulation */
{
  const p = { ...base(), profile: "Circle", path: "Line", rise: 0, pathW: 80, tilt: 90, endScale: 100, modAmt: 50, modCyc: 1, twist: 0, instances: 21 };
  const r = def.compute([null, null], p, CTX);
  const ratio = meanRad(r.paths[5]) / meanRad(r.paths[0]); /* t = 5/20 = 1/4: sin peak */
  ok(close(ratio, 1.5, 1e-9), `S5: mod 50% cycles=1 -> size at t=1/4 is 1.5x (got ${ratio.toFixed(6)})`);
}

/* S6 twist */
{
  const p = { ...base(), profile: "Rectangle", pw: 57, ph: 18, path: "Line", rise: 0, pathW: 100, tilt: 0, yaw: 0, endScale: 100, modAmt: 0, twist: 90, instances: 2 };
  const r = def.compute([null, null], p, CTX);
  const height = (pa) => {
    const ys = pa.pts.map((q) => q[1]);
    return Math.max(...ys) - Math.min(...ys);
  };
  ok(close(height(r.paths[0]), 18, 1e-6), `S6: twist start — projected height == profile Height (got ${height(r.paths[0]).toFixed(3)})`);
  ok(close(height(r.paths[1]), 57, 1e-6), `S6: twist 90\u00b0 end — projected height == profile Width (got ${height(r.paths[1]).toFixed(3)})`);
}

/* S7 cone + flat spiral */
{
  const p = { ...base(), profile: "Circle", pw: 6, ph: 6, path: "Cone spiral", pathW: 60, pathD: 60, rise: 100, turns: 2, tilt: 90, yaw: 0, pathEnd: 30, endScale: 100, modAmt: 0, instances: 10 };
  const r = def.compute([null, null], p, CTX);
  const d = (pa) => { const [gx, gy] = centroid(pa); return Math.hypot(gx - 150, gy - 100); };
  ok(close(d(r.paths[9]) / d(r.paths[0]), 0.3, 1e-9), `S7: cone — end radius 30% of start (got ${(d(r.paths[9]) / d(r.paths[0])).toFixed(6)})`);
  const pf = { ...p, path: "Flat spiral", tilt: 0 };
  const rf = def.compute([null, null], pf, CTX);
  let flat = true;
  for (const pa of rf.paths) { const [, gy] = centroid(pa); if (!close(gy, 100, 1e-6)) flat = false; }
  ok(flat, "S7: flat spiral stays in plane (all centroids on the center line, side view)");
}

/* S8 wired profile */
{
  const square = { paths: [{ pts: [[10, 10], [30, 10], [30, 30], [10, 30]], closed: true, layer: 0 }] };
  const p = { ...base(), pw: 40, ph: 20, path: "Line", rise: 0, pathW: 80, tilt: 0, endScale: 100, modAmt: 0, twist: 0, instances: 3 };
  const r = def.compute([square, null], p, CTX);
  ok(r.paths.length === 3, `S8: 3 instances x 1 wired subpath -> 3 paths (got ${r.paths.length})`);
  /* square is normalized by min(40/20, 20/20)=1 -> 20 mm tall in v (screen y at tilt 0) */
  const ys = r.paths[0].pts.map((q) => q[1]);
  ok(close(Math.max(...ys) - Math.min(...ys), 20, 1e-6), "S8: wired square fitted into the Width/Height box (20 mm tall)");
}

/* S9 budget */
{
  const p = { ...base(), profile: "Circle", pw: 200, ph: 200, instances: 800 };
  const r = def.compute([null, null], p, CTX);
  const tot = r.paths.reduce((s, pa) => s + pa.pts.length, 0);
  ok(tot <= 95000, `S9: 800 fine circles capped by budget (${tot} pts)`);
  ok(r.paths.length === 800, "S9: budget coarsens the profile, never drops instances");
}

/* S10 degenerates */
{
  const combos = [
    { pathW: 0, pathD: 0 },
    { turns: 0.25, rise: 0 },
    { path: "Figure 8" },
    { path: "Circle", rise: 0 },
    { path: "Line", pathW: 0, rise: 0 },
    { profile: "Star", inner: 10 },
    { profile: "Line" },
    { tilt: -90, yaw: 180 },
  ];
  for (const over of combos) {
    let threw = false, r = null;
    try { r = def.compute([null, null], { ...base(), ...over, instances: 12 }, CTX); } catch (e) { threw = true; }
    ok(!threw && r && finiteAll(r), `S10: ${JSON.stringify(over)} — no throw, finite`);
  }
  let othrew = false;
  try { def.overlay({ ...base(), pathW: 0, pathD: 0, rise: 0 }, CTX); } catch (e) { othrew = true; }
  ok(!othrew, "S10: overlay never throws (degenerate path)");
}

console.log(`\n${mode.toUpperCase()} mode — ${fails === 0 ? "ALL ORACLES PASS" : fails + " FAILURE(S)"}`);
process.exit(fails === 0 ? 0 : 1);
