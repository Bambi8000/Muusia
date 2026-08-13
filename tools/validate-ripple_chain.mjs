/* validate-ripple_chain.mjs — run from repo root: node tools/validate-ripple_chain.mjs
   Auto-switch: prefers baked src/defs/nodes/ripple_chain.js, falls back to
   nodes-lab/ripple_chain.plotternode.js evaluated with the REAL src/defs/helpers.js. */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const BAKED = "src/defs/nodes/ripple_chain.js";
const LAB = "nodes-lab/ripple_chain.plotternode.js";
let N, mode;
if (fs.existsSync(BAKED)) {
  N = (await import(pathToFileURL(path.resolve(BAKED)).href)).default;
  mode = "baked";
} else {
  const H = await import(pathToFileURL(path.resolve("src/defs/helpers.js")).href);
  const keys = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample", "pathLength", "applyStyle", "signedArea", "isStyle", "parseSVG", "SFONT", "fontStrokes"];
  const src = fs.readFileSync(LAB, "utf8");
  N = new Function(...keys, '"use strict"; return (' + src + ");")(...keys.map((k) => H[k]));
  mode = "lab";
}
console.log(`[${mode}] ripple_chain validator`);

const CTX = { W: 210, H: 297 };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };

/* synthetic inputs */
const line = (x0, y0, x1, y1, n = 40) => {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  return { paths: [{ pts, closed: false, layer: 0 }] };
};
const arcPath = () => {
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * Math.PI;
    pts.push([105 + Math.cos(a) * 70, 150 + Math.sin(a) * 70]);
  }
  return { paths: [{ pts, closed: false, layer: 0 }] };
};
/* triangle envelope: quiet at ends, loud in the middle (horizontal waveform) */
const triEnv = () => {
  const pts = [];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const amp = 1 - Math.abs(t - 0.5) * 2;
    pts.push([10 + t * 190, 150 + (i % 2 ? 1 : -1) * amp * 20]);
  }
  return { paths: [{ pts, closed: false, layer: 0 }] };
};

const run = (over = {}, pin = line(20, 150, 190, 150), amp = undefined) =>
  N.compute.call(N, [pin, amp, undefined], { ...defs(), ...over }, CTX, {});
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log("  ok  " + msg); } else { fail++; console.log("  FAIL " + msg); } };
const centroid = (pts) => pts.reduce((a, q) => [a[0] + q[0] / pts.length, a[1] + q[1] / pts.length], [0, 0]);

/* 1. determinism + unwired */
ok(JSON.stringify(run()) === JSON.stringify(run()), "deterministic (double run identical)");
ok(N.compute.call(N, [undefined, undefined, undefined], defs(), CTX, {}).paths.length === 0, "unwired input -> empty");

/* 2. finite, >=2 pts, all rings closed */
{
  const cases = [
    [{}, line(20, 150, 190, 150)],
    [{ seed: 2, scatter: 8, drift: 2, satellites: 1 }, arcPath()],
    [{ size: 20, spacing: 0.4, gap: 0.3, vary: 1, wave: 1 }, arcPath()],
    [{ size: 1, fill: 1 }, line(20, 20, 190, 280)],
  ];
  let fin = true, minP = true, closedOK = true;
  for (const [c, pin] of cases) {
    const r = run(c, pin);
    for (const ph of r.paths) {
      if (ph.pts.length < 2) minP = false;
      if (!ph.closed) closedOK = false;
      for (const [x, y] of ph.pts) if (!Number.isFinite(x) || !Number.isFinite(y)) fin = false;
    }
  }
  ok(fin, "all coordinates finite (4 cases)");
  ok(minP, "every path >= 2 points");
  ok(closedOK, "every ring is a closed path");
}

/* 3. every output path is a circle (drift 0): radius deviation < 3% */
{
  const r = run({ drift: 0 });
  let circ = true;
  for (const ph of r.paths) {
    const c = centroid(ph.pts);
    const rads = ph.pts.map(([x, y]) => Math.hypot(x - c[0], y - c[1]));
    const mean = rads.reduce((a, b) => a + b, 0) / rads.length;
    for (const rr of rads) if (Math.abs(rr - mean) > Math.max(0.05, mean * 0.03)) circ = false;
  }
  ok(circ, "rings are true circles at drift 0");
}

/* 4. clusters sit ON the path: scatter 0, drift 0 -> ring centers within 0.6 mm of the line */
{
  const r = run({ scatter: 0, drift: 0, satellites: 0 });
  let onPath = true;
  for (const ph of r.paths) {
    const c = centroid(ph.pts);
    if (Math.abs(c[1] - 150) > 0.6 || c[0] < 19 || c[0] > 191) onPath = false;
  }
  ok(onPath, "cluster centers ride the input path (scatter 0)");
}

/* 5. seed + param liveness */
ok(JSON.stringify(run({ seed: 1 })) !== JSON.stringify(run({ seed: 2 })), "seed changes output");
{
  const base = JSON.stringify(run());
  const live = [
    ["size", 12], ["minsize", 0.6], ["vary", 0.1], ["wave", 0.95], ["spacing", 1.6],
    ["gap", 2], ["fill", 0.8], ["drift", 1.5], ["scatter", 6], ["satellites", 0.95],
  ];
  for (const [k, v] of live) ok(JSON.stringify(run({ [k]: v })) !== base, `param live: ${k}`);
  ok(run({ layer: 4 }).paths.every((ph) => ph.layer === 4), "layer applied to every path");
}

