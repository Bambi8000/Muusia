/* tools/validate-wave_hatch.mjs — run from repo root.
   Validates nodes-lab/wave_hatch.plotternode.js, or the baked
   src/defs/nodes/wave_hatch.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/wave_hatch.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/wave_hatch.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/wave_hatch.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/wave_hatch.plotternode.js");
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
T("seed changes output", sig(run({ seed: 1 })) !== sig(run({ seed: 2 })));

/* finite + sanity + budget + margin */
let allFinite = true, allLen = true, maxPts = 0, inM = true;
const sweeps = [
  {}, { band: 10, pitch: 0.8 }, { amp: 1, wl: 20, wobble: 1, lean: 1 },
  { amp: 0, lean: 0, wobble: 0 }, { gap: 4, band: 80 }, { margin: 35, seed: 42 },
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

/* SEAM CHANNEL: no two vertically-adjacent points from different strokes sit
   closer than ~2*gap across a seam. Structural proxy: every path's vertical
   extent fits inside one band (strokes never bridge a seam) */
{
  const p = { ...defaults(), amp: 1 };
  const r = run(p);
  let worst = 0;
  for (const q of r.paths) {
    let y0 = 1e9, y1 = -1e9;
    for (const [, y] of q.pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    worst = Math.max(worst, y1 - y0);
  }
  const lim = p.band + 2 * (p.amp * (p.band / 2 - p.gap - 0.6) * 0.92);
  T("no stroke bridges a seam", worst <= lim + 0.01,
    `max stroke height ${worst.toFixed(1)} <= ${lim.toFixed(1)}`);
}

/* verticality: lean=0, wobble=0 -> strokes perfectly vertical */
{
  const r = run({ lean: 0, wobble: 0 });
  let maxDX = 0;
  for (const q of r.paths) {
    let x0 = 1e9, x1 = -1e9;
    for (const [x] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    maxDX = Math.max(maxDX, x1 - x0);
  }
  T("lean=0 gives vertical strokes", maxDX < 0.01, "maxDX=" + maxDX.toFixed(4));
  const rl = run({ lean: 1, wobble: 0, amp: 1 });
  let tilted = 0;
  for (const q of rl.paths) {
    let x0 = 1e9, x1 = -1e9;
    for (const [x] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    if (x1 - x0 > 1) tilted++;
  }
  T("lean tilts strokes through the waves", tilted > 50, tilted + " tilted strokes");
}

/* structure scaling */
{
  T("finer pitch adds strokes",
    run({ pitch: 0.8 }).paths.length > run({ pitch: 3 }).paths.length * 2);
  T("bigger gap removes ink", pts(run({ gap: 3.5 })) < pts(run({ gap: 0.5 })));
  T("amp=0 gives flat bands, still full coverage",
    run({ amp: 0 }).paths.length > 500);
}

/* param liveness */
const live = (k, v, extra = {}) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run(extra)) !== sig(run({ ...extra, [k]: v })));
live("band", 50);
live("amp", 0.1);
live("wl", 150);
live("pitch", 2.5);
live("gap", 3);
live("lean", 0.9);
live("wobble", 0.9);
live("margin", 25);
live("layer", 4);

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
