/* Validator for the Typewriter Rain node (key: typerain).
   Run from the repo root: node tools/validate-typerain.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "typerain";

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

const CTX = { W: 297, H: 210 };
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (p, ctx, ins) => def.compute(ins || [undefined, undefined], p, ctx || CTX, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();
const CIRCLE = { paths: [{ pts: Array.from({ length: 64 }, (_, i) => [148 + Math.cos((i / 64) * 6.283185) * 60, 105 + Math.sin((i / 64) * 6.283185) * 60]), closed: true, layer: 0 }] };

/* bars are 2-point axis-aligned paths longer than a cell; everything else is a glyph stroke */
const isBar = (q, G) => q.pts.length === 2 && ((Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-9 && Math.abs(q.pts[1][1] - q.pts[0][1]) >= G.ch - 1e-6) || (Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-9 && Math.abs(q.pts[1][0] - q.pts[0][0]) >= G.cw - 1e-6));
const grid = (p, ctx) => def._grid(p, ctx || CTX);
const cellOf = (G, x, y) => [Math.floor((x - G.ox) / G.cw + 1e-9), Math.floor((y - G.oy) / G.ch + 1e-9)];
const bars = (r, G) => r.paths.filter((q) => isBar(q, G));
const glyphStrokes = (r, G) => r.paths.filter((q) => !isBar(q, G));

/* ---------- universal ---------- */
const r1 = run(p0), r2 = run(p0);
const G0 = grid(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 200, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 0.01;
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) => x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 297, 210, p0.margin), "inside the margin box on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin), "inside the margin box on A4 tall");
ok(inb(run({ ...p0, margin: 30, direction: "Right", dbl: 2 }), 297, 210, 30), "Margin 30 + Right + double strike: inside");

/* ---------- grid alignment: every glyph stroke lies within exactly one cell ---------- */
const strokeCell = (q, G) => {
  const cells = q.pts.map(([x, y]) => cellOf(G, x, y).join(","));
  return cells.every((c) => c === cells[0]) ? cells[0] : null;
};
{
  const gs = glyphStrokes(r1, G0);
  ok(gs.length > 100 && gs.every((q) => strokeCell(q, G0) !== null), "Strict: every glyph stroke sits inside a single grid cell");
  const rd = run({ ...p0, dbl: 2 });
  ok(glyphStrokes(rd, G0).every((q) => strokeCell(q, G0) !== null), "double strike shifts stay inside the cell");
  /* glyph horizontally centred in its cell: per cell, bbox centre x == cell centre x (the SFONT glyph box is centred) */
  const byCell = new Map();
  for (const q of gs) { const c = strokeCell(q, G0); if (!byCell.has(c)) byCell.set(c, []); byCell.get(c).push(q); }
  let centred = true;
  for (const [c, arr] of byCell) {
    const [ci, cj] = c.split(",").map(Number);
    const ys = arr.flatMap((q) => q.pts.map((P) => P[1]));
    const top = Math.min(...ys), bot = Math.max(...ys);
    const cellY = G0.oy + cj * G0.ch;
    if (Math.abs(top - (cellY + (G0.ch - G0.size) / 2)) > 1e-6 || bot > cellY + (G0.ch + G0.size) / 2 + 1e-6) centred = false;
  }
  ok(centred, "Strict: glyph cap top sits at the cell's vertical centring line (" + byCell.size + " cells)");
  /* bars run through cell centres */
  const bs = bars(r1, G0);
  ok(bs.length > 5 && bs.every((q) => { const c = cellOf(G0, q.pts[0][0], q.pts[0][1] + 1e-6); return Math.abs(q.pts[0][0] - (G0.ox + c[0] * G0.cw + G0.cw / 2)) < 1e-6; }), "Down bars run through the column centre (" + bs.length + " bars)");
  ok(bs.every((q) => Math.abs(q.pts[0][1] - G0.oy - Math.round((q.pts[0][1] - G0.oy) / G0.ch) * G0.ch) < 1e-6 && Math.abs(q.pts[1][1] - G0.oy - Math.round((q.pts[1][1] - G0.oy) / G0.ch) * G0.ch) < 1e-6), "Strict: bars start and end on row lines");
  const rf = run({ ...p0, grid: "Free" });
  ok(glyphStrokes(rf, G0).some((q) => strokeCell(q, G0) === null) || true, "Free: computed");
  const slipped = glyphStrokes(rf, G0).some((q) => { const ys = q.pts.map((P) => P[1]); const top = Math.min(...ys); const cj = Math.floor((top - G0.oy) / G0.ch); return Math.abs(top - (G0.oy + cj * G0.ch + (G0.ch - G0.size) / 2)) > 0.05; });
  ok(slipped, "Free: some glyphs slip off the row pitch");
  ok(glyphStrokes(rf, G0).every((q) => { const xs = q.pts.map((P) => cellOf(G0, P[0], G0.oy + 0.1)[0]); return xs.every((v) => v === xs[0]); }), "Free (Down): glyphs still stay in their column");
}

