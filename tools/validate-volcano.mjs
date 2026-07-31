/* tools/validate-volcano.mjs — run from repo root: node tools/validate-volcano.mjs
   Validates nodes-lab/volcano.plotternode.js (3D version), or the baked
   src/defs/nodes/volcano.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/volcano.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/volcano.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/volcano.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/volcano.plotternode.js");
}

const ctx = { W: 210, H: 297 };
const defaults = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}) => N.compute([undefined], { ...defaults(), ...over }, ctx, {});
const pts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const sig = (r) => JSON.stringify(r.paths.map((q) => [q.closed, q.layer,
  q.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])]));

let fails = 0;
const T = (name, ok, info = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (info ? "  (" + info + ")" : ""));
  if (!ok) fails++;
};

T("determinism (double run identical)", sig(run()) === sig(run()));
T("seed changes output (rough>0)", sig(run({ seed: 1 })) !== sig(run({ seed: 2 })));

/* finite + sanity + budget */
let allFinite = true, allLen = true, maxPts = 0;
const sweeps = [
  {}, { render: "Rings" }, { render: "Spokes" }, { render: "Mesh", spacing: 1, spokes: 90 },
  { tilt: 15 }, { tilt: 85 }, { dip: 80, height: 100 }, { dip: 0 },
  { rough: 1, flutes: 20, flDepth: 1, seed: 9 }, { crater: 60, size: 20 },
  { steep: 4, spacing: 8 }, { size: 140, cx: 20, cy: 80 },
];
for (const ov of sweeps) {
  const r = run(ov);
  maxPts = Math.max(maxPts, pts(r));
  for (const q of r.paths) {
    if (q.pts.length < 2) allLen = false;
    for (const [x, y] of q.pts)
      if (!Number.isFinite(x) || !Number.isFinite(y)) allFinite = false;
  }
}
T("all coords finite", allFinite);
T("every path >= 2 pts", allLen);
T("point budget < 120000", maxPts < 120000, "max " + maxPts);

/* OCCLUSION ORACLE: independent ray-cast against the same height profile.
   In Rings mode the innermost ring (r = spacing) lies on the crater floor.
   Coverage = fraction of that ring's sample positions that have an output
   point within 0.5 mm. Oracle-hidden at low tilt -> coverage must be low
   (stray ellipse crossings only); oracle-visible at high tilt -> high. */
const prof = (r, P) => {
  const R = P.size, Rc = Math.min(P.crater, R * 0.85), h = P.height,
    dip = Math.min(P.dip, h);
  if (r >= R) return 0;
  if (r >= Rc) return h * Math.pow((R - r) / (R - Rc), P.steep);
  return h - dip * (1 - (r / Rc) * (r / Rc));
};
const rayVisible = (x, y, z, el, P) => {
  const dy = -Math.cos(el), dz = Math.sin(el); // toward viewer
  for (let t = 0.5; t < 400; t += 0.5) {
    const yy = y + dy * t, zz = z + dz * t;
    const r = Math.hypot(x, yy);
    if (r > P.size) return true;
    if (zz <= prof(r, P) - 0.05) return false;
  }
  return true;
};
const floorRingCoverage = (tilt) => {
  const P = { ...defaults(), rough: 0, flutes: 0, tilt, render: "Rings" };
  const out = run(P);
  const X = ctx.W * P.cx / 100, Y = ctx.H * P.cy / 100;
  const el = (tilt * Math.PI) / 180, se = Math.sin(el), ce = Math.cos(el);
  const rf = P.spacing; // innermost ring radius (node: first ring at r = spacing)
  let vis = 0, cov = 0, n = 32;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const x = Math.cos(a) * rf, y = Math.sin(a) * rf, z = prof(rf, P);
    if (rayVisible(x, y, z, el, P)) vis++;
    const sx = X + x, sy = Y - (y * se + z * ce);
    let near = false;
    for (const q of out.paths) {
      if (H.pathLength(q.pts, q.closed) > 25) continue; // flank rings are long; the floor ring is a ~14 mm loop
      for (const pt of q.pts)
        if (Math.hypot(pt[0] - sx, pt[1] - sy) < 0.5) { near = true; break; }
      if (near) break;
    }
    if (near) cov++;
  }
  return { oracle: vis / n, cov: cov / n };
};
{
  const lo = floorRingCoverage(22), hi = floorRingCoverage(80);
  T("oracle agrees: floor hidden at low tilt", lo.oracle === 0, `oracleVis=${lo.oracle}`);
  T("floor ring absent at low tilt", lo.cov < 0.3, `coverage=${(100 * lo.cov).toFixed(0)}%`);
  T("oracle agrees: floor visible at high tilt", hi.oracle === 1, `oracleVis=${hi.oracle}`);
  T("floor ring drawn at high tilt", hi.cov > 0.8, `coverage=${(100 * hi.cov).toFixed(0)}%`);
}

/* clean cone is mirror-symmetric about vertical axis (Rows mode) */
{
  const p = { ...defaults(), rough: 0, flutes: 0 };
  const r = run(p);
  const X = ctx.W * p.cx / 100;
  const set = new Set();
  let total = 0;
  for (const q of r.paths) for (const [x, y] of q.pts) {
    set.add(Math.round(x * 5) + ":" + Math.round(y * 5));
    total++;
  }
  let matched = 0;
  for (const q of r.paths) for (const [x, y] of q.pts) {
    const mx = 2 * X - x;
    if (set.has(Math.round(mx * 5) + ":" + Math.round(y * 5))) matched++;
  }
  T("mirror symmetry (clean cone)", matched / total > 0.93,
    (100 * matched / total).toFixed(1) + "%");
}

