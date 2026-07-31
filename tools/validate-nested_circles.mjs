/* tools/validate-nested_circles.mjs — run from repo root.
   Validates nodes-lab/nested_circles.plotternode.js, or the baked
   src/defs/nodes/nested_circles.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/nested_circles.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/nested_circles.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/nested_circles.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/nested_circles.plotternode.js");
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
const centers = (p) => {
  const X = ctx.W * p.cx / 100, Y = ctx.H * p.cy / 100;
  const n = Math.round(p.count), rot = p.rotate * Math.PI / 180;
  return Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return [X + Math.cos(a) * p.spread, Y + Math.sin(a) * p.spread];
  });
};

T("determinism (double run identical)", sig(run()) === sig(run()));

let allFinite = true, allLen = true, maxPts = 0;
const sweeps = [
  {}, { count: 6, spread: 40 }, { fill: "Rays", rays: 120, hole: 20 },
  { weave: "Stack", count: 4 }, { spacing: 1.5, radius: 90, spread: 0 },
  { gap: 0 }, { gap: 5, hole: 60, radius: 61 }, { count: 3, rotate: 200, cx: 30, cy: 70 },
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

/* STACK: top disc untouched (all rings closed), bottom disc clipped with gap */
{
  const p = { ...defaults(), weave: "Stack", count: 2, penA: 1, penB: 5 };
  const r = run(p);
  const [c0, c1] = centers(p);
  const top = r.paths.filter((q) => q.layer === 5);
  const bot = r.paths.filter((q) => q.layer === 1);
  T("stack: top disc fully closed rings", top.length > 0 && top.every((q) => q.closed));
  T("stack: bottom disc has clipped arcs", bot.some((q) => !q.closed));
  let mind = Infinity;
  for (const q of bot) for (const [x, y] of q.pts)
    mind = Math.min(mind, Math.hypot(x - c1[0], y - c1[1]));
  T("stack: gap respected around top disc", mind >= p.radius + p.gap - 0.15,
    `minDist=${mind.toFixed(2)} limit=${(p.radius + p.gap).toFixed(2)}`);
}

/* WEAVE n=2: both discs clipped AND both keep points inside the lens
   (each is on top on its own side of the center line) */
{
  const p = { ...defaults(), weave: "Weave", count: 2, penA: 1, penB: 5 };
  const r = run(p);
  const [c0, c1] = centers(p);
  const inLens = ([x, y]) =>
    Math.hypot(x - c0[0], y - c0[1]) < p.radius - 0.5 &&
    Math.hypot(x - c1[0], y - c1[1]) < p.radius - 0.5;
  const a = r.paths.filter((q) => q.layer === 1);
  const b = r.paths.filter((q) => q.layer === 5);
  const lensA = a.reduce((s, q) => s + q.pts.filter(inLens).length, 0);
  const lensB = b.reduce((s, q) => s + q.pts.filter(inLens).length, 0);
  T("weave2: both discs clipped", a.some((q) => !q.closed) && b.some((q) => !q.closed));
  T("weave2: both present inside the lens", lensA > 50 && lensB > 50,
    `A=${lensA} B=${lensB}`);
  T("weave2: lens shared evenly", lensA / lensB > 0.5 && lensA / lensB < 2,
    (lensA / lensB).toFixed(2));
  // sides: disc0 points in the lens must lie (almost) only on its own side
  const side = ([x, y]) => (x - c0[0]) * (c1[1] - c0[1]) - (y - c0[1]) * (c1[0] - c0[0]);
  let wrongA = 0;
  for (const q of a) for (const pt of q.pts)
    if (inLens(pt) && side(pt) > 0.5) wrongA++;
  T("weave2: split follows the center line", wrongA / Math.max(1, lensA) < 0.02,
    `wrong-side=${wrongA}/${lensA}`);
}

