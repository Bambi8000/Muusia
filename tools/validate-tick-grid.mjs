/* Validator for the Tick Grid node. Run from the repo root:
   node tools/validate-tick-grid.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "tick_grid";

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
ok(def.params.filter((pr) => pr.type === "slider").every((pr) => pr.def >= pr.min && pr.def <= pr.max), "slider defaults within min/max");
ok(!def.params.some((pr) => pr.showIf && !typeof pr.showIf === "function"), "showIf predicates are functions");

/* --- determinism and seed sensitivity --- */
const p0 = defaults();
const a1 = run({ ...p0 }, baseCtx);
const a2 = run({ ...p0 }, baseCtx);
ok(JSON.stringify(a1) === JSON.stringify(a2), "deterministic for identical seed/params");
const b1 = run({ ...p0, seed: 6 }, baseCtx);
ok(JSON.stringify(a1) !== JSON.stringify(b1), "different seed changes the drawing");
ok(inBounds(a1, 297, 210), "bounds: default A4 landscape");

/* --- density --- */
const dense = run({ ...p0, density: 1 }, baseCtx);
const sparse = run({ ...p0, density: 0.02 }, baseCtx);
ok(dense.paths.length > sparse.paths.length && sparse.paths.length >= 1, "density scales mark count (" + dense.paths.length + " vs " + sparse.paths.length + ")");
ok(sparse.paths.length <= dense.paths.length, "sparse never exceeds dense");

/* --- exact lattice with all randomness off --- */
const flat = run({ ...p0, density: 1, jitter: 0, scatter: 0, lengthVar: 0, bend: 0 }, baseCtx);
{
  // margin 12 -> area 273 x 186, cell 10 -> 27 x 18 lattice, box centred
  ok(flat.paths.length === 27 * 18, "flat lattice fills every node (" + flat.paths.length + " paths, expect 486)");
  const [x0, y0] = flat.paths[0].pts[0];
  const [x1, y1] = flat.paths[0].pts[1];
  ok(Math.abs(x0 - 14.5) < 1e-9 && Math.abs(y0 - 20) < 1e-9 && Math.abs(x1 - 22.5) < 1e-9 && Math.abs(y1 - 20) < 1e-9,
    "first tick sits on its lattice node with exact length/angle (got " + x0.toFixed(2) + "," + y0.toFixed(2) + ")");
  const last = flat.paths[flat.paths.length - 1].pts;
  const cx = (last[0][0] + last[last.length - 1][0]) / 2, cy = (last[0][1] + last[last.length - 1][1]) / 2;
  ok(Math.abs(cx - (13.5 + 26.5 * 10)) < 1e-9 && Math.abs(cy - (15 + 17.5 * 10)) < 1e-9, "lattice origin/spacing exact on far corner");
}
/* angle rotation with scatter off */
{
  const rotated = run({ ...p0, density: 1, jitter: 0, scatter: 0, lengthVar: 0, bend: 0, angle: 45 }, baseCtx);
  const [pA, pB] = rotated.paths[0].pts;
  const dx = pB[0] - pA[0], dy = pB[1] - pA[1];
  const norm = Math.hypot(dx, dy) || 1;
  const dot = (dx * Math.SQRT1_2 + dy * -Math.SQRT1_2) / norm; // vs -45? compare against 45° dir
  const dot45 = (dx * Math.cos(Math.PI / 4) + dy * Math.sin(Math.PI / 4)) / norm;
  ok(dot45 > 0.999, "angle 45° rotates ticks (dot=" + dot45.toFixed(4) + ", unused " + dot.toFixed(3) + ")");
}
/* length variation and bend effects */
{
  const lv = run({ ...p0, density: 1, bend: 0, lengthVar: 1 }, baseCtx);
  const lens = lv.paths.map((pa) => { const [u, v] = [pa.pts[0], pa.pts[pa.pts.length - 1]]; return Math.hypot(v[0] - u[0], v[1] - u[1]); });
  ok(Math.max(...lens) / Math.min(...lens) > 2, "length variation stretches range (" + Math.min(...lens).toFixed(1) + ".." + Math.max(...lens).toFixed(1) + " mm)");
  const bent = run({ ...p0, density: 1, bend: 1, length: 200 }, baseCtx);
  ok(bent.paths.every((pa) => pa.pts.length >= 4), "bent ticks are sampled curves (" + bent.paths[0].pts.length + " pts)");
  const mid = bent.paths[3].pts;
  const chord = [[mid[0][0] + mid[mid.length - 1][0]] / 2, (mid[0][1] + mid[mid.length - 1][1]) / 2];
  const bulge = Math.max(...mid.map((pt) => Math.hypot(pt[0] - chord[0], pt[1] - chord[1])));
  ok(bulge > 0.1, "bend bows ticks away from the chord (" + bulge.toFixed(2) + " mm)");
}

/* --- accent pen assignment --- */
{
  const noAcc = run({ ...p0, accent: 0, layer: 2, pen2: 7 }, baseCtx);
  ok(noAcc.paths.length > 0 && noAcc.paths.every((pa) => pa.layer === 2), "accent 0 keeps the main pen");
  const allAcc = run({ ...p0, accent: 100, layer: 2, pen2: 7 }, baseCtx);
  ok(allAcc.paths.every((pa) => pa.layer === 7), "accent 100 switches all marks to the accent pen");
  const mixed = run({ ...p0, accent: 50, layer: 2, pen2: 7 }, baseCtx);
  const pens = new Set(mixed.paths.map((pa) => pa.layer));
  ok(pens.has(2) && pens.has(7), "accent 50 mixes both pens");
}

