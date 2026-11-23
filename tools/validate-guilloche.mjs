/* Validator for the Guilloché node. Run from the repo root:
   node tools/validate-guilloche.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "guilloche";

const bakedPath = resolve("src/defs/nodes/" + KEY + ".js");
const labPath = resolve("nodes-lab/" + KEY + ".plotternode.js");
let def, mode;
if (existsSync(bakedPath)) {
  def = (await import(pathToFileURL(bakedPath).href + "?v=" + Date.now())).default;
  mode = "[baked]";
} else if (existsSync(labPath)) {
  const src = readFileSync(labPath, "utf8");
  const names = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample",
    "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  def = new Function(...names, '"use strict"; return (' + src + ");")(...names.map((n) => H[n]));
  mode = "[lab]";
} else {
  console.error("FAIL: neither baked nor lab definition found");
  process.exit(1);
}
console.log(mode, def.key, "-", def.name);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const baseCtx = { W: 297, H: 210 };
const run = (p, ctx, ins) => def.compute(ins === undefined ? [undefined] : ins, p, ctx || baseCtx, {});
const countPts = (out) => out.paths.reduce((n, pa) => n + pa.pts.length, 0);
const inBounds = (out, W, H, eps = 1e-6) =>
  out.paths.every((pa) => pa.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= -eps && x <= W + eps && y >= -eps && y <= H + eps));
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* --- definition contract --- */
ok(/^[a-z][a-z0-9_]*$/.test(def.key), "key matches ^[a-z][a-z0-9_]*$");
ok(typeof def.name === "string" && def.name.length > 0, "name present");
ok(typeof def.desc === "string" && def.desc.length > 40, "desc present");
ok(def.cat === "gen", "cat is gen");
ok(["geometric", "organic", "machines", "nature", "creatures", "space", "scientific", "structural", "textimg"].includes(def.group), "group valid");
ok(def.ins.length === 1 && def.ins[0].type === "style", "single style input");
ok(def.outs.length === 1 && def.outs[0].type === "paths", "single paths output");
ok(def.params.length >= 10, "params populated (" + def.params.length + ")");
ok(def.params.every((pr) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(pr.key)), "param keys valid identifiers");
ok(new Set(def.params.map((pr) => pr.key)).size === def.params.length, "param keys unique");
ok(def.params.filter((pr) => pr.type === "pen").every((pr) => Number.isInteger(pr.def) && pr.def >= 0 && pr.def <= 11), "pen defaults 0..11");
ok(def.params.filter((pr) => pr.type === "select").every((pr) => Array.isArray(pr.options) && pr.options.includes(pr.def)), "select defaults in options");

/* --- structure per mode before clipping (297x210 sheet) --- */
const MODES = ["Rosette", "Rings", "Fan", "Weave", "Spiral"];
for (const m of MODES) {
  const p = { ...defaults(), mode: m, growth: 0 };
  let out;
  try { out = run(p); } catch (e) { ok(false, m + ": compute threw (" + e.message + ")"); continue; }
  const wantN = m === "Spiral" ? 1 : Math.round(p.copies);
  ok(out.paths.length === wantN, m + ": path count " + out.paths.length + " == " + wantN);
  const wantClosed = m === "Fan" || m === "Spiral" ? false : true;
  ok(out.paths.every((pa) => pa.closed === wantClosed), m + ": closed flag consistent");
  ok(inBounds(out, 297, 210), m + ": all points finite and on-sheet");
  ok(out.paths.every((pa) => pa.pts.length >= 2), m + ": no degenerate paths");
  ok(countPts(out) >= 2 * out.paths.length, m + ": sane density (" + countPts(out) + " pts)");
}

/* --- determinism and seed --- */
{
  const p = { ...defaults(), growth: 0 };
  const a = run(p), b = run(p);
  ok(deepEq(a.paths, b.paths), "deterministic: identical repeat run");
  const c = run({ ...p, seed: 8 });
  ok(!deepEq(a.paths, c.paths) && c.paths.length === a.paths.length, "seed changes geometry, keeps structure");
}

