/* Validator for the Broken Grid node. Run from the repo root:
   node tools/validate-broken_grid.mjs */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "broken_grid";

const bakedPath = resolve("src/defs/nodes/" + KEY + ".js");
const labPath = resolve("nodes-lab/" + KEY + ".plotternode.js");
let def, mode;
if (existsSync(bakedPath)) {
  def = (await import(pathToFileURL(bakedPath).href)).default;
  mode = "[baked]";
} else {
  const src = readFileSync(labPath, "utf8");
  const names = ["Pin", "EMPTY", "PENS", "mulberry32", "hash2", "noise2", "resample",
    "pathLength", "applyStyle", "isStyle", "signedArea", "parseSVG", "SFONT", "fontStrokes"];
  def = new Function(...names, '"use strict"; return (' + src + ");")(...names.map((n) => H[n]));
  mode = "[lab]";
}
console.log(mode, def.key, "-", def.name);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) fails++; };

const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const p0 = defaults();
const run = (p, ctx) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

/* --- universal --- */
const r1 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(run(p0)), "deterministic (double run byte-identical)");
ok(r1.paths.length > 200, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 1.5;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297) && run(p0, { W: 210, H: 297 }).paths.length > 100, "in bounds + non-empty on A4 tall");

/* helpers over output geometry */
const orient = (q) => Math.abs(q.pts[q.pts.length - 1][1] - q.pts[0][1]) > Math.abs(q.pts[q.pts.length - 1][0] - q.pts[0][0]) ? "V" : "H";
const mid = (q) => [(q.pts[0][0] + q.pts[q.pts.length - 1][0]) / 2, (q.pts[0][1] + q.pts[q.pts.length - 1][1]) / 2];
const dashLen = (q) => Math.hypot(q.pts[q.pts.length - 1][0] - q.pts[0][0], q.pts[q.pts.length - 1][1] - q.pts[0][1]);

/* --- either-or territories: at Mix 0 + high contrast, blocks of the
   canvas are dominated by one orientation; the block-wise vertical
   fraction must spread wide --- */
{
  const spread = (pp) => {
    const r = run(pp);
    const blocks = new Map();
    for (const q of r.paths) {
      const [x, y] = mid(q);
      const key = Math.floor(x / 60) + ":" + Math.floor(y / 53);
      if (!blocks.has(key)) blocks.set(key, [0, 0]);
      blocks.get(key)[orient(q) === "V" ? 0 : 1]++;
    }
    const fr = [...blocks.values()].filter(([a, b]) => a + b > 15).map(([a, b]) => a / (a + b));
    return { lo: Math.min(...fr), hi: Math.max(...fr) };
  };
  const hard = spread({ ...p0, mix: 0, contrast: 1, seed: 12 });
  ok(hard.hi > 0.8 && hard.lo < 0.25, "Mix 0: hard either-or territories (block V-fraction " + hard.lo.toFixed(2) + ".." + hard.hi.toFixed(2) + ")");
  const boxes = run({ ...p0, mix: 1, contrast: 1, seed: 12 });
  const vFrac = boxes.paths.filter((q) => orient(q) === "V").length / boxes.paths.length;
  ok(vFrac > 0.35 && vFrac < 0.65, "Mix 1: both orientations share the same territory (V " + (vFrac * 100).toFixed(0) + "%)");
}

