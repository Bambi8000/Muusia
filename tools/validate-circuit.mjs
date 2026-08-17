/* Validator for the Circuit node (key "circuit").
   Run from the repo root: node tools/validate-circuit.mjs
   First line says [lab] or [baked] - READ IT.

   Three oracles carry this node, and the first two exist because the first
   version broke exactly there:

   1. ORTHOGONALITY. Every segment must be axis-aligned. The first version drew
      diagonals because a route drew the same random displacement twice, once
      for a corner and again for the point that had to share its coordinate.
      Nothing else in the test suite noticed - the output was finite, in bounds
      and in budget. A picture whose whole premise is right angles needs the
      right angles asserted.

   2. CORRIDORS. No trace may pass through a block. Routing checks this while
      generating; here it is re-checked from the outside on the finished paths,
      with the block rectangles recovered from _build. Separating block ink from
      trace ink is done by giving them different pens and filtering by layer.

   3. BLOCK DISJOINTNESS. Blocks must never overlap each other, or the columns
      stop reading as a structure. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "circuit";

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
const A4 = { W: 297, H: 210 };
const run = (patch, ctx) => def.compute([undefined], { ...p0, ...(patch || {}) }, ctx || A4, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const segsOf = (r, layer) => {
  const out = [];
  for (const q of r.paths) {
    if (layer !== undefined && q.layer !== layer) continue;
    const pts = q.closed ? q.pts.concat([q.pts[0]]) : q.pts;
    for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
  }
  return out;
};
const SEEDS = [1, 2, 3, 5, 7, 11, 19, 23, 41, 97];

/* --- descriptor contract --- */
for (const pd of def.params) {
  if (pd.type === "select") ok(Array.isArray(pd.options) && pd.options.length > 0, "select '" + pd.key + "' uses options[]");
  if (pd.type === "slider") ok([pd.min, pd.max, pd.step, pd.def].every(Number.isFinite), "slider '" + pd.key + "' has finite min/max/step/def");
}
ok(typeof def._build === "function", "_build is shared by compute and overlay");
ok(typeof def.overlay === "function", "node ships an overlay (it places blocks)");

/* --- universal invariants --- */
const r1 = run(), r2 = run();
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const inb = (r, W, Hh, tol) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210, 0.4), "in bounds on A4 wide");
ok(inb(run({}, { W: 210, H: 297 }), 210, 297, 0.4), "in bounds on A4 tall");
{
  const r = run({ margin: 35 });
  const xs = r.paths.flatMap((q) => q.pts.map((pt) => pt[0]));
  const ys = r.paths.flatMap((q) => q.pts.map((pt) => pt[1]));
  ok(Math.min(...xs) >= 34.6 && Math.max(...xs) <= 262.4 && Math.min(...ys) >= 34.6 && Math.max(...ys) <= 175.4,
    "margin 35 leaves the margin band empty");
}

/* ---------------------------------------------------------------- ORACLE 1
   every segment is axis-aligned, across seeds and every turn style */
{
  let worst = 0, bad = 0, total = 0, where = null;
  for (const seed of SEEDS) {
    for (const turns of def.params.find((q) => q.key === "turns").options) {
      for (const cross of def.params.find((q) => q.key === "cross").options) {
        const r = run({ seed, turns, cross, traces: 24 });
        for (const [a, b] of segsOf(r)) {
          total++;
          const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
          const off = Math.min(dx, dy);
          if (off > 1e-6) { bad++; if (off > worst) { worst = off; where = "seed " + seed + " / " + turns + " / " + cross; } }
        }
      }
    }
  }
  ok(bad === 0, "every segment is axis-aligned (" + total + " segments, " + bad + " diagonal" + (where ? ", worst " + worst.toFixed(3) + " mm at " + where : "") + ")");
}