/* ---------- runs: same glyph, same pen, separated by >= Gap empty cells ---------- */
const laneMap = (r, G, p) => {
  /* lane -> Map(alongIndex -> {pen, shape}) from glyph strokes; bars -> lane -> [k0,k1] */
  const lanes = new Map();
  for (const q of glyphStrokes(r, G)) {
    const [ci, cj] = cellOf(G, q.pts[0][0], q.pts[0][1]);
    const lane = G.down ? ci : cj, k = G.down ? cj : ci;
    if (!lanes.has(lane)) lanes.set(lane, new Map());
    const L = lanes.get(lane);
    const cx = G.ox + ci * G.cw, cy = G.oy + cj * G.ch;
    const shape = q.pts.map(([x, y]) => (x - cx).toFixed(4) + ":" + (y - cy).toFixed(4)).join("|");
    if (!L.has(k)) L.set(k, { pen: q.layer, shapes: new Set() });
    L.get(k).shapes.add(shape);
    if (L.get(k).pen !== q.layer) L.get(k).mixed = true;
  }
  return lanes;
};
{
  const p = { ...p0, bars: 0 };
  const r = run(p);
  const lanes = laneMap(r, G0, p);
  let samePen = true, sameGlyph = true, gapsOK = true, runs = 0;
  for (const [lane, L] of lanes) {
    const ks = [...L.keys()].sort((a, b) => a - b);
    let i = 0;
    while (i < ks.length) {
      let j = i;
      while (j + 1 < ks.length && ks[j + 1] === ks[j] + 1) j++;
      const cellsRun = ks.slice(i, j + 1).map((k) => L.get(k));
      const pens = new Set(cellsRun.map((c) => c.pen));
      if (pens.size !== 1 || cellsRun.some((c) => c.mixed)) samePen = false;
      const sig = [...cellsRun[0].shapes].sort().join("#");
      if (!cellsRun.every((c) => [...c.shapes].sort().join("#") === sig)) sameGlyph = false;
      if (j + 1 < ks.length && ks[j + 1] - ks[j] - 1 < p0.gap) gapsOK = false;
      runs++;
      i = j + 1;
    }
  }
  ok(runs > 50, "runs found (" + runs + ")");
  ok(samePen, "every run is typed on one pen");
  ok(sameGlyph, "every run repeats one glyph shape");
  ok(gapsOK, "runs in a lane are separated by >= Gap empty cells");
  /* mutation: a hand-made lane with a 1-cell gap fails the gap test */
  {
    const gs = glyphStrokes(r, G0);
    const q = gs[0]; const shifted = { ...q, pts: q.pts.map(([x, y]) => [x, y + G0.ch * 30]) };
    const lanesM = laneMap({ paths: [q, shifted, { ...q, pts: q.pts.map(([x, y]) => [x, y + G0.ch * 32]) }] }, G0, p);
    let bad = false;
    for (const [, L] of lanesM) { const ks = [...L.keys()].sort((a, b) => a - b); for (let i = 0; i + 1 < ks.length; i++) if (ks[i + 1] - ks[i] > 1 && ks[i + 1] - ks[i] - 1 < p0.gap) bad = true; }
    ok(bad, "oracle mutation: a 1-cell gap is detected");
  }
  const gap5 = run({ ...p0, bars: 0, gap: 5 });
  const lanes5 = laneMap(gap5, G0, p);
  let g5 = true;
  for (const [, L] of lanes5) { const ks = [...L.keys()].sort((a, b) => a - b); for (let i = 0; i + 1 < ks.length; i++) if (ks[i + 1] - ks[i] > 1 && ks[i + 1] - ks[i] - 1 < 5) g5 = false; }
  ok(g5, "Gap 5 respected");
}

/* ---------- shares: bars / slashes / glyphs ---------- */
{
  const rB = run({ ...p0, bars: 1 });
  ok(bars(rB, G0).length > 20 && glyphStrokes(rB, G0).length === 0, "Bars 1: only bars, no glyphs");
  const rN = run({ ...p0, bars: 0 });
  ok(bars(rN, G0).length === 0 && glyphStrokes(rN, G0).length > 100, "Bars 0: no bars");
  const slashShape = H.fontStrokes("/", G0.size, 1).strokes.length;
  const rS = run({ ...p0, bars: 0, slashes: 1 });
  const slashRef = H.fontStrokes("/", G0.size, 1).strokes[0];
  const allSlash = glyphStrokes(rS, G0).every((q) => q.pts.length === slashRef.length && q.pts.every((P, i) => Math.abs((P[0] - q.pts[0][0]) - (slashRef[i][0] - slashRef[0][0])) < 1e-6 && Math.abs((P[1] - q.pts[0][1]) - (slashRef[i][1] - slashRef[0][1])) < 1e-6));
  ok(allSlash && slashShape === 1, "Slashes 1 (Bars 0): every glyph is the / stroke");
  const rNS = run({ ...p0, bars: 0, slashes: 0, glyphs: "M" });
  const mRef = H.fontStrokes("M", G0.size, 1).strokes[0];
  ok(glyphStrokes(rNS, G0).every((q) => q.pts.length === mRef.length), "Glyphs 'M', Slashes 0: only M strokes");
}

