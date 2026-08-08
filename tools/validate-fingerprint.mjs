/* Validator for fingerprint — run from repo root:
   node tools/validate-fingerprint.mjs
   Auto-switches lab/baked; uses the REAL src/defs/helpers.js. */
import fs from "fs";
import * as H from "../src/defs/helpers.js";

const LAB = "nodes-lab/fingerprint.plotternode.js";
let def, mode;
if (fs.existsSync(LAB)) {
  const { Pin, EMPTY, resample, mulberry32, hash2, noise2, applyStyle, PENS } = H;
  void Pin; void EMPTY; void resample; void mulberry32; void hash2; void noise2; void applyStyle; void PENS;
  def = eval(fs.readFileSync(LAB, "utf8"));
  mode = "lab";
} else {
  def = (await import("../src/defs/nodes/fingerprint.js")).default;
}
console.log("mode:", mode || "baked");

const ctx = { W: 300, H: 200 };
const P = (over = {}) => ({
  seeds: 12, gap: 2.2, merge: 0.5, wobble: 0.3, maxRings: 60,
  breaks: 0.35, dots: true, margin: 10, seed: 4, layer: 0, ...over
});
const run = (over) => def.compute([undefined], P(over), ctx);

let fails = 0;
const check = (name, cond, detail = "") => {
  console.log((cond ? "OK  " : "FAIL") + " " + name + (cond ? "" : "  " + detail));
  if (!cond) fails++;
};

/* T1 determinism + seed */
{
  const a = JSON.stringify(run({}));
  check("T1 determinism + seed", a === JSON.stringify(run({})) && a !== JSON.stringify(run({ seed: 5 })));
}

/* T2 single-seed oracle: one center, no wobble, no breaks -> concentric circles:
   each closed ring has constant radius about the shared center, radii step by gap */
{
  const out = run({ seeds: 1, wobble: 0, breaks: 0, merge: 0, maxRings: 20 }).paths;
  const rings = out.filter((q) => q.closed);
  let ok = rings.length >= 5, detail = "rings=" + rings.length;
  /* center from the innermost ring's centroid */
  const byR = rings.map((q) => {
    const cx = q.pts.reduce((s, v) => s + v[0], 0) / q.pts.length;
    const cy = q.pts.reduce((s, v) => s + v[1], 0) / q.pts.length;
    return { q, cx, cy };
  });
  const inner = byR.reduce((a, b) => {
    const ra = Math.hypot(a.q.pts[0][0] - a.cx, a.q.pts[0][1] - a.cy);
    const rb = Math.hypot(b.q.pts[0][0] - b.cx, b.q.pts[0][1] - b.cy);
    return ra < rb ? a : b;
  });
  const C = [inner.cx, inner.cy];
  const radii = [];
  for (const { q } of byR) {
    const rs = q.pts.map(([x, y]) => Math.hypot(x - C[0], y - C[1]));
    const mean = rs.reduce((s, v) => s + v, 0) / rs.length;
    if (mean < 4) continue; /* innermost rings carry grid-curvature error */
    const dev = Math.max(...rs.map((r) => Math.abs(r - mean)));
    const tol = 0.02 + 0.45 / mean; /* marching-squares curvature error ~ cell^2/r */
    if (dev > tol) { ok = false; detail += " dev=" + dev.toFixed(4) + "@r" + mean.toFixed(1); break; }
    radii.push(mean);
  }
  radii.sort((a, b) => a - b);
  /* consecutive radii step by an integer multiple of the gap (open rings skipped) */
  let unitSteps = 0;
  for (let i = 1; i < radii.length && ok; i++) {
    const d = radii[i] - radii[i - 1];
    if (Math.abs(d - Math.round(d / 2.2) * 2.2) > 0.05) { ok = false; detail += " step=" + d.toFixed(4); }
    if (Math.abs(d - 2.2) < 0.05) unitSteps++;
  }
  if (ok && unitSteps < 3) { ok = false; detail += " unitSteps=" + unitSteps; }
  check("T2 single-seed concentric circles at exact gap", ok, detail);
}