/* --- analytic geometry (jitter=0) --- */
{
  const lo = run({ ...defaults(), jitter: 0, mode: "Rings", waves: 24, amplitude: 0.02, growth: 0.012, copies: 12, seed: 3 });
  const cx = 297 / 2, cy = 210 / 2;
  const rad = (pts) => pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
  const minRad = lo.paths.map((pa) => Math.min(...rad(pa.pts)));
  let ordered = true;
  for (let i = 1; i < minRad.length; i++) if (minRad[i] < minRad[i - 1] - 1e-6) ordered = false;
  ok(ordered, "rings grow outward with Growth");
  const sp = lo.paths.map((pa) => { const rs = rad(pa.pts); return Math.max(...rs) - Math.min(...rs); });
  ok(sp.every((s) => s > 0.01), "rings carry serration amplitude");
}
{
  // Big sheet so the fit-cap never engages: pure scaling checks.
  const big = { W: 1000, H: 1000 };
  const r1 = run({ ...defaults(), jitter: 0, radius: 100, growth: 0 }, big);
  const r2 = run({ ...defaults(), jitter: 0, radius: 200, growth: 0 }, big);
  const ext = (o) => { let mx = 0; for (const pa of o.paths) for (const [x, y] of pa.pts) mx = Math.max(mx, Math.hypot(x - 500, y - 500)); return mx; };
  const ratio = ext(r2) / ext(r1);
  ok(Math.abs(ratio - 2) < 1e-6, "extent scales linearly with Radius (ratio " + ratio.toFixed(6) + ")");
  const eA = run({ ...defaults(), jitter: 0, amplitude: 0.05, growth: 0 }, big);
  const eB = run({ ...defaults(), jitter: 0, amplitude: 0.5, growth: 0 }, big);
  const ar = ext(eB) / ext(eA);
  // Amplitude 0.05 vs 0.5 at k=96: max-r ratio (1+0.5)/(1+0.05). Sampled
  // extremes sag off the analytic peak (2 samples per lobe), so allow slack.
  ok(Math.abs(ar - 1.5 / 1.05) < 0.01, "Amplitude controls lobe depth (ratio " + ar.toFixed(4) + ")");
}
{
  // Lobe frequency: radial maxima per revolution must equal Waves.
  const p = { ...defaults(), jitter: 0, mode: "Rosette", waves: 31, copies: 3, growth: 0 };
  const out = run(p);
  const cx = 148.5, cy = 105;
  const rho = out.paths[0].pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
  let peaks = 0;
  for (let i = 1; i < rho.length; i++) if (rho[i] > rho[i - 1] && rho[i] >= rho[(i + 1) % rho.length]) peaks++;
  ok(peaks === 31, "rosette lobe count equals Waves (" + peaks + ")");
}
{
  // Whole-pattern rotation invariance via area signature (jitter=0, even N).
  const p = { ...defaults(), jitter: 0, copies: 24, growth: 0 };
  const a = run(p);
  const area = (o) => o.paths.reduce((s, pa) => s + Math.abs(H.signedArea(pa.pts)), 0);
  ok(Math.abs(area(run({ ...p, angle: 90 })) - area(a)) / area(a) < 0.02, "90° rotation preserves signed area");
  const rot = 360 / 24;
  ok(Math.abs(area(run({ ...p, angle: rot })) - area(a)) / area(a) < 0.02, "symmetry-step rotation preserves area (" + rot + "°)");
}
{
  // Jitter stays inside the analytic band.
  const p = { ...defaults(), jitter: 1, mode: "Rings", amplitude: 0.3, growth: 0, radius: 80 };
  const out = run(p);
  const cx = 148.5, cy = 105;
  let within = true;
  for (const pa of out.paths) for (const [x, y] of pa.pts) {
    const r = Math.hypot(x - cx, y - cy);
    if (r < 80 * (1 - 0.3) - 80 * 0.3 * 0.5 - 0.01 || r > 80 * (1 + 0.3) + 80 * 0.3 * 0.5 + 0.01) within = false;
  }
  ok(within, "Jitter 1 stays within analytic radial band");
}
{
  const p = defaults(); p.accent = 100; p.pen2 = 5; p.layer = 0;
  const out = run(p);
  ok(out.paths.length > 0 && out.paths.every((pa) => pa.layer === 5), "Accent 100% puts every copy on the accent pen");
  const mid = run({ ...defaults(), accent: 50 });
  const frac = mid.paths.filter((pa) => pa.layer === 3).length / mid.paths.length;
  ok(frac > 0.2 && frac < 0.8, "Accent 50% splits the family (" + frac.toFixed(2) + ")");
  const none = run({ ...defaults(), accent: 0, layer: 2 });
  ok(none.paths.every((pa) => pa.layer === 2), "Accent 0 keeps every copy on the main pen");
}

