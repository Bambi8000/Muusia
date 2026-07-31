/* tools/validate-brush_z.mjs — run from repo root.
   Validates nodes-lab/brush_z.plotternode.js, or the baked
   src/defs/nodes/brush_z.js if it exists (post-bake). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = await import(path.join(ROOT, "src/defs/helpers.js"));

const baked = path.join(ROOT, "src/defs/nodes/brush_z.js");
let N;
if (fs.existsSync(baked)) {
  N = (await import(baked)).default;
  console.log("target: baked src/defs/nodes/brush_z.js");
} else {
  const KEYS = ["Pin","EMPTY","PENS","mulberry32","hash2","noise2","resample",
    "pathLength","applyStyle","isStyle","signedArea","parseSVG","SFONT","fontStrokes"];
  const src = fs.readFileSync(path.join(ROOT, "nodes-lab/brush_z.plotternode.js"), "utf8");
  N = new Function(...KEYS, '"use strict"; return (' + src + ");")(
    ...KEYS.map((k) => H[k]));
  console.log("target: nodes-lab/brush_z.plotternode.js");
}

const ctx = { W: 210, H: 297 };
/* input: one long open line, one closed circle, one short line */
const line = (x0, y0, x1, y1, n) => Array.from({ length: n + 1 }, (_, i) =>
  [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
const circle = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});
const INPUT = { paths: [
  { pts: line(20, 40, 190, 40, 40), closed: false, layer: 2 },
  { pts: circle(105, 150, 50, 60), closed: true, layer: 3 },
  { pts: line(20, 250, 60, 250, 8), closed: false, layer: 2 },
] };
const defaults = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, inp = INPUT) => N.compute([inp], { ...defaults(), ...over }, ctx, {});
const sig = (r) => JSON.stringify(r.paths);

let fails = 0;
const T = (name, ok, info = "") => {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (info ? "  (" + info + ")" : ""));
  if (!ok) fails++;
};

T("determinism (double run identical)", sig(run()) === sig(run()));
T("unwired input tolerated", (() => {
  try { return N.compute([undefined], defaults(), ctx, {}).paths.length === 0; }
  catch { return false; }
})());

/* every point carries z; z within [0, depth]; finite */
{
  const p = { ...defaults(), ghost: false };
  const r = run(p);
  let ok = true, minz = Infinity, maxz = -Infinity;
  for (const q of r.paths) for (const pt of q.pts) {
    if (pt.length < 3 || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1]) ||
        !Number.isFinite(pt[2])) ok = false;
    minz = Math.min(minz, pt[2]); maxz = Math.max(maxz, pt[2]);
  }
  T("every point carries finite z", ok);
  T("z within [0, depth]", minz >= -1e-9 && maxz <= p.depth + 1e-9,
    `z ${minz.toFixed(3)}..${maxz.toFixed(3)} depth=${p.depth}`);
  T("layers/closed pass through",
    r.paths[0].layer === 2 && !r.paths[0].closed &&
    r.paths[1].layer === 3 && r.paths[1].closed);
}

/* z band respects zmin/zmax (mid-stroke, taper off, no jitter/noise) */
{
  const p = { ...defaults(), ends: 0, noiseAmt: 0, ampJit: 0, phaseJit: 0,
    zmin: 0.3, zmax: 0.7, depth: 2, ghost: false };
  const r = run(p);
  let mn = Infinity, mx = -Infinity;
  for (const pt of r.paths[0].pts) { mn = Math.min(mn, pt[2]); mx = Math.max(mx, pt[2]); }
  T("z band = zmin..zmax * depth",
    Math.abs(mn - 0.3 * 2) < 0.02 && Math.abs(mx - 0.7 * 2) < 0.02,
    `z ${mn.toFixed(2)}..${mx.toFixed(2)} expected 0.60..1.40`);
}

/* wavelength: sine maxima count on the 170 mm line ~ length/period */
{
  const p = { ...defaults(), ends: 0, noiseAmt: 0, phaseJit: 0, period: 20,
    sample: 0.5, ghost: false };
  const zs = run(p).paths[0].pts.map((q) => q[2]);
  let peaks = 0;
  for (let i = 1; i < zs.length - 1; i++)
    if (zs[i] > zs[i - 1] && zs[i] >= zs[i + 1]) peaks++;
  T("sine period matches Wavelength", Math.abs(peaks - 170 / 20) <= 1.5,
    `${peaks} peaks, expected ~${(170 / 20).toFixed(1)}`);
}

/* end taper: open path endpoints near z=0, closed path unaffected */
{
  const p = { ...defaults(), ends: 8, noiseAmt: 0, ghost: false, wave: "Constant" };
  const r = run(p);
  const open = r.paths[0].pts;
  T("open ends taper to zero",
    open[0][2] < 0.02 && open[open.length - 1][2] < 0.02,
    `z0=${open[0][2].toFixed(3)} zN=${open[open.length - 1][2].toFixed(3)}`);
  const cz = r.paths[1].pts.map((q) => q[2]);
  T("closed path skips taper", Math.min(...cz) > 0.5,
    "min z=" + Math.min(...cz).toFixed(2));
}

/* waves are live and distinct */
{
  const base = { ends: 0, noiseAmt: 0, phaseJit: 0, ghost: false };
  const sigs = ["Sine", "Triangle", "Square", "Pulse", "Noise", "Ramp up", "Ramp down", "Constant"]
    .map((w) => sig(run({ ...base, wave: w })));
  T("all 8 waves distinct", new Set(sigs).size === 8, new Set(sigs).size + " distinct");
}

/* ghost envelope: extra closed paths on ghost pen, width tracks z */
{
  const r = run({ ghost: true, ghostPen: 6, ghostW: 4, ends: 0, noiseAmt: 0 });
  const ghosts = r.paths.filter((q) => q.layer === 6 && q.closed);
  T("ghost adds closed envelopes", ghosts.length >= 3, ghosts.length + " envelopes");
  const r0 = run({ ghost: false });
  T("ghost off adds nothing", r0.paths.length === INPUT.paths.length);
}

/* param liveness */
const live = (k, v, extra = {}) => T(`param live: ${k}=${JSON.stringify(v)}`,
  sig(run(extra)) !== sig(run({ ...extra, [k]: v })));
live("zmin", 0.5);
live("zmax", 0.3);
live("depth", 3);
live("wave", "Triangle");
live("period", 60);
live("phase", 0.5, { phaseJit: 0 });
live("phaseJit", 0.9);
live("ampJit", 0.9);
live("noiseAmt", 0.9);
live("duty", 0.8, { wave: "Pulse" });
live("ends", 20);
live("sample", 3);
live("seed", 99, { noiseAmt: 0.5 });
live("ghostW", 7, { ghost: true });
live("ghostPen", 9, { ghost: true });

console.log(fails ? `\n${fails} FAILURES` : "\nALL OK");
process.exit(fails ? 1 : 0);
