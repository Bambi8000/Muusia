/* tools/validate-empty_fill.mjs — run from repo root: node tools/validate-empty_fill.mjs
   Validates nodes-lab/empty_fill.plotternode.js, or the baked
   src/defs/nodes/empty_fill.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/empty_fill.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/empty_fill.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/empty_fill.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/empty_fill.plotternode.js");
}

const ctx = { W: 210, H: 297 };

/* pebble-like blob input (deterministic) */
const blobs = (count, seed) => {
  const rng = H.mulberry32(seed * 7919 + 13);
  const paths = [];
  for (let b = 0; b < count; b++) {
    const cx = 30 + rng() * 150, cy = 35 + rng() * 227;
    const R = 14 + rng() * 16, ph = rng() * 7;
    const pts = [];
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const r = R * (1 + 0.18 * Math.sin(a * 3 + ph) + 0.1 * Math.sin(a * 5 + ph * 2));
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    paths.push({ pts, closed: true, layer: 1 });
  }
  return { paths };
};
const INPUT = blobs(7, 4);

const defaults = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, inp = INPUT) => N.compute([inp], { ...defaults(), ...over }, ctx, {});
const pts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const sig = (r) => JSON.stringify(r.paths.map((q) => [q.closed, q.layer,
  q.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])]));

let fails = 0;
const T = (name, ok, info = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (info ? "  (" + info + ")" : ""));
  if (!ok) fails++;
};

T("determinism (double run identical)", sig(run()) === sig(run()));
T("unwired input tolerated", (() => {
  try { N.compute([undefined], defaults(), ctx, {}); return true; } catch { return false; }
})());

/* finite + sanity across the pattern/param space */
let allFinite = true, allLen = true, maxPts = 0;
const sweeps = [
  {}, { pattern: "Contours" }, { pattern: "Scales" }, { pattern: "Hatch", angle: 30 },
  { pattern: "Crosshatch", angle: 15 }, { pattern: "Waves", angle: 90 },
  { spacing: 1, gap: 0, wobble: 1, seed: 9 },
  { spacing: 12, gap: 12, margin: 40 },
  { margin: 0, wobble: 0 }, { pattern: "Contours", wobble: 1, spacing: 1.5 },
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

/* fill stays inside margin box (input passthrough excluded) */
{
  const r = run({ keep: false, margin: 12 });
  let ok = true;
  for (const q of r.paths) for (const [x, y] of q.pts)
    if (x < 12 - 0.3 || x > ctx.W - 12 + 0.3 || y < 12 - 0.3 || y > ctx.H - 12 + 0.3) ok = false;
  T("fill respects margin box", ok);
}

/* GAP INVARIANT: no fill point closer than ~gap to any input polygon
   (tolerance = grid cell + wobble allowance for contour field warp) */
const gapCheck = (pattern, gap, wobble) => {
  const r = run({ pattern, gap, wobble, keep: false });
  const segDist = (px, py, q) => {
    let best = Infinity;
    const n = q.pts.length;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = q.pts[i], [x1, y1] = q.pts[(i + 1) % n];
      const vx = x1 - x0, vy = y1 - y0;
      const L2 = vx * vx + vy * vy || 1;
      let t = ((px - x0) * vx + (py - y0) * vy) / L2;
      t = Math.min(1, Math.max(0, t));
      best = Math.min(best, Math.hypot(x0 + vx * t - px, y0 + vy * t - py));
    }
    return best;
  };
  const inside = (px, py, q) => {
    let w = false;
    const n = q.pts.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = q.pts[i], [xj, yj] = q.pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) w = !w;
    }
    return w;
  };
  let minD = Infinity, violIn = 0;
  for (const q of r.paths) for (const pt of q.pts) {
    for (const b of INPUT.paths) {
      if (inside(pt[0], pt[1], b)) violIn++;
      else minD = Math.min(minD, segDist(pt[0], pt[1], b));
    }
  }
  const tol = 1.7 + (pattern === "Contours" ? wobble * 3 : 0);
  T(`gap invariant ${pattern} (gap=${gap}, wob=${wobble})`,
    violIn === 0 && minD > gap - tol,
    `minDist=${minD.toFixed(2)} insideViol=${violIn}`);
};
gapCheck("Coils", 1.8, 0.25);
gapCheck("Contours", 1.8, 0);
gapCheck("Hatch", 3, 0.25);
gapCheck("Scales", 1.8, 0.25);

/* seed + param liveness */
T("seed changes output (wobble>0)", sig(run({ seed: 1 })) !== sig(run({ seed: 2 })));
const live = (k, v) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run()) !== sig(run({ [k]: v })));
live("pattern", "Contours");
live("spacing", 5);
live("gap", 6);
live("angle", 45);
live("wobble", 0.8);
live("margin", 25);
live("keep", false);
live("pen", 4);

/* keep=true passes input through unchanged */
{
  const r = run({ keep: true });
  const first = r.paths.slice(0, INPUT.paths.length);
  T("keep passes input through", JSON.stringify(first) === JSON.stringify(INPUT.paths));
}

/* more blobs -> less empty space -> fewer fill points */
{
  const few = pts(run({ keep: false }, blobs(2, 4)));
  const many = pts(run({ keep: false }, blobs(10, 4)));
  T("more shapes reduce fill", many < few, `${many} < ${few}`);
}

/* open paths block too */
{
  const line = { paths: [{ pts: [[20, 148], [190, 148]], closed: false, layer: 0 }] };
  const withL = pts(run({ keep: false, pattern: "Hatch", gap: 6 }, line));
  const empty = pts(run({ keep: false, pattern: "Hatch", gap: 6 }, { paths: [] }));
  T("open path blocks fill", withL < empty, `${withL} < ${empty}`);
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
