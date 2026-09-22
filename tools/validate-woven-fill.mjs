/* Validator for the Woven Ribbon Fill modes (Tracks / Rays / Square wave).
   Run from the repo root: node tools/validate-woven-fill.mjs
   Targets the baked src/defs/nodes/woven_ribbon.js. */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const def = (await import(pathToFileURL(resolve("src/defs/nodes/woven_ribbon.js")).href)).default;
console.log("[baked]", def.key, "-", def.name);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

const CTX = { W: 297, H: 210 };
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (p, ctx) => def.compute([undefined], p, ctx || CTX);
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();
const len = (A, B) => Math.hypot(B[0] - A[0], B[1] - A[1]);
/* ribbon half-width from the node's own formula */
const hwOf = (p) => { const G = Math.max(4, p.grid), eff = Math.max(0.3, Math.min(p.spacing, (G / 2 - 1.5) / p.pairs)); return p.pairs * eff + Math.max(0, p.overhang); };
/* rays = 2-point paths of the comb length (caps are arcs with many points) */
const rays = (r, p) => { const L = 2 * hwOf(p); return r.paths.filter((q) => q.pts.length === 2 && Math.abs(len(q.pts[0], q.pts[1]) - L) < 1e-6); };

ok(def.params.some((q) => q.key === "fill") && def.params.some((q) => q.key === "rayStep") && def.params.some((q) => q.key === "overhang"), "patch present: Fill / Ray step / Ray overhang params");
ok(p0.fill === "Tracks", "default Fill is Tracks (existing patches unchanged)");

/* ---------- Tracks unchanged in shape ---------- */
{
  const r = run(p0);
  ok(r.paths.length > 0 && finiteAll(r), "Tracks: draws (" + r.paths.length + " paths, " + npts(r) + " pts)");
  ok(JSON.stringify(run(p0)) === JSON.stringify(run({ ...p0, rayStep: 3, overhang: 9 })), "Tracks: Ray step / overhang inert");
  ok(rays(r, p0).length === 0, "Tracks: no comb segments");
}

/* ---------- Rays ---------- */
const pr = { ...p0, fill: "Rays" };
{
  const r = run(pr), r2 = run(pr);
  ok(JSON.stringify(r) === JSON.stringify(r2), "Rays: deterministic");
  const rs = rays(r, pr);
  ok(rs.length > 200 && finiteAll(r), "Rays: many comb segments (" + rs.length + ")");
  ok(rs.every((q) => q.pts.length === 2), "Rays: every comb segment is a 2-point path");
  const L = 2 * hwOf(pr);
  ok(rs.every((q) => Math.abs(len(q.pts[0], q.pts[1]) - L) < 1e-6), "Rays: every segment spans exactly the ribbon width (" + L.toFixed(2) + " mm)");
  /* alternate direction: consecutive rays point opposite ways */
  let alt = 0;
  for (let i = 1; i < rs.length; i++) { const a = rs[i - 1], b = rs[i]; const d = (a.pts[1][0] - a.pts[0][0]) * (b.pts[1][0] - b.pts[0][0]) + (a.pts[1][1] - a.pts[0][1]) * (b.pts[1][1] - b.pts[0][1]); if (d < 0) alt++; }
  ok(alt / (rs.length - 1) > 0.95, "Rays: consecutive segments alternate direction (zigzag plotting) " + (100 * alt / (rs.length - 1)).toFixed(0) + "%");
  /* spacing: midpoints of consecutive rays ~ Ray step apart (except across gaps / at arcs) */
  const mids = rs.map((q) => [(q.pts[0][0] + q.pts[1][0]) / 2, (q.pts[0][1] + q.pts[1][1]) / 2]);
  const d = []; for (let i = 1; i < mids.length; i++) d.push(len(mids[i - 1], mids[i]));
  d.sort((a, b) => a - b);
  ok(Math.abs(d[Math.floor(d.length / 2)] - pr.rayStep) < 0.02, "Rays: median comb pitch = Ray step (" + d[Math.floor(d.length / 2)].toFixed(3) + ")");
  /* perpendicular: on straights the ray is normal to the midpoint chain */
  let perp = 0, tested = 0;
  for (let i = 1; i < rs.length; i++) {
    const m0 = mids[i - 1], m1 = mids[i]; const cl = len(m0, m1); if (Math.abs(cl - pr.rayStep) > 0.01) continue;
    const q = rs[i]; const rx = (q.pts[1][0] - q.pts[0][0]) / L, ry = (q.pts[1][1] - q.pts[0][1]) / L;
    tested++; if (Math.abs(rx * (m1[0] - m0[0]) / cl + ry * (m1[1] - m0[1]) / cl) < 0.12) perp++;
  }
  ok(tested > 100 && perp / tested > 0.9, "Rays: teeth are perpendicular to the spine (" + perp + "/" + tested + ")");
  const r2s = rays(run({ ...pr, rayStep: 2 }), pr);
  ok(r2s.length > rs.length * 0.4 && r2s.length < rs.length * 0.6, "Ray step 2: about half the teeth (" + r2s.length + " vs " + rs.length + ")");
  const po = { ...pr, overhang: 5 };
  const ro = rays(run(po), po);
  ok(ro.length === rs.length && Math.abs(len(ro[0].pts[0], ro[0].pts[1]) - (L + 10)) < 1e-6, "Ray overhang 5: same teeth, 10 mm longer");
  /* gaps: a bigger under-pass gap removes teeth */
  const g0 = rays(run({ ...pr, gap: 0 }), pr).length, g3 = rays(run({ ...pr, gap: 3 }), pr).length;
  ok(g3 < g0, "Rays: larger Gap removes more teeth at under-passes (" + g0 + " -> " + g3 + ")");
  ok(r.paths.filter((q) => q.pts.length > 2).length > 0 && run({ ...pr, caps: false }).paths.filter((q) => q.pts.length > 2).length === 0, "Rays: end caps still drawn / removable");
}