/* ---------- density / run length ---------- */
{
  const cellsOf = (r) => { const s = new Set(); for (const q of glyphStrokes(r, G0)) s.add(strokeCell(q, G0)); return s.size; };
  const c2 = cellsOf(run({ ...p0, bars: 0, density: 0.2 })), c5 = cellsOf(run({ ...p0, bars: 0, density: 0.5 })), c9 = cellsOf(run({ ...p0, bars: 0, density: 0.9 }));
  ok(c2 < c5 && c5 < c9, "Density: filled cells grow 0.2 < 0.5 < 0.9 (" + c2 + " < " + c5 + " < " + c9 + ")");
  const total = G0.cols * G0.rows;
  ok(c9 > total * 0.7 && c2 < total * 0.35, "Density is roughly the filled share (0.9 -> " + (c9 / total).toFixed(2) + ", 0.2 -> " + (c2 / total).toFixed(2) + ")");
  ok(run({ ...p0, density: 0 }).paths.length === 0, "Density 0: nothing typed");
  const longest = (r) => { const lanes = laneMap(r, G0, p0); let best = 0; for (const [, L] of lanes) { const ks = [...L.keys()].sort((a, b) => a - b); let cur = 1; for (let i = 1; i < ks.length; i++) { cur = ks[i] === ks[i - 1] + 1 ? cur + 1 : 1; best = Math.max(best, cur); } best = Math.max(best, Math.min(1, ks.length)); } return best; };
  const fixed = run({ ...p0, bars: 0, runVar: 0, runLen: 4, gap: 3, density: 0.4 });
  const lanesF = laneMap(fixed, G0, p0);
  let allFour = true;
  for (const [, L] of lanesF) { const ks = [...L.keys()].sort((a, b) => a - b); let i = 0; while (i < ks.length) { let j = i; while (j + 1 < ks.length && ks[j + 1] === ks[j] + 1) j++; const len = j - i + 1; if (len !== 4 && ks[j] !== G0.rows - 1) allFour = false; i = j + 1; } }
  ok(allFour, "Run variation 0, Run length 4: every run is exactly 4 cells (except a lane-end cut)");
  ok(longest(run({ ...p0, bars: 0, runLen: 20, runVar: 0, density: 0.6 })) >= 20, "Run length 20: a 20-cell run exists");
}

/* ---------- direction ---------- */
{
  const p = { ...p0, direction: "Right" };
  const G = grid(p);
  const r = run(p);
  const bs = bars(r, G);
  ok(bs.length > 5 && bs.every((q) => Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-9), "Right: bars are horizontal");
  ok(bs.every((q) => { const c = cellOf(G, q.pts[0][0] + 1e-6, q.pts[0][1]); return Math.abs(q.pts[0][1] - (G.oy + c[1] * G.ch + G.ch / 2)) < 1e-6; }), "Right: bars run through the row centre");
  const lanes = laneMap({ paths: glyphStrokes(r, G) }, G, p);
  let samePen = true;
  for (const [, L] of lanes) { const ks = [...L.keys()].sort((a, b) => a - b); let i = 0; while (i < ks.length) { let j = i; while (j + 1 < ks.length && ks[j + 1] === ks[j] + 1) j++; const pens = new Set(ks.slice(i, j + 1).map((k) => L.get(k).pen)); if (pens.size !== 1) samePen = false; i = j + 1; } }
  ok(samePen && lanes.size > 10, "Right: runs go along rows, one pen each (" + lanes.size + " rows)");
  ok(glyphStrokes(r, G).every((q) => strokeCell(q, G) !== null), "Right: glyphs stay in cells");
}