/* T3 constant-spacing oracle: with even ridge spacing, total ridge length x gap
   covers the field area (length = area / gap); scanline crossings only sanity-bound
   because a horizontal line cuts rings obliquely (spacing/|sin theta|) */
{
  const out = run({ breaks: 0, wobble: 0.15, merge: 0.15, maxRings: 80 }).paths;
  let len = 0;
  for (const q of out) {
    const pts = q.closed ? [...q.pts, q.pts[0]] : q.pts;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const cover = (len * 2.2) / (280 * 180);
  const xs = [];
  for (const q of out) {
    const pts = q.closed ? [...q.pts, q.pts[0]] : q.pts;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      if ((y0 <= 100) !== (y1 <= 100)) xs.push(x0 + ((100 - y0) / (y1 - y0)) * (x1 - x0));
    }
  }
  xs.sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 0.3) gaps.push(xs[i] - xs[i - 1]);
  const med = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  check("T3 ridge density = area / gap", cover > 0.85 && cover < 1.15 && med < 2.2 * 2.2,
    "cover=" + cover.toFixed(3) + " scanlineMedian=" + (med || 0).toFixed(2));
}

/* T4 breaks + dots: dashes multiply paths; micro dot paths appear only with dots on */
{
  const solid = run({ breaks: 0 }).paths.length;
  const dashed = run({ breaks: 0.7, dots: false }).paths;
  const dotted = run({ breaks: 0.7, dots: true }).paths;
  const isDot = (q) => q.pts.length === 2 && Math.abs(Math.hypot(q.pts[1][0] - q.pts[0][0], q.pts[1][1] - q.pts[0][1]) - 0.05) < 0.01;
  check("T4 breaks and gap dots",
    dashed.length > solid * 2 && dashed.filter(isDot).length === 0 && dotted.filter(isDot).length > 20,
    "solid=" + solid + " dashed=" + dashed.length + " dots=" + dotted.filter(isDot).length);
}

/* T5 merge + wobble + gap live; maxRings caps growth */
{
  const a = JSON.stringify(run({}));
  const few = run({ maxRings: 6, breaks: 0 }).paths.length;
  const many = run({ maxRings: 60, breaks: 0 }).paths.length;
  check("T5 params live + ring cap",
    a !== JSON.stringify(run({ merge: 0.05 })) &&
    a !== JSON.stringify(run({ wobble: 0.9 })) &&
    a !== JSON.stringify(run({ gap: 4 })) && few < many);
}

/* T6 containment in the margin box */
{
  const out = run({ wobble: 1, merge: 1 }).paths;
  const bad = out.flatMap((q) => q.pts).filter(([x, y]) =>
    x < 10 - 1e-6 || x > 290 + 1e-6 || y < 10 - 1e-6 || y > 190 + 1e-6);
  check("T6 margin containment", bad.length === 0, "bad=" + bad.length);
}

/* T7 budget at heavy settings, never throws */
{
  let ok = true, detail = "";
  try {
    const out = run({ seeds: 40, gap: 1, maxRings: 80, breaks: 0.8, margin: 0 });
    const total = out.paths.reduce((s, q) => s + q.pts.length, 0);
    ok = total <= 116000 + 4;
    detail = "pts=" + total;
  } catch (e) { ok = false; detail = "threw: " + e.message; }
  check("T7 budget", ok, detail);
}

/* T8 degenerate canvas -> EMPTY; overlay shows box + centers and matches compute's seed count */
{
  let ok = true, detail = "";
  try {
    const e = def.compute([undefined], P({ margin: 60 }), { W: 110, H: 110 });
    const g = def.overlay(P({ seeds: 7, breaks: 0 }), ctx);
    const ptsN = g.filter((q) => q.kind === "point").length;
    ok = e.paths.length === 0 && g[0].kind === "rect" && ptsN === 7;
    detail = "points=" + ptsN;
  } catch (e2) { ok = false; detail = "threw: " + e2.message; }
  check("T8 degenerate + overlay centers", ok, detail);
}

console.log(fails === 0 ? "ALL OK" : "FAILURES: " + fails);
process.exitCode = fails === 0 ? 0 : 1;