/* ---------------------------------------------------------------- ORACLE 2
   no trace passes through a block. Block ink and trace ink are separated by
   giving them different pens, which is the only reliable way to tell them
   apart in the finished path set. */
{
  let violations = 0, tested = 0, seedsRun = 0;
  for (const seed of SEEDS) {
    const B = def._build({ ...p0, seed }, A4);
    if (!B || !B.ok) continue;
    seedsRun++;
    const r = run({ seed, layer: 0, tlayer: 1, traces: 24 });
    const clear = B.cell * 0.35 * 0.5;   /* half the routing clearance: a real breach is unambiguous */
    for (const [a, b] of segsOf(r, 1)) {
      tested++;
      const ax0 = Math.min(a[0], b[0]), ax1 = Math.max(a[0], b[0]);
      const ay0 = Math.min(a[1], b[1]), ay1 = Math.max(a[1], b[1]);
      for (const blk of B.blocks) {
        if (ax1 <= blk.x0 + clear || ax0 >= blk.x1 - clear) continue;
        if (ay1 <= blk.y0 + clear || ay0 >= blk.y1 - clear) continue;
        violations++;
        break;
      }
    }
  }
  ok(seedsRun === SEEDS.length, "every seed produced a layout (" + seedsRun + "/" + SEEDS.length + ")");
  ok(tested > 300, "corridor oracle saw enough trace segments (" + tested + ")");
  ok(violations === 0, "no trace segment crosses a block (" + violations + " breaches)");
}

/* ---------------------------------------------------------------- ORACLE 3
   blocks never overlap, and they stay clear of the baseline band */
{
  let overlaps = 0, onBase = 0, count = 0;
  for (const seed of SEEDS) {
    const B = def._build({ ...p0, seed }, A4);
    if (!B || !B.ok) continue;
    count += B.blocks.length;
    for (let i = 0; i < B.blocks.length; i++) {
      const a = B.blocks[i];
      if (B.nBase > 0 && a.y1 > B.Y(B.baseJ) - 1e-9) onBase++;
      for (let j = i + 1; j < B.blocks.length; j++) {
        const b = B.blocks[j];
        if (a.x1 > b.x0 + 1e-9 && b.x1 > a.x0 + 1e-9 && a.y1 > b.y0 + 1e-9 && b.y1 > a.y0 + 1e-9) overlaps++;
      }
    }
  }
  ok(count > 40, "blocks were actually placed across the seeds (" + count + ")");
  ok(overlaps === 0, "no two blocks overlap (" + overlaps + " pairs)");
  ok(onBase === 0, "no block sits on or below the baseline (" + onBase + ")");
  /* the placer must not silently give up on a crowded sheet */
  const many = def._build({ ...p0, blocks: 24, columns: 5, grid: 34, bwid: 3, bhgt: 2 }, A4);
  ok(many.ok && many.blocks.length >= 18, "a crowded request still places most blocks (" + many.blocks.length + "/24)");
}

/* --- fill spacing is paper-true --- */
{
  const gapsIn = (patch) => {
    const B = def._build({ ...p0, ...patch }, A4);
    const r = run({ ...patch, layer: 0, tlayer: 1, fill: "Hatch" });
    const blk = B.blocks[0];
    const xs = segsOf(r, 0)
      .filter(([a, b]) => Math.abs(a[0] - b[0]) < 1e-6 && a[0] > blk.x0 + 1e-6 && a[0] < blk.x1 - 1e-6
        && Math.min(a[1], b[1]) >= blk.y0 - 1e-6 && Math.max(a[1], b[1]) <= blk.y1 + 1e-6)
      .map(([a]) => a[0]).sort((u, v) => u - v);
    const d = [];
    for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 1e-6) d.push(xs[i] - xs[i - 1]);
    d.sort((u, v) => u - v);
    return d.length ? d[Math.floor(d.length / 2)] : NaN;
  };
  const a = gapsIn({}), b = gapsIn({ grid: 34 }), c = gapsIn({ margin: 40 });
  ok(Math.abs(a - p0.fspace) < 0.02, "hatch pitch equals Fill spacing (" + a.toFixed(3) + " vs " + p0.fspace + " mm)");
  ok(Math.abs(a - b) < 0.02 && Math.abs(a - c) < 0.02, "hatch pitch is unchanged by Grid and Margin (" + b.toFixed(3) + ", " + c.toFixed(3) + ")");
  const wide = gapsIn({ fspace: 2 });
  ok(Math.abs(wide - 2) < 0.03, "Fill spacing 2 mm really is 2 mm (" + wide.toFixed(3) + ")");
}