/* dip=0 -> plateau summit centered (Rings mode: no ground patch in frame) */
{
  const p = { ...defaults(), rough: 0, flutes: 0, dip: 0, tilt: 45, render: "Rings" };
  const r = run(p);
  const X = ctx.W * p.cx / 100;
  let bestX = 0, bestY = Infinity;
  for (const q of r.paths) for (const [x, y] of q.pts)
    if (y < bestY) { bestY = y; bestX = x; }
  T("dip=0 gives centered summit", Math.abs(bestX - X) < p.crater + 2,
    `summit x offset=${(bestX - X).toFixed(1)}`);
}

/* YAW invariants */
{
  // clean symmetric cone: yaw must be a no-op
  const base = { rough: 0, flutes: 0, render: "Rings" };
  T("yaw no-op on symmetric cone",
    sig(run({ ...base, yaw: 0 })) === sig(run({ ...base, yaw: 137 })));
  // with flutes, yaw rotates them
  T("yaw rotates flutes",
    sig(run({ rough: 0, flDepth: 0.8, yaw: 0 })) !== sig(run({ rough: 0, flDepth: 0.8, yaw: 20 }))); // NOT a multiple of the flute period (8 flutes = 45 deg)
  // 360 deg = full turn = same picture (within emit rounding)
  T("yaw periodic (0 == 360)",
    sig(run({ yaw: 0 })) === sig(run({ yaw: 360 })));
}

/* DOTS render */
{
  const r = run({ render: "Dots" });
  T("dots: all closed loops", r.paths.length > 0 && r.paths.every((q) => q.closed),
    r.paths.length + " dots");
  let maxr = 0;
  for (const q of r.paths) {
    let cx0 = 0, cy0 = 0;
    for (const [x, y] of q.pts) { cx0 += x; cy0 += y; }
    cx0 /= q.pts.length; cy0 /= q.pts.length;
    for (const [x, y] of q.pts) maxr = Math.max(maxr, Math.hypot(x - cx0, y - cy0));
  }
  const p = defaults();
  T("dots: radius bounded by Dot size", maxr <= p.dotSize / 2 + 0.05, "max r=" + maxr.toFixed(2));
  // occlusion works for dots too: looking into the bowl reveals more dots
  const lo = run({ render: "Dots", tilt: 22, rough: 0, flutes: 0 }).paths.length;
  const hi = run({ render: "Dots", tilt: 80, rough: 0, flutes: 0 }).paths.length;
  T("dots: steeper tilt reveals crater dots", hi > lo, `${hi} > ${lo}`);
  T("param live: dotSize", sig(run({ render: "Dots" })) !== sig(run({ render: "Dots", dotSize: 3 })));
  T("param live: dotJitter", sig(run({ render: "Dots" })) !== sig(run({ render: "Dots", dotJitter: 0.6 })));
  T("dot jitter follows seed", sig(run({ render: "Dots", dotJitter: 0.6, seed: 1 }))
    !== sig(run({ render: "Dots", dotJitter: 0.6, seed: 2 })));
  // Dot grow direction flips the radius-vs-altitude correlation.
  // Proxy: correlate dot radius with screen y (higher on screen ~ higher altitude
  // on the near flank); Peak -> negative corr, Base -> positive.
  const corr = (grow) => {
    const rr = run({ render: "Dots", dotGrow: grow, rough: 0, flutes: 0, tilt: 45 });
    const xs = [], ys = [];
    for (const q of rr.paths) {
      let mx = 0, my = 0;
      for (const [x, y] of q.pts) { mx += x; my += y; }
      mx /= q.pts.length; my /= q.pts.length;
      let rad = 0;
      for (const [x, y] of q.pts) rad += Math.hypot(x - mx, y - my);
      xs.push(my); ys.push(rad / q.pts.length);
    }
    const n = xs.length;
    const ax = xs.reduce((a, b) => a + b) / n, ay = ys.reduce((a, b) => a + b) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (xs[i] - ax) * (ys[i] - ay);
      sxx += (xs[i] - ax) ** 2; syy += (ys[i] - ay) ** 2;
    }
    return sxy / Math.sqrt(sxx * syy);
  };
  const cP = corr("Peak"), cB = corr("Base"), cN = corr("None");
  T("Dot grow flips size gradient", cP < -0.15 && cB > 0.15 && Math.abs(cN) < 0.1,
    `Peak=${cP.toFixed(2)} Base=${cB.toFixed(2)} None=${cN.toFixed(2)}`);
  T("param live: yaw (Dots)", sig(run({ render: "Dots", yaw: 0 })) !== sig(run({ render: "Dots", yaw: 30 })));
}

/* param liveness */
const live = (k, v, extra = {}) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run(extra)) !== sig(run({ ...extra, [k]: v })));
live("render", "Rings");
live("size", 50);
live("crater", 30);
live("height", 80);
live("dip", 40);
live("steep", 3);
live("tilt", 65);
live("spacing", 4);
live("spokes", 12, { render: "Spokes" });
live("rough", 0.8);
live("flutes", 3);
live("flDepth", 0.9);
live("cx", 30);
live("cy", 40);
live("layer", 5);

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