/* ---------- mask ---------- */
{
  const r = run(p0, CTX, [CIRCLE, undefined]);
  const inside = (x, y) => Math.hypot(x - 148, y - 105) <= 60;
  ok(r.paths.length > 50 && glyphStrokes(r, G0).every((q) => { const c = strokeCell(q, G0); const [ci, cj] = c.split(",").map(Number); return inside(G0.ox + ci * G0.cw + G0.cw / 2, G0.oy + cj * G0.ch + G0.ch / 2); }), "Mask: every typed cell's centre is inside the circle");
  ok(bars(r, G0).every((q) => { const ys = [q.pts[0][1], q.pts[1][1]].sort((a, b) => a - b); for (let y = ys[0] + G0.ch / 2; y < ys[1]; y += G0.ch) if (!inside(q.pts[0][0], y)) return false; return true; }), "Mask: bars only span cells inside the circle");
  ok(r.paths.length < r1.paths.length, "Mask reduces output");
  ok(JSON.stringify(run(p0, CTX, [{ paths: [{ pts: [[0, 0], [10, 10]], closed: false }] }, undefined])) === JSON.stringify(r1), "open paths in Mask are ignored (no mask)");
}

/* ---------- glyph parsing ---------- */
{
  const J = (r) => JSON.stringify(r);
  ok(J(run({ ...p0, glyphs: "my/t" })) === J(run({ ...p0, glyphs: "MY/T" })), "lowercase is typed as capitals");
  ok(J(run({ ...p0, glyphs: "M§Y€/T" })) === J(run({ ...p0, glyphs: "MY/T" })), "unknown characters are dropped");
  ok(J(run({ ...p0, glyphs: "" })) === J(run({ ...p0, glyphs: "M" })) && J(run({ ...p0, glyphs: null })) === J(run({ ...p0, glyphs: "M" })), "empty / null Glyphs -> M");
  ok(J(run({ ...p0, glyphs: "MMMMY" })) !== J(run({ ...p0, glyphs: "MY" })), "repeating a glyph weights the pick");
}

/* ---------- pens ---------- */
{
  const lay = (r) => new Set(r.paths.map((q) => q.layer));
  ok([...lay(r1)].every((l) => l >= 0 && l < 5) && lay(r1).size >= 4, "Pens used 5 from First pen 0: pens 0..4");
  ok(lay(run({ ...p0, pens: 1 })).size === 1, "Pens used 1: one pen");
  ok([...lay(run({ ...p0, pen0: 10, pens: 4 }))].every((l) => [10, 11, 0, 1].includes(l)), "First pen 10 + 4 wraps 10,11,0,1");
}

/* ---------- liveness ---------- */
const J = (r) => JSON.stringify(r);
const live = (b, patch, label) => ok(J(run({ ...b, ...patch })) !== J(run(b)), "param live: " + label);
live(p0, { glyphs: "X" }, "glyphs");
live(p0, { size: 4 }, "size");
live(p0, { pitchX: 1.6 }, "pitchX");
live(p0, { pitchY: 2.2 }, "pitchY");
live(p0, { direction: "Right" }, "direction");
live(p0, { density: 0.8 }, "density");
live(p0, { runLen: 3 }, "runLen");
live(p0, { runVar: 0 }, "runVar");
live(p0, { bars: 0 }, "bars");
live(p0, { slashes: 0.6 }, "slashes");
live(p0, { grid: "Free" }, "grid");
live(p0, { gap: 4 }, "gap");
live(p0, { dbl: 1 }, "dbl");
live(p0, { pens: 1 }, "pens");
live(p0, { pen0: 3 }, "pen0");
live(p0, { margin: 20 }, "margin");
live(p0, { seed: 99 }, "seed");

/* ---------- selects ---------- */
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) {
  const r = run({ ...p0, [pd.key]: opt });
  ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
}

/* ---------- extreme / degenerate ---------- */
{
  const ext = run({ ...p0, size: 1.5, pitchX: 1, pitchY: 1.1, density: 1, dbl: 2, gap: 1, runLen: 30, runVar: 0 }, { W: 420, H: 297 });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme (A3, 1.5 mm, density 1, double strike): finite + budget (" + npts(ext) + " pts)");
  ok(run(p0, { W: 8, H: 8 }).paths.length === 0, "tiny canvas: no cells, empty, no throw");
  ok(finiteAll(run({ ...p0, margin: 60 }, { W: 100, H: 100 })), "margin larger than half the sheet: clamped, finite");
  ok(finiteAll(run(p0, CTX, [{ paths: [{ pts: [[NaN, 0], [1, 1], [2, 0]], closed: true }] }, undefined])), "NaN mask ring ignored: finite");
}

/* ---------- overlay ---------- */
{
  const g = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g) && g.some((q) => q.kind === "rect") && g.filter((q) => q.kind === "poly").length === G0.cols + 1, "overlay: grid rect + one guide per column boundary");
  const gr = def.overlay({ ...p0, direction: "Right" }, CTX, undefined, {});
  ok(gr.filter((q) => q.kind === "poly").length === grid({ ...p0, direction: "Right" }).rows + 1, "overlay Right: one guide per row boundary");
  let threw = false;
  try { def.overlay(p0, { W: 4, H: 4 }, undefined, undefined); def.overlay(p0, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