/* ---------- Square wave ---------- */
{
  const ps = { ...p0, fill: "Square wave" };
  const r = run(ps);
  ok(finiteAll(r) && r.paths.length > 0, "Square wave: draws (" + r.paths.length + " paths)");
  const rr = run(pr);
  const sq = r.paths.filter((q) => q.pts.length > 2 || Math.abs(len(q.pts[0], q.pts[1]) - 2 * hwOf(ps)) < 1e-6);
  const caps = (rr2) => rr2.paths.filter((q) => q.pts.length > 2 && !(q.pts.length % 2 === 0 && Math.abs(len(q.pts[0], q.pts[1]) - 2 * hwOf(ps)) < 1e-6));
  /* the meander's vertices are exactly the Rays endpoints in order */
  const rayPts = rays(rr, pr).flatMap((q) => q.pts);
  const sqPts = r.paths.filter((q) => q.pts.length % 2 === 0 && Math.abs(len(q.pts[0], q.pts[1]) - 2 * hwOf(ps)) < 1e-6).flatMap((q) => q.pts);
  ok(sqPts.length === rayPts.length && sqPts.every((P, i) => Math.abs(P[0] - rayPts[i][0]) < 1e-9 && Math.abs(P[1] - rayPts[i][1]) < 1e-9), "Square wave: vertices are exactly the Rays endpoints in order (" + sqPts.length + " pts)");
  ok(r.paths.filter((q) => q.pts.length % 2 === 0 && Math.abs(len(q.pts[0], q.pts[1]) - 2 * hwOf(ps)) < 1e-6).length < rays(rr, pr).length / 10, "Square wave: far fewer paths than Rays — continuous meander (" + r.paths.length + " vs " + rr.paths.length + ")");
  ok(npts(r) === npts(rr), "Square wave: same point count as Rays");
  /* every across-stroke (odd segment) spans the ribbon width, along-strokes never do */
  let across = true;
  const runs = r.paths.filter((q) => q.pts.length % 2 === 0 && Math.abs(len(q.pts[0], q.pts[1]) - 2 * hwOf(ps)) < 1e-6);
  for (const q of runs) for (let i = 0; i + 1 < q.pts.length; i += 2) if (Math.abs(len(q.pts[i], q.pts[i + 1]) - 2 * hwOf(ps)) > 1e-6) across = false;
  ok(runs.length > 0 && runs.some((q) => q.pts.length > 100), "Square wave: long continuous runs exist (" + Math.max(...runs.map((q) => q.pts.length)) + " pts in the longest)");
  ok(across, "Square wave: every across-stroke spans the ribbon width");
  ok(caps(r).length === caps(rr).length, "Square wave: same end caps as Rays");
}

/* ---------- liveness / selects / showIf / extremes ---------- */
const J = (r) => JSON.stringify(r);
ok(J(run(pr)) !== J(run({ ...pr, rayStep: 2 })), "param live: rayStep (Rays)");
ok(J(run(pr)) !== J(run({ ...pr, overhang: 4 })), "param live: overhang (Rays)");
ok(J(run(p0)) !== J(run(pr)) && J(run(pr)) !== J(run({ ...p0, fill: "Square wave" })), "param live: fill");
for (const opt of def.params.find((q) => q.key === "fill").options) { const r = run({ ...p0, fill: opt }); ok(r.paths.length > 0 && finiteAll(r), "fill '" + opt + "' draws finite paths (" + r.paths.length + ")"); }
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(!vis(p0).includes("rayStep") && !vis(p0).includes("overhang") && vis(pr).includes("rayStep") && vis(pr).includes("overhang"), "showIf: comb params hidden in Tracks, visible otherwise");
}
{
  const ext = run({ ...pr, steps: 120, grid: 8, rayStep: 0.3, pairs: 8, overhang: 20 });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme Rays (120 steps, grid 8, step 0.3): finite + budget (" + npts(ext) + ")");
  const extS = run({ ...p0, fill: "Square wave", steps: 120, grid: 8, rayStep: 0.3 });
  ok(finiteAll(extS) && npts(extS) <= 120000, "extreme Square wave: finite + budget (" + npts(extS) + ")");
  ok(run(pr, { W: 30, H: 30 }).paths.length === 0 || finiteAll(run(pr, { W: 30, H: 30 })), "tiny canvas: no throw");
  ok(finiteAll(run({ ...pr, margin: 0, overhang: 20 })), "overhang beyond the sheet: finite (overhang is allowed to leave the margin box)");
  for (const s of [1, 2, 3]) ok(finiteAll(run({ ...pr, seed: s })) && finiteAll(run({ ...p0, fill: "Square wave", seed: s })), "seed " + s + ": both comb modes finite");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
