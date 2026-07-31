/* tools/validate-double_pendulum.mjs — run from repo root.
   Validates nodes-lab/double_pendulum.plotternode.js, or the baked
   src/defs/nodes/double_pendulum.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/double_pendulum.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/double_pendulum.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/double_pendulum.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/double_pendulum.plotternode.js");
}

const ctx = { W: 210, H: 297 };
const defaults = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}) => N.compute([undefined], { ...defaults(), ...over }, ctx, {});
const pts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const sig = (r) => JSON.stringify(r.paths.map((q) => [q.closed, q.layer,
  q.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])]));
const piv = (p) => [ctx.W * p.cx / 100, ctx.H * p.cy / 100];

let fails = 0;
const T = (name, ok, info = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (info ? "  (" + info + ")" : ""));
  if (!ok) fails++;
};

T("determinism (double run identical)", sig(run()) === sig(run()));

/* finite + sanity + budget */
let allFinite = true, allLen = true, maxPts = 0;
const sweeps = [
  {}, { traces: 8, time: 60, penEach: true }, { trace: "Both" },
  { trace: "Midpoint", damp: 0 }, { a1: 179, a2: 179, m2: 5, grav: 3 },
  { l1: 80, l2: 80, time: 120, detail: 0.3 }, { a1: 3, a2: 0, damp: 0.5 },
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

/* PHYSICS: trace bounded by arm sum around the pivot — for every sweep */
{
  let worst = -Infinity, ok = true;
  for (const ov of [{}, { a1: 179, a2: 179, grav: 3, damp: 0, time: 60 },
                    { trace: "Both", m2: 5 }]) {
    const p = { ...defaults(), ...ov };
    const r = run(ov);
    const [X, Y] = piv(p);
    const lim = p.l1 + p.l2 + 0.01;
    for (const q of r.paths) for (const [x, y] of q.pts) {
      const d = Math.hypot(x - X, y - Y);
      worst = Math.max(worst, d - (p.l1 + p.l2));
      if (d > lim) ok = false;
    }
  }
  T("trace bounded by L1+L2", ok, "worst overshoot=" + worst.toFixed(4) + "mm");
}

/* CHAOS: two perturbed traces diverge far beyond the initial offset */
{
  const p = { ...defaults(), traces: 2, perturb: 0.05, damp: 0, time: 12, penEach: true };
  const r = run(p);
  const A = r.paths.find((q) => q.layer === 0).pts;
  const B = r.paths.find((q) => q.layer === 1).pts;
  const startD = Math.hypot(A[0][0] - B[0][0], A[0][1] - B[0][1]);
  const endD = Math.hypot(A[A.length - 1][0] - B[B.length - 1][0],
                          A[A.length - 1][1] - B[B.length - 1][1]);
  T("chaos: perturbed traces diverge", endD > Math.max(0.5, startD * 50),
    `start=${startD.toFixed(3)} end=${endD.toFixed(1)}mm`);
}

/* DAMPING: strong damping settles the bob toward hanging straight down */
{
  const p = { ...defaults(), damp: 0.5, time: 90, a1: 120, a2: -35 };
  const r = run(p);
  const [X, Y] = piv(p);
  const rest = [X, Y + p.l1 + p.l2];
  const q = r.paths[0].pts;
  const end = q[q.length - 1];
  const d = Math.hypot(end[0] - rest[0], end[1] - rest[1]);
  T("damping settles to hanging rest", d < 3, `endDist=${d.toFixed(2)}mm`);
}

/* SMALL SWING: tiny start angles stay near the bottom, never flip over */
{
  const p = { ...defaults(), a1: 5, a2: 5, damp: 0, time: 15 };
  const r = run(p);
  const [X, Y] = piv(p);
  let minY = Infinity;
  for (const [x, y] of r.paths[0].pts) minY = Math.min(minY, y);
  T("small swing stays below pivot region", minY > Y + (p.l1 + p.l2) * 0.8,
    `minY-Y=${(minY - Y).toFixed(1)} vs ${(p.l1 + p.l2).toFixed(0)}`);
}

/* Both = two paths per trace; pen-per-trace spreads layers */
{
  T("Both traces two curves", run({ trace: "Both" }).paths.length === 2);
  const layers = new Set(run({ traces: 4, penEach: true }).paths.map((q) => q.layer));
  T("pen per trace spreads layers", layers.size === 4, [...layers].join(","));
  const one = new Set(run({ traces: 4, penEach: false }).paths.map((q) => q.layer));
  T("single pen keeps one layer", one.size === 1);
}

/* detail decimation reduces points */
{
  T("coarser Detail reduces points",
    pts(run({ detail: 1.8 })) < pts(run({ detail: 0.3 })));
}

/* param liveness */
const live = (k, v, extra = {}) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run(extra)) !== sig(run({ ...extra, [k]: v })));
live("trace", "Bob 1");
live("traces", 3);
live("perturb", 1, { traces: 2 });
live("l1", 60);
live("l2", 20);
live("m2", 3);
live("a1", 60);
live("a2", 90);
live("grav", 2);
live("damp", 0.2);
live("time", 5);
live("detail", 1.5);
live("cx", 30);
live("cy", 70);
live("layer", 4);

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