/* WEAVE cyclic (4 discs): every disc is clipped by its predecessor AND
   keeps points inside its successor -> no disc is fully on top or bottom */
{
  const p = { ...defaults(), weave: "Weave", count: 4, spread: 32, penA: 1, penB: 5 };
  const r = run(p);
  const C = centers(p);
  const discPts = [[], [], [], []];
  // attribute paths to discs by nearest center of ring circle fit: use layer+ring center
  for (const q of r.paths) {
    let best = 0, bd = Infinity;
    let mx = 0, my = 0;
    for (const [x, y] of q.pts) { mx += x; my += y; }
    mx /= q.pts.length; my /= q.pts.length;
    // rings of disc i are centered near C[i] (arcs shift, so use point-radius vote)
    for (let i = 0; i < 4; i++) {
      const layerMatch = (i % 2 === 0 ? 1 : 5) === q.layer;
      if (!layerMatch) continue;
      let dev = 0;
      const rr = q.pts.map(([x, y]) => Math.hypot(x - C[i][0], y - C[i][1]));
      const mean = rr.reduce((a, b) => a + b) / rr.length;
      for (const v of rr) dev += Math.abs(v - mean);
      dev /= rr.length;
      if (dev < bd) { bd = dev; best = i; }
    }
    discPts[best].push(q);
  }
  let allWoven = true;
  const info = [];
  for (let i = 0; i < 4; i++) {
    const pred = (i + 3) % 4;
    let inPred = 0, clipped = discPts[i].some((q) => !q.closed);
    for (const q of discPts[i]) for (const pt of q.pts)
      if (Math.hypot(pt[0] - C[pred][0], pt[1] - C[pred][1]) < p.radius - 0.5) inPred++;
    // clipped by predecessor -> zero points inside predecessor (+gap)
    if (inPred > 0 || !clipped) allWoven = false;
    info.push(`d${i}:inPred=${inPred}`);
  }
  T("weave4: every disc tucks under its predecessor", allWoven, info.join(" "));
}

/* WEAVE FILL: the central multi-overlap must be covered with rings,
   while plain Weave leaves it empty at the same settings */
{
  const base = { count: 4, spread: 28, radius: 38 };
  const X = ctx.W * defaults().cx / 100, Y = ctx.H * defaults().cy / 100;
  const near = (r, d) => {
    let c = 0;
    for (const q of r.paths) for (const [x, y] of q.pts)
      if (Math.hypot(x - X, y - Y) < d) c++;
    return c;
  };
  const voidC = near(run({ ...base, weave: "Weave" }), 6);
  const fillC = near(run({ ...base, weave: "Weave fill" }), 6);
  T("Weave leaves center void (4 discs)", voidC === 0, "pts=" + voidC);
  T("Weave fill covers the center", fillC > 20, "pts=" + fillC);
  // globally consistent: with fill, in the pairwise lens both discs still appear
  const p = { ...defaults(), weave: "Weave fill", count: 2, penA: 1, penB: 5 };
  const r = run(p);
  const C2 = centers(p);
  const inLens = ([x, y]) =>
    Math.hypot(x - C2[0][0], y - C2[0][1]) < p.radius - 0.5 &&
    Math.hypot(x - C2[1][0], y - C2[1][1]) < p.radius - 0.5;
  const lensA = r.paths.filter((q) => q.layer === 1)
    .reduce((s, q) => s + q.pts.filter(inLens).length, 0);
  const lensB = r.paths.filter((q) => q.layer === 5)
    .reduce((s, q) => s + q.pts.filter(inLens).length, 0);
  T("Weave fill n=2: interlock preserved", lensA > 50 && lensB > 50,
    `A=${lensA} B=${lensB}`);
  T("param live: weave='Weave fill'", sig(run()) !== sig(run({ weave: "Weave fill" })));
}

/* BACKGROUND: Transparent = nothing clipped in any order mode;
   Opaque (default) = discs occlude, so outputs differ */
{
  for (const w of ["Weave", "Weave fill", "Stack"]) {
    const r = run({ weave: w, bg: "Transparent", count: 4, spread: 28 });
    T(`Transparent bg: all rings closed (${w})`,
      r.paths.length > 0 && r.paths.every((q) => q.closed), r.paths.length + " rings");
  }
  T("param live: bg", sig(run()) !== sig(run({ bg: "Transparent" })));
  // transparent output is order-independent
  T("Transparent bg ignores order",
    sig(run({ bg: "Transparent", weave: "Weave" })) === sig(run({ bg: "Transparent", weave: "Stack" })));
}

/* Rays mode sanity */
{
  const r = run({ fill: "Rays", hole: 14 });
  T("rays: open rays present", r.paths.some((q) => !q.closed));
  // with overlapping Weave discs even the rims are clipped to arcs (correct);
  // separate the discs to see intact rim + hole circles
  const far = run({ fill: "Rays", hole: 14, spread: 95 });
  T("rays: rim circles closed when discs apart", far.paths.some((q) => q.closed));
}

/* param liveness */
const live = (k, v) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run()) !== sig(run({ [k]: v })));
live("count", 4);
live("radius", 30);
live("spread", 50);
live("rotate", 120);
live("hole", 15);
live("fill", "Rays");
live("spacing", 6);
live("weave", "Stack");
live("gap", 4);
live("cx", 30);
live("cy", 70);
live("penA", 3);
live("penB", 7);
{
  T("param live: rays (Rays mode)",
    sig(run({ fill: "Rays", rays: 20 })) !== sig(run({ fill: "Rays", rays: 60 })));
}

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