/* --- gap shortens dashes, shift knocks them off the lattice --- */
{
  const meanLen = (pp) => {
    const r = run(pp);
    return r.paths.reduce((a, q) => a + dashLen(q), 0) / r.paths.length;
  };
  const l0 = meanLen({ ...p0, gap: 0, wobble: 0, shift: 0 });
  const l4 = meanLen({ ...p0, gap: 0.4, wobble: 0, shift: 0 });
  ok(l4 < l0 * 0.5, "Gap shortens dashes (" + l0.toFixed(1) + " -> " + l4.toFixed(1) + " mm)");
  const latDev = (pp) => {
    const r = run(pp);
    const cell = pp.cell;
    const nx = Math.max(1, Math.floor((297 - 2 * pp.margin) / cell));
    const ox = (297 - nx * cell) / 2;
    let dev = 0, n = 0;
    for (const q of r.paths) {
      if (orient(q) !== "V") continue;
      const f = (((q.pts[0][0] - ox) % cell) + cell) % cell;
      dev += Math.min(f, cell - f);
      n++;
    }
    return dev / Math.max(1, n);
  };
  const d0 = latDev({ ...p0, shift: 0, wobble: 0, doubles: 0 });
  const d1 = latDev({ ...p0, shift: 1, wobble: 0, doubles: 0 });
  ok(d0 < 0.05 && d1 > 0.6, "Shift knocks dashes off the lattice (dev " + d0.toFixed(2) + " -> " + d1.toFixed(2) + " mm)");
}

/* --- swastika guard: known-prone seeds must come out clean; the scanner
   reconstructs the edge lattice from the output and looks for isolated
   motifs (both chiralities, arm lengths 1..2) with the same isolation
   rule the node uses --- */
{
  const scan = (pp) => {
    const r = run(pp);
    const cell = pp.cell, m = pp.margin;
    const nx = Math.max(1, Math.floor((297 - 2 * m) / cell)), ny = Math.max(1, Math.floor((210 - 2 * m) / cell));
    const ox = (297 - nx * cell) / 2, oy = (210 - ny * cell) / 2;
    const EV = Array.from({ length: nx + 1 }, () => new Array(ny + 1).fill(false));
    const EH = Array.from({ length: nx + 1 }, () => new Array(ny + 1).fill(false));
    for (const q of r.paths) {
      const a = q.pts[0], b = q.pts[q.pts.length - 1];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0])) {
        const i = Math.round((mx - ox) / cell), j = Math.round((my - oy - cell / 2) / cell);
        if (i >= 0 && i <= nx && j >= 0 && j <= ny) EV[i][j] = true;
      } else {
        const i = Math.round((mx - ox - cell / 2) / cell), j = Math.round((my - oy) / cell);
        if (i >= 0 && i <= nx && j >= 0 && j <= ny) EH[i][j] = true;
      }
    }
    const gV = (i, j) => i >= 0 && j >= 0 && i <= nx && j < ny && EV[i][j];
    const gH = (i, j) => i >= 0 && j >= 0 && i < nx && j <= ny && EH[i][j];
    let hits = 0;
    for (let i = 1; i < nx; i++) for (let j = 1; j < ny; j++) {
      for (const L of [1, 2]) for (const cw of [true, false]) {
        let okm = true;
        const edges = [];
        for (let k = 1; k <= L && okm; k++) {
          if (!gV(i, j - k) || !gV(i, j + k - 1) || !gH(i + k - 1, j) || !gH(i - k, j)) okm = false;
          else edges.push(["V", i, j - k], ["V", i, j + k - 1], ["H", i + k - 1, j], ["H", i - k, j]);
        }
        if (!okm) continue;
        const bends = cw ? [["H", i, j - L], ["V", i + L, j], ["H", i - 1, j + L], ["V", i - L, j - 1]]
                         : [["H", i - 1, j - L], ["V", i + L, j - 1], ["H", i, j + L], ["V", i - L, j]];
        for (const [t, a, b] of bends) { if (t === "V" ? !gV(a, b) : !gH(a, b)) okm = false; else edges.push([t, a, b]); }
        if (!okm) continue;
        const nodes = [[i, j]];
        for (let k = 1; k <= L; k++) nodes.push([i, j - k], [i, j + k], [i + k, j], [i - k, j]);
        nodes.push(cw ? [i + 1, j - L] : [i - 1, j - L], cw ? [i + L, j + 1] : [i + L, j - 1], cw ? [i - 1, j + L] : [i + 1, j + L], cw ? [i - L, j - 1] : [i - L, j + 1]);
        const inM = new Set(edges.map((e) => e.join(",")));
        let extra = 0;
        for (const [a, b] of nodes) {
          if (gV(a, b) && !inM.has("V," + a + "," + b)) extra++;
          if (gV(a, b - 1) && !inM.has("V," + a + "," + (b - 1))) extra++;
          if (gH(a, b) && !inM.has("H," + a + "," + b)) extra++;
          if (gH(a - 1, b) && !inM.has("H," + (a - 1) + "," + b)) extra++;
        }
        if (extra <= 3) hits++;
      }
    }
    return hits;
  };
  const prone = [
    { seed: 20, mix: 1, contrast: 1, density: 0.45, cell: 6 },
    { seed: 36, mix: 1, contrast: 1, density: 0.45, cell: 6 },
    { seed: 59, mix: 0.6, contrast: 0.8, density: 0.55 },
    { seed: 59, mix: 1, contrast: 1, density: 0.45, cell: 6 },
  ];
  let residual = 0;
  for (const cfg of prone) residual += scan({ ...p0, ...cfg, shift: 0, wobble: 0, doubles: 0 });
  ok(residual === 0, "swastika guard: 4 known-prone seeds come out clean (" + residual + " residual motifs)");
  let sweep = 0;
  for (let seed = 1; seed <= 20; seed++)
    sweep += scan({ ...p0, seed, mix: 1, contrast: 1, density: 0.45, cell: 6, shift: 0, wobble: 0, doubles: 0 });
  ok(sweep === 0, "swastika guard: 20-seed sweep of the prone config is clean");
}