/* --- clipping and budget --- */
{
  const p = { ...defaults(), mode: "Rings", radius: 800, growth: 0.06, copies: 96, waves: 40 };
  const out = run(p, { W: 210, H: 297 });
  ok(inBounds(out, 210, 297, 1e-4), "oversize family clips onto the sheet");
  ok(out.paths.some((pa) => pa.pts.some(([x, y]) => x <= 1e-4 || x >= 210 - 1e-4 || y <= 1e-4 || y >= 297 - 1e-4)), "clipped curves touch the edge");
  const first = out.paths[0];
  const fx = first.pts.map((q) => q[0]);
  ok(Math.max(...fx) - Math.min(...fx) < 210 * 0.98, "innermost ring stays unclipped");
}
{
  const p = { ...defaults(), mode: "Rings", radius: 500, growth: 0.06, copies: 96, waves: 360 };
  const out = run(p, { W: 751, H: 793 });
  ok(countPts(out) <= 120000, "worst case stays under the point budget (" + countPts(out) + ")");
  ok(out.paths.every((pa) => pa.pts.length >= 2), "budget guard keeps every curve whole");
}

/* --- style passthrough --- */
{
  const solid = run(defaults());
  ok(solid.paths.length > 0, "solid style passes paths through");
  for (const m of ["Dots", "Dashed"]) {
    let out;
    try { out = run(defaults(), baseCtx, [{ mode: m }]); } catch (e) { ok(false, m + " style threw"); continue; }
    ok(inBounds(out, 297, 210), m + " style stays on-sheet and finite");
    ok(out.paths.length === solid.paths.length, m + " style keeps path count");
  }
}

/* --- degenerate inputs --- */
{
  let threw = false;
  let out = { paths: [] };
  try { out = run(defaults(), { W: NaN, H: NaN }); } catch (e) { threw = true; }
  ok(!threw && Array.isArray(out.paths) && inBounds(out, 1, 1) || (!threw && out.paths.length === 0), "NaN context yields empty, no throw");
  threw = false;
  try { out = run(defaults(), { W: 0, H: 0 }); } catch (e) { threw = true; }
  ok(!threw && out.paths.length === 0, "zero-size context yields empty");
  threw = false;
  try { const n = def.overlay.call({}, undefined, undefined); ok(Array.isArray(n), "overlay survives broken binding"); } catch (e) { ok(false, "overlay threw on undefined ctx"); }
}
{
  const bad = { seed: NaN, mode: "Banana", radius: -5, waves: NaN, copies: -1, amplitude: NaN, growth: NaN, jitter: NaN, angle: NaN, margin: NaN, accent: NaN, layer: NaN, pen2: NaN };
  let threw = false;
  try { const out = run(bad); ok(!threw && inBounds(out, 297, 210), "garbage params fall back to safe defaults"); } catch (e) { threw = true; ok(false, "garbage params threw (" + e.message + ")"); }
}

/* --- fuzz: random configs, assorted sheets --- */
{
  const rng = H.mulberry32(1234);
  let allOk = true, note = "";
  for (let t = 0; t < 30; t++) {
    const W = 20 + Math.floor(rng() * 980), Hh = 20 + Math.floor(rng() * 980);
    const p = {
      seed: Math.floor(rng() * 1000),
      mode: MODES[Math.floor(rng() * MODES.length)],
      radius: 20 + rng() * 780,
      waves: 8 + Math.floor(rng() * 353),
      copies: 2 + Math.floor(rng() * 95),
      amplitude: 0.02 + rng() * 0.58,
      growth: rng() * 0.06,
      jitter: rng(),
      angle: -180 + rng() * 360,
      margin: rng() * 60,
      accent: rng() * 100,
      layer: Math.floor(rng() * 12),
      pen2: Math.floor(rng() * 12),
    };
    try {
      const out = run(p, { W, H: Hh });
      if (!inBounds(out, W, Hh) || countPts(out) > 120000) { allOk = false; note = "t" + t + " W" + W; }
    } catch (e) { allOk = false; note = "t" + t + " " + e.message; }
  }
  ok(allOk, "30-config fuzz: finite, on-sheet, within budget" + (note ? " (" + note + ")" : ""));
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