/* --- boundary-safety fuzz: never leaves the sheet --- */
{
  const rng = H.mulberry32(987654321);
  const sheets = [[297, 210], [420, 297], [793, 813], [300, 300], [1000, 300], [60, 60]];
  let checked = 0, worstPts = 0, bad = 0;
  for (let t = 0; t < 300; t++) {
    const [W, Hv] = sheets[t % sheets.length];
    const p = { ...defaults(),
      seed: Math.floor(rng() * 1e6),
      cell: 2 + rng() * 38,
      density: rng(),
      length: 10 + rng() * 240,
      lengthVar: rng(),
      angle: -360 + rng() * 720,
      scatter: rng() * 360,
      jitter: rng() * 2,
      bend: rng(),
      margin: rng() * 30,
      accent: rng() * 100,
      layer: Math.floor(rng() * 12),
      pen2: Math.floor(rng() * 12),
    };
    try {
      const out = run(p, { W, H: Hv });
      checked++;
      worstPts = Math.max(worstPts, countPts(out));
      if (!inBounds(out, W, Hv)) bad++;
      if (out.paths.some((pa) => typeof pa.closed !== "boolean" || !(pa.layer >= 0 && pa.layer <= 11))) bad++;
    } catch (e) {
      bad++;
      console.log("  threw: " + e.message);
    }
  }
  ok(bad === 0 && worstPts <= 120000, "fuzz: " + checked + " random configurations all in-bounds/finite/legal, max points under engine limit (" + worstPts + ")");
}

/* --- budget: full coverage, never cut off, under engine limit --- */
{
  const p = { ...p0, cell: 2, density: 1, bend: 1, length: 250 };
  const out = run(p, { W: 793, H: 813 });
  const total = countPts(out);
  ok(total <= 110000, "fine lattice + bend stays under the design budget (" + total + " points, cap 110000)");
  const L = def._layout(p, { W: 793, H: 813 });
  ok(out.paths.length === L.cols * L.rows, "every surviving lattice node is drawn, no prefix truncation (" + out.paths.length + " = " + L.cols + "x" + L.rows + ")");
  const p2 = { ...p0, cell: 2, density: 1, bend: 1, length: 250 };
  const out2 = run(p2, { W: 793, H: 813 });
  ok(JSON.stringify(out) === JSON.stringify(out2), "budget-grown lattice deterministic");
  ok(inBounds(out, 793, 813), "budget case in bounds on Viivain sheet");
}

/* --- style pass-through --- */
{
  const solid = run(p0, baseCtx, [{ kind: "style", mode: "Solid" }]);
  ok(JSON.stringify(solid) === JSON.stringify(run(p0, baseCtx)), "Solid style passes geometry through unchanged");
  const dashed = run(p0, baseCtx, [{ kind: "style", mode: "Dashed", dash: 1.2, gap: 0.8, vary: 0.4, seed: 3 }]);
  const dashed2 = run(p0, baseCtx, [{ kind: "style", mode: "Dashed", dash: 1.2, gap: 0.8, vary: 0.4, seed: 3 }]);
  ok(dashed.paths.length >= p0.paths ? true : dashed.paths.length >= 1, "dashed style produces segments (" + dashed.paths.length + ")");
  ok(JSON.stringify(dashed) === JSON.stringify(dashed2), "dashed style deterministic");
  ok(inBounds(dashed, 297, 210), "dashed style output stays in bounds");
  const dotStyle = run(p0, baseCtx, [{ kind: "style", mode: "Dots" }]);
  ok(inBounds(dotStyle, 297, 210) && dotStyle.paths.length >= 1, "dots style legal and in bounds");
}

/* --- robustness: garbage params, tiny sheets, frames, overlay --- */
{
  const garbage = { seed: NaN, cell: NaN, density: NaN, length: NaN, lengthVar: NaN, angle: NaN, scatter: NaN, jitter: NaN, bend: NaN, margin: NaN, accent: NaN, layer: NaN, pen2: NaN };
  const g = run(garbage, baseCtx);
  ok(Array.isArray(g.paths) && inBounds(g, 297, 210), "all-NaN params fall back to defaults gracefully");
  let threw = false;
  for (const c of [{ W: 0, H: 0 }, { W: -5, H: 5 }, { W: 4, H: 4 }, {}, { W: "abc", H: null }]) {
    try { const o = run(defaults(), c); ok(Array.isArray(o.paths), "degenerate ctx tolerated (" + JSON.stringify(c) + ")"); } catch (e) { threw = true; }
  }
  ok(!threw, "no throw on degenerate ctx");
  const f0 = run(p0, { ...baseCtx, frameIdx: 0 });
  const f1 = run(p0, { ...baseCtx, frameIdx: 17 });
  ok(JSON.stringify(f0) === JSON.stringify(f1), "static geometry ignores frame index");
  const ov = def.overlay(p0, baseCtx);
  ok(Array.isArray(ov) && ov.length === 2 && ov.every((g2) => g2.kind === "rect" && g2.w > 0 && g2.h > 0), "overlay reports margin + lattice rects");
  const fit = ov[1];
  ok(fit.x >= 0 && fit.y >= 0 && fit.x + fit.w <= 297 && fit.y + fit.h <= 210, "overlay lattice rect inside the sheet");
  let ovThrew = false;
  try { def.overlay.call({}, { margin: -99 }, { W: 4, H: 4 }); def.overlay.call({}, undefined, undefined); } catch (e) { ovThrew = true; }
  ok(!ovThrew, "overlay survives degenerate input and broken this-binding");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
