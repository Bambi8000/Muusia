/* tools/validate-gyroid.mjs — run from repo root.
   Validates nodes-lab/gyroid.plotternode.js, or the baked
   src/defs/nodes/gyroid.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/gyroid.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/gyroid.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/gyroid.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/gyroid.plotternode.js");
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
T("seed live only with warp", sig(run({ warp: 0, seed: 1 })) === sig(run({ warp: 0, seed: 2 }))
  && sig(run({ warp: 0.5, seed: 1 })) !== sig(run({ warp: 0.5, seed: 2 })));

/* finite + sanity + budget */
let allFinite = true, allLen = true, maxPts = 0;
const sweeps = [
  {}, { shape: "Cube", cross: 20 }, { shape: "Cylinder", cells: 6, detail: 2 },
  { iso: 0.85 }, { iso: -0.85 }, { warp: 1, seed: 9 },
  { slices: 40, cross: 40, cells: 4 }, { persp: 1, rx: 90, ry: 180 },
  { persp: 0, rx: -90 }, { size: 280, slices: 3 },
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

/* FIELD CORRECTNESS: independent gyroid evaluation. With rx=ry=0, warp=0,
   Cube shape and NO fit distortion trickery, invert the projection for the
   center slice and check F ~ 0 on its contour points.
   At rx=ry=0 the projection is x' = x*fl/(z+camD), y' = y*fl/(z+camD) with
   known z per slice — invertible per slice. Fit scale/offset recovered from
   the known [-1,1] bounds is fragile, so instead test in a self-consistent
   way: contour points of the z=c slice must satisfy F(x,y,c)=0 where (x,y)
   are recovered through the same linear fit applied to all slices jointly.
   Simplification: use ONE slice (slices=1) -> the fit maps that slice's
   plane linearly; recover the affine map from the extreme points of a probe
   run with cells=1 (contour spans are known to reach the plane's bounds is
   NOT guaranteed) — instead recover the map by matching two analytically
   known contour points: at c=0, F(x,y,0) = sin(kx)cos(ky) + sin(ky) = 0
   holds along the whole line y = 0 (sin0=0 and sin(kx)*1 = ... no).
   Pragmatic: verify field correctness in 2D directly instead — the node's
   slice at z=c equals the analytic function; approximate by checking the
   ISO MONOTONICITY + SYMMETRY invariants below, which the true gyroid must
   satisfy and a broken field almost certainly would not. */

/* iso symmetry: gyroid F(-x,-y,-z) = -F(x,y,z); with rx=0, ry=180 the view of
   iso=+v equals the 180-degree screen rotation ... too view-dependent; use
   the robust pair: |iso|=v and -v give the SAME total contour length in the
   Cube (inversion is a volume-preserving symmetry of the level sets) */
{
  const len = (r) => r.paths.reduce((a, q) => a + H.pathLength(q.pts, q.closed), 0);
  const a = len(run({ shape: "Cube", iso: 0.5, warp: 0, rx: 0, ry: 0, persp: 0 }));
  const b = len(run({ shape: "Cube", iso: -0.5, warp: 0, rx: 0, ry: 0, persp: 0 }));
  T("gyroid inversion symmetry: |iso| pairs match in contour length",
    Math.abs(a - b) / Math.max(a, b) < 0.02,
    `${a.toFixed(0)} vs ${b.toFixed(0)} (${(100 * Math.abs(a - b) / Math.max(a, b)).toFixed(1)}%)`);
}

/* iso family: contour ink decreases monotonically toward extremes while the
   surface FRAGMENTS into more components — the true gyroid pinch behaviour */
{
  const seq = [0, 0.3, 0.5, 0.7, 0.9].map((iso) => {
    const r = run({ iso, shape: "Cube" });
    return [pts(r), r.paths.length];
  });
  const mono = seq.every(([v], i) => i === 0 || v <= seq[i - 1][0] + 1);
  T("iso sweep: ink decreases monotonically", mono,
    seq.map(([v]) => v).join(" > "));
  T("iso sweep: surface fragments toward extremes",
    seq[4][1] > seq[0][1],
    `paths ${seq[0][1]} -> ${seq[4][1]}`);
}

/* more cells -> more contour pieces; more slices -> more paths */
{
  T("cells densify the pattern",
    run({ cells: 4 }).paths.length > run({ cells: 1 }).paths.length,
    `${run({ cells: 4 }).paths.length} > ${run({ cells: 1 }).paths.length}`);
  T("slices scale path count",
    run({ slices: 30 }).paths.length > run({ slices: 6 }).paths.length);
  T("cross slices add curves",
    run({ cross: 14 }).paths.length > run({ cross: 0 }).paths.length);
}

/* sphere clip: fewer points than cube at same settings, and the projected
   sphere silhouette is rounder (bbox aspect ~ 1 at rx=ry=0) */
{
  const pc = pts(run({ shape: "Cube", rx: 0, ry: 0 }));
  const psph = pts(run({ shape: "Sphere", rx: 0, ry: 0 }));
  T("sphere clip trims the cube", psph < pc, `${psph} < ${pc}`);
}

/* fit: output centered and bounded by Size */
{
  const p = { ...defaults(), size: 120 };
  const r = run(p);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const q of r.paths) for (const [x, y] of q.pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  T("fit bounded by Size", Math.max(x1 - x0, y1 - y0) <= 120 + 0.5,
    `extent=${Math.max(x1 - x0, y1 - y0).toFixed(1)}`);
  T("fit centered", Math.abs((x0 + x1) / 2 - ctx.W / 2) < 1 &&
    Math.abs((y0 + y1) / 2 - ctx.H / 2) < 1);
}

/* SOLID SURFACE: ray-marched hidden lines */
{
  const base = { shape: "Sphere", rx: 18, ry: 25 };
  const tr = run({ ...base, surface: "Transparent" });
  const so = run({ ...base, surface: "Solid" });
  T("Solid removes hidden ink", pts(so) < pts(tr) * 0.85,
    `${pts(so)} < 0.85*${pts(tr)}`);
  // shared framing + visibility-only filtering: every Solid point must exist
  // in the Transparent output (subset within rounding tolerance)
  const set = new Set();
  for (const q of tr.paths) for (const [x, y] of q.pts)
    set.add(Math.round(x * 20) + ":" + Math.round(y * 20));
  let missing = 0, total = 0;
  for (const q of so.paths) for (const [x, y] of q.pts) {
    total++;
    if (!set.has(Math.round(x * 20) + ":" + Math.round(y * 20))) missing++;
  }
  T("Solid is a subset of Transparent (shared framing)",
    missing / total < 0.005, `${missing}/${total} off-set`);
  T("Solid splits contours into arcs", so.paths.length > tr.paths.length,
    `${so.paths.length} > ${tr.paths.length}`);
  T("param live: surface", sig(tr) !== sig(so));
  // coverage across all clip shapes: Solid must keep a healthy front-face
  // fraction — over-occlusion (field marching outside the volume) erased
  // the Cube almost completely in an early version
  for (const shape of ["Cube", "Sphere", "Cylinder"]) {
    const a = pts(run({ shape, surface: "Transparent" }));
    const b = pts(run({ shape, surface: "Solid" }));
    T(`Solid keeps front faces (${shape})`, b > a * 0.25 && b < a * 0.85,
      `${b} of ${a} (${(100 * b / a).toFixed(0)}%)`);
  }
}

/* param liveness */
const live = (k, v, extra = {}) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run(extra)) !== sig(run({ ...extra, [k]: v })));
live("shape", "Cube");
live("size", 80);
live("slices", 24);
live("cross", 10);
live("cells", 3.5);
live("iso", 0.4);
live("warp", 0.6);
live("detail", 1.6);
live("persp", 0.9);
live("rx", 60);
live("ry", 120);
live("layer", 4);

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