/* 6. spacing monotonic: wider spacing -> fewer clusters (count distinct centers) */
{
  const centers = (sp) => {
    const r = run({ spacing: sp, satellites: 0, drift: 0, vary: 0, wave: 0 });
    const set = new Set();
    for (const ph of r.paths) {
      const c = centroid(ph.pts);
      set.add(Math.round(c[0] * 10) + ":" + Math.round(c[1] * 10));
    }
    return set.size;
  };
  const dense = centers(0.5), sparse = centers(1.8);
  ok(sparse < dense * 0.5, `spacing thins the chain (${sparse} < ${dense} clusters)`);
}

/* 7. gap monotonic: bigger ring gap -> fewer rings */
{
  const nPaths = (g) => run({ gap: g, satellites: 0, vary: 0, wave: 0 }).paths.length;
  ok(nPaths(2.5) < nPaths(0.4) * 0.6, `ring gap thins clusters (${nPaths(2.5)} < ${nPaths(0.4)} rings)`);
}

/* 8. ENVELOPE: triangle amplitude -> mid-path rings bigger than end rings */
{
  const r = run({ vary: 0, wave: 0, scatter: 0, drift: 0, satellites: 0, ampmin: 0, minsize: 0 }, line(20, 150, 190, 150), triEnv());
  let midMax = 0, endMax = 0;
  for (const ph of r.paths) {
    const c = centroid(ph.pts);
    const rad = Math.hypot(ph.pts[0][0] - c[0], ph.pts[0][1] - c[1]);
    const t = (c[0] - 20) / 170;
    if (t > 0.38 && t < 0.62) midMax = Math.max(midMax, rad);
    if (t < 0.14 || t > 0.86) endMax = Math.max(endMax, rad);
  }
  ok(midMax > endMax * 1.8, `amplitude envelope drives ring size (mid ${midMax.toFixed(2)} mm vs ends ${endMax.toFixed(2)} mm)`);
  ok(JSON.stringify(run({}, line(20, 150, 190, 150), triEnv())) !== JSON.stringify(run()), "wiring Amplitude changes output");
  ok(JSON.stringify(run({ ampmin: 0.7 }, line(20, 150, 190, 150), triEnv())) !== JSON.stringify(run({ ampmin: 0 }, line(20, 150, 190, 150), triEnv())), "param live: ampmin (with envelope)");
}

/* 9. multi-path input: every input path gets beads */
{
  const two = { paths: [...line(20, 60, 190, 60).paths, ...line(20, 240, 190, 240).paths] };
  const r = run({ scatter: 0, drift: 0, satellites: 0 }, two);
  let top = 0, bot = 0;
  for (const ph of r.paths) {
    const c = centroid(ph.pts);
    if (Math.abs(c[1] - 60) < 1) top++;
    if (Math.abs(c[1] - 240) < 1) bot++;
  }
  ok(top > 5 && bot > 5, `both input paths decorated (${top} + ${bot} rings)`);
}

/* 10. point budget at hostile settings */
{
  const r = run({ size: 20, spacing: 0.4, gap: 0.3, satellites: 1, fill: 0 }, arcPath());
  const total = r.paths.reduce((s, ph) => s + ph.pts.length, 0);
  ok(total <= 115000 + 600, `point budget respected (${total} pts)`);
}

/* 11. REGRESSION (v1 bug): big radii must not leave later input paths blank.
   Five concentric loops (a Tracks-style graph) at max radius - every loop gets beads. */
{
  const CTXB = { W: 300, H: 300 };
  const loops = { paths: [] };
  const radii = [30, 55, 80, 105, 130];
  for (const R of radii) {
    const pts = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      pts.push([150 + Math.cos(a) * R, 150 + Math.sin(a) * R]);
    }
    loops.paths.push({ pts, closed: true, layer: 0 });
  }
  const r = N.compute.call(N, [loops, undefined, undefined],
    { ...defs(), size: 20, satellites: 0.77, scatter: 8.6, drift: 1.4, gap: 1.45, minsize: 0.64, wave: 1 }, CTXB, {});
  const counts = radii.map(() => 0);
  for (const ph of r.paths) {
    const c = centroid(ph.pts);
    const rho = Math.hypot(c[0] - 150, c[1] - 150);
    let bi = 0;
    for (let k = 1; k < radii.length; k++) if (Math.abs(rho - radii[k]) < Math.abs(rho - radii[bi])) bi = k;
    counts[bi]++;
  }
  ok(counts.every((c) => c >= 3), `every loop decorated at max radius (${counts.join(", ")} rings per loop)`);
  const total = r.paths.reduce((s, ph) => s + ph.pts.length, 0);
  ok(total <= 115000 + 600, `budget held while sharing (${total} pts)`);
}

/* 12. REGRESSION: a long path over budget thins evenly - its tail still gets beads */
{
  const zig = { paths: [] };
  /* serpentine: 12 horizontal sweeps */
  const spts = [];
  for (let row = 0; row < 12; row++) {
    const y = 15 + row * 24;
    const xs = row % 2 === 0 ? [15, 195] : [195, 15];
    for (let i = 0; i <= 60; i++) spts.push([xs[0] + ((xs[1] - xs[0]) * i) / 60, y]);
  }
  zig.paths.push({ pts: spts, closed: false, layer: 0 });
  const r = N.compute.call(N, [zig, undefined, undefined],
    { ...defs(), size: 20, satellites: 1, gap: 0.4, minsize: 0.7 }, CTX, {});
  let tail = 0;
  for (const ph of r.paths) {
    const c = centroid(ph.pts);
    if (c[1] > 15 + 10 * 24) tail++; /* beads on the last two sweeps */
  }
  ok(tail >= 3, `oversubscribed path still beads its tail (${tail} rings in the last rows)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
