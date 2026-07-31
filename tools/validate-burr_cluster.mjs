/* tools/validate-burr_cluster.mjs — run from repo root.
   Validates nodes-lab/burr_cluster.plotternode.js, or the baked
   src/defs/nodes/burr_cluster.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/burr_cluster.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/burr_cluster.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/burr_cluster.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/burr_cluster.plotternode.js");
}

const ctx = { W: 210, H: 297 };
const defaults = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}) => N.compute([undefined], { ...defaults(), ...over }, ctx, {});
const pts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const ink = (r) => r.paths.reduce((a, q) => a + H.pathLength(q.pts, q.closed), 0);
const sig = (r) => JSON.stringify(r.paths.map((q) => [q.closed, q.layer,
  q.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])]));

let fails = 0;
const T = (name, ok, info = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (info ? "  (" + info + ")" : ""));
  if (!ok) fails++;
};

T("determinism (double run identical)", sig(run()) === sig(run()));
T("seed changes output", sig(run({ seed: 1 })) !== sig(run({ seed: 2 })));

let allFinite = true, allLen = true, maxPts = 0, inM = true;
const sweeps = [
  {}, { lobes: 24, size: 40, spikes: 1, blots: 1 }, { spikes: 0, blots: 0 },
  { hatchStep: 0.7, speckle: 0 }, { speckle: 1, wobble: 1, angJit: 1 },
  { lobes: 3, size: 55, seed: 42 }, { margin: 35, cx: 20, cy: 20 },
];
for (const ov of sweeps) {
  const p = { ...defaults(), ...ov };
  const r = run(ov);
  maxPts = Math.max(maxPts, pts(r));
  for (const q of r.paths) {
    if (q.pts.length < 2) allLen = false;
    for (const [x, y] of q.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) allFinite = false;
      if (x < p.margin - 0.05 || x > ctx.W - p.margin + 0.05 ||
          y < p.margin - 0.05 || y > ctx.H - p.margin + 0.05) inM = false;
    }
  }
}
T("all coords finite", allFinite);
T("every path >= 2 pts", allLen);
T("point budget < 120000", maxPts < 120000, "max " + maxPts);
T("margin respected", inM);

/* spikes: many short 2-pt strokes; gone at 0 */
{
  const spiky = (r) => r.paths.filter((q) => q.pts.length === 2 && !q.closed).length;
  const s1 = spiky(run({ spikes: 1, blots: 0 }));
  const s0 = spiky(run({ spikes: 0, blots: 0 }));
  T("spikes bristle the edges", s1 > 150, s1 + " spikes");
  T("spikes=0 removes bristles", s0 === 0, s0 + "");
}

/* cluster connectivity proxy: hatch forms one mass — the bounding box of all
   hatch ink is much smaller than the sheet at default size */
{
  const r = run({ spikes: 0, blots: 0 });
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const q of r.paths) for (const [x, y] of q.pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  T("cluster is a bounded mass", (x1 - x0) < ctx.W * 0.95 && (y1 - y0) < ctx.H * 0.95,
    `${(x1 - x0).toFixed(0)}x${(y1 - y0).toFixed(0)}mm`);
}

/* speckle + hatchStep monotone; angle jitter zero -> horizontal grain */
{
  T("speckle eats ink", ink(run({ speckle: 0.9 })) < ink(run({ speckle: 0 })));
  T("wider hatch spacing thins fill",
    pts(run({ hatchStep: 2.5, spikes: 0 })) < pts(run({ hatchStep: 0.8, spikes: 0 })));
  const r = run({ angJit: 0, wobble: 0, spikes: 0, blots: 0 });
  let h = 0, v = 0;
  for (const q of r.paths) for (let i = 1; i < q.pts.length; i += 3) {
    const dx = Math.abs(q.pts[i][0] - q.pts[i - 1][0]);
    const dy = Math.abs(q.pts[i][1] - q.pts[i - 1][1]);
    if (dx > dy) h += dx; else v += dy;
  }
  // panel rows bow with the pod outline, so pure-horizontal energy sits
  // below 1.0 by design; dominant grain must still be horizontal
  T("angle jitter 0 -> horizontal grain", h / (h + v) > 0.8,
    (100 * h / (h + v)).toFixed(1) + "% horizontal");
}

/* blots: small closed loops; gone at 0 */
{
  const b1 = run({ blots: 1, spikes: 0 }).paths.filter((q) => q.closed).length;
  const b0 = run({ blots: 0, spikes: 0 }).paths.filter((q) => q.closed).length;
  T("blots splatter closed dots", b1 > 20, b1 + " loops");
  T("blots=0 removes dots", b0 === 0);
}

/* SPREAD: bigger spread -> larger cluster extent */
{
  const extent = (spread) => {
    const r = run({ spread, spikes: 0, blots: 0 });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const q of r.paths) for (const [x, y] of q.pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return (x1 - x0) * (y1 - y0);
  };
  T("spread expands the colony", extent(1) > extent(0) * 1.3,
    `${extent(1).toFixed(0)} > 1.3*${extent(0).toFixed(0)}`);
}
/* SEAM: erosion removes ink monotonically and separates panels */
{
  T("seam gap erodes ink", pts(run({ seam: 2.5 })) < pts(run({ seam: 0 })),
    `${pts(run({ seam: 2.5 }))} < ${pts(run({ seam: 0 }))}`);
  T("param live: seam", sig(run({ seam: 0 })) !== sig(run({ seam: 2 })));
  T("param live: spread", sig(run({ spread: 0 })) !== sig(run({ spread: 1 })));
}

/* param liveness */
const live = (k, v, extra = {}) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run(extra)) !== sig(run({ ...extra, [k]: v })));
live("lobes", 5);
live("size", 40);
live("hatchStep", 2.2);
live("angJit", 0.9);
live("speckle", 0.9);
live("wobble", 0.9);
live("spikes", 0.2);
live("spikeLen", 7, { spikes: 0.8 });
live("blots", 0.9);
live("cx", 25);
live("cy", 75);
live("margin", 30, { cx: 12, cy: 12, size: 40 }); // cluster at the corner: margin must clamp
live("layer", 4);

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