/* --- under gaps --- */
{
  const plain = run({ cross: "Overlap", traces: 24, seed: 3 });
  const cut = run({ cross: "Under gaps", traces: 24, seed: 3 });
  ok(cut.paths.length > plain.paths.length, "Under gaps splits traces into more pieces (" + plain.paths.length + " -> " + cut.paths.length + ")");
  ok(npts(cut) >= npts(plain), "Under gaps does not lose whole traces");
  ok(finiteAll(cut) && inb(cut, 297, 210, 0.4), "Under gaps output is finite and in bounds");
  const wider = run({ cross: "Under gaps", gapmm: 4, traces: 24, seed: 3 });
  ok(JSON.stringify(wider) !== JSON.stringify(cut), "Under gap mm changes the cut");
}

/* --- every parameter must do something --- */
{
  const base = JSON.stringify(run({ seed: 3 }));
  const live = (patch, label) => ok(JSON.stringify(run({ seed: 3, ...patch })) !== base, "param live: " + label);
  live({ blocks: 16 }, "blocks");
  live({ columns: 5 }, "columns");
  live({ grid: 32 }, "grid");
  live({ bwid: 9 }, "bwid");
  live({ bhgt: 6 }, "bhgt");
  live({ white: 5 }, "white");
  live({ baselines: 0 }, "baselines");
  live({ traces: 2 }, "traces");
  live({ bundle: 6 }, "bundle");
  live({ bpitch: 6 }, "bpitch");
  live({ turns: "L" }, "turns");
  live({ cross: "Under gaps" }, "cross");
  live({ frames: 8 }, "frames");
  live({ fill: "Contour" }, "fill");
  live({ fspace: 2.5 }, "fspace");
  live({ margin: 40 }, "margin");
  live({ seed: 4 }, "seed");
  ok(run({ seed: 3, layer: 5, tlayer: 5 }).paths.every((q) => q.layer === 5), "param live: pens");
  ok(new Set(run({ seed: 3, layer: 2, tlayer: 9 }).paths.map((q) => q.layer)).size === 2, "blocks and traces land on separate pens");
}