/* --- doubles add strokes --- */
{
  const n0 = run({ ...p0, doubles: 0 }).paths.length;
  const n1 = run({ ...p0, doubles: 1 }).paths.length;
  ok(n1 > n0 * 1.7, "Doubles adds parallel strokes (" + n0 + " -> " + n1 + ")");
}

/* --- params live --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => {
  const b = base ? JSON.stringify(run({ ...p0, ...base })) : bJ;
  ok(JSON.stringify(run({ ...p0, ...(base || {}), ...patch })) !== b, "param live: " + label);
};
diff({ seed: 8 }, "seed");
diff({ cell: 12 }, "cell");
diff({ zones: 0.5 }, "zones");
diff({ contrast: 0 }, "contrast");
diff({ density: 0.3 }, "density");
diff({ mix: 1 }, "mix");
diff({ gap: 0.4 }, "gap");
diff({ shift: 0.9 }, "shift", { shift: 0 });
diff({ doubles: 0.8 }, "doubles", { doubles: 0 });
diff({ wobble: 1 }, "wobble", { wobble: 0 });
diff({ margin: 40 }, "margin");
diff({ pen: 3 }, "pen");

/* --- degenerate / extreme --- */
ok(finiteAll(run({ ...p0, cell: 3, density: 1, doubles: 1, wobble: 1, gap: 0 })), "extreme density: finite");
ok(npts(run({ ...p0, cell: 3, density: 1, doubles: 1, wobble: 1 })) <= 120000, "extreme density: budget held");
ok(finiteAll(run({ ...p0, margin: 60 }, { W: 100, H: 100 })), "tiny canvas + huge margin: no NaN");
ok(run({ ...p0, density: 0.1, contrast: 1 }).paths.length >= 0 && finiteAll(run({ ...p0, density: 0.1, contrast: 1 })), "sparse end: no NaN");

/* --- overlay --- */
if (def.overlay) {
  const g1 = def.overlay.call(def, p0, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g1) && g1.some((g) => g.kind === "rect"), "overlay: margin rect");
  let threw = false;
  try { def.overlay.call({}, p0, { W: 4, H: 4 }, undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay survives degenerate input and broken this-binding");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