/* --- every select option draws --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ [pd.key]: opt, seed: 3 });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}
ok(run({ fill: "None", traces: 0, frames: 0, baselines: 0 }).paths.length > 0, "with everything off the block outlines still draw");

/* --- degenerate and extreme --- */
const hostile = [
  [{ blocks: 1, columns: 1, traces: 0, frames: 0 }, "one block, nothing else"],
  [{ blocks: 24, columns: 6, traces: 40, frames: 8, bundle: 6 }, "everything at maximum"],
  [{ grid: 8 }, "coarsest grid"],
  [{ grid: 40, bwid: 2, bhgt: 1 }, "finest grid, smallest blocks"],
  [{ bwid: 14, bhgt: 10, grid: 8 }, "blocks larger than the grid allows"],
  [{ white: 0 }, "cluster hard left"],
  [{ white: 100 }, "cluster hard right"],
  [{ baselines: 3 }, "three baselines"],
  [{ traces: 0 }, "no traces"],
  [{ frames: 0 }, "no frames"],
  [{ bundle: 6, bpitch: 8 }, "widest bundles"],
  [{ fspace: 0.3, blocks: 24, bwid: 14, bhgt: 10 }, "densest fill on the biggest blocks"],
  [{ margin: 0 }, "no margin"],
  [{ margin: 60 }, "maximum margin"],
  [{ cross: "Under gaps", traces: 40, bundle: 6, gapmm: 0.4 }, "maximum crossings, finest gap"],
];
for (const [patch, label] of hostile) {
  const t0 = Date.now();
  const r = run(patch);
  const ms = Date.now() - t0;
  ok(finiteAll(r) && inb(r, 297, 210, 0.4) && npts(r) <= 120000,
    "finite, in bounds, in budget: " + label + " (" + r.paths.length + " paths, " + npts(r) + " pts, " + ms + " ms)");
}
{
  /* a tiny canvas must degrade to nothing rather than to nonsense */
  const tiny = run({}, { W: 40, H: 30 });
  ok(Array.isArray(tiny.paths) && finiteAll(tiny), "a canvas smaller than the margin returns cleanly");
}

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  for (const t of [0, 1, 40]) for (const f of def.params.find((q) => q.key === "fill").options) {
    let threw = false;
    try { vis({ ...p0, traces: t, fill: f }); } catch (e) { threw = true; }
    ok(!threw, "showIf never throws (traces " + t + " / fill " + f + ")");
  }
  ok(vis({ ...p0, traces: 0 }).indexOf("bundle") < 0, "Bundle max hidden with no traces");
  ok(vis({ ...p0, traces: 8 }).indexOf("bundle") >= 0, "Bundle max shown with traces");
  ok(vis({ ...p0, fill: "None" }).indexOf("fspace") < 0, "Fill spacing hidden when there is no fill");
  ok(vis({ ...p0, traces: 8, cross: "Overlap" }).indexOf("gapmm") < 0, "Under gap mm hidden unless gaps are on");
  ok(vis({ ...p0, traces: 8, cross: "Under gaps" }).indexOf("gapmm") >= 0, "Under gap mm shown when gaps are on");
  /* hidden rows must still be inert, or hiding them conceals a live control */
  const b0 = JSON.stringify(run({ traces: 0, seed: 3 }));
  ok(JSON.stringify(run({ traces: 0, seed: 3, bundle: 6, bpitch: 7 })) === b0, "bundle params really are inert with no traces");
  const f0 = JSON.stringify(run({ fill: "None", seed: 3 }));
  ok(JSON.stringify(run({ fill: "None", seed: 3, fspace: 3.5 })) === f0, "Fill spacing really is inert with no fill");
}

/* --- overlay --- */
{
  let threw = false, guides = null;
  try { guides = def.overlay(p0, A4); } catch (e) { threw = true; }
  ok(!threw && Array.isArray(guides) && guides.length > 0, "overlay returns guides without throwing");
  ok(guides.every((g) => ["rect", "circle", "point", "arrow", "poly"].includes(g.kind)), "overlay uses only known guide kinds");
  const nums = guides.flatMap((g) => g.kind === "poly" ? g.pts.flat() : Object.values(g).filter((v) => typeof v === "number"));
  ok(nums.every(Number.isFinite), "overlay coordinates are all finite");
  /* the guide rectangles must BE the drawn blocks, not an approximation */
  const B = def._build(p0, A4);
  const gb = guides.filter((g) => g.kind === "rect").slice(1);
  ok(gb.length === Math.min(24, B.blocks.length), "overlay shows one rect per block");
  ok(gb.every((g, i) => Math.abs(g.x - B.blocks[i].x0) < 1e-9 && Math.abs(g.w - (B.blocks[i].x1 - B.blocks[i].x0)) < 1e-9),
    "overlay rects match the block geometry exactly");
  for (const bad of [{ margin: 200 }, { blocks: 0 }, { grid: 0 }, { columns: 0 }]) {
    let t2 = false;
    try { def.overlay({ ...p0, ...bad }, A4); } catch (e) { t2 = true; }
    ok(!t2, "overlay survives " + JSON.stringify(bad));
  }
  let t3 = false;
  try { def.overlay(p0, undefined); } catch (e) { t3 = true; }
  ok(!t3, "overlay survives a missing ctx");
}

/* --- purity --- */
{
  const p = { ...p0 };
  const snap = JSON.stringify(p);
  def.compute([undefined], p, A4, {});
  ok(JSON.stringify(p) === snap, "compute does not mutate the params object");
  const src = String(def.compute) + String(def._build);
  ok(!/Math\.random|document|window|navigator|Date\.now|performance\./.test(src), "no clock, DOM or device API");
  ok(/mulberry32/.test(src), "randomness comes from a seeded generator");
}

console.log(fails ? "\n" + fails + " FAILURE(S)" : "\nALL OK");
process.exitCode = fails ? 1 : 0;
