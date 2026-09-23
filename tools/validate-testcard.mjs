/* Validator for the Test Card node (src/defs/nodes/testcard.js).
   Run from the repo root: node tools/validate-testcard.mjs
   Imports the REAL helpers. Auto-switches lab/baked; first line says which.

   Beyond the universal invariants it carries the oracles for the v2.101 fixes:
   - label clusters: glyph strokes of the numeric labels are clustered by
     proximity; overlapping labels merge into one cluster, so the cluster
     count must equal the number of labels (8 / 6 gaps, 4 hatch squares).
   - labels never overlap test geometry (bbox test against the Pen layer).
   - Line spacing lanes: every vertical line lies in its own group's lane and
     sits exactly on grp + k * gap - which also pins the thick series.
   - thick variants differ from fine, titles fit inside the cell.
   Mutation-tested: on the pre-patch node the cluster, lane and label-overlap
   checks FAIL (labels merged, 3 mm lines leaked into the 2 mm lane, hatch
   labels inside the squares). */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "testcard";

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
const A4W = { W: 297, H: 210 }, A4T = { W: 210, H: 297 };
const run = (p, ctx) => def.compute([undefined], p, ctx || A4W, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bbox = (pts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
};
const hits = (a, b, tol) => a.x0 < b.x1 - tol && b.x0 < a.x1 - tol && a.y0 < b.y1 - tol && b.y0 < a.y1 - tol;

const p0 = defaults();

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 1.0;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, A4T), 210, 297), "in bounds on A4 tall");

/* --- param liveness --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ tests: ["Line spacing"] }, "tests");
diff({ cols: 3 }, "cols");
diff({ cell: 40 }, "cell (defaults auto-shrink 62 -> 46 on A4 wide, so test below that)");
diff({ gap: 20 }, "gap");
diff({ labels: false }, "labels");
diff({ labelPen: 3 }, "labelPen");
diff({ margin: 30 }, "margin");
diff({ layer: 5 }, "layer");

/* --- every Tests option renders alone, on both orientations --- */
const testsParam = def.params.find((q) => q.key === "tests");
const OPTS = testsParam.options;
ok(OPTS.includes("Line weight sweep (thick)") && OPTS.includes("Line spacing (thick)") && OPTS.includes("Hatch density (thick)"),
  "Tests offers the three (thick) variants");
ok(JSON.stringify(testsParam.def) === JSON.stringify(["Line weight sweep", "Line spacing", "Hatch density", "Arcs & circles", "Pen-lift dots", "Fill swatches"]),
  "default Tests list unchanged (saved patches keep their selection)");
for (const opt of OPTS) {
  const r = run({ ...p0, tests: [opt] });
  const rt = run({ ...p0, tests: [opt] }, A4T);
  ok(r.paths.length > 0 && finiteAll(r) && finiteAll(rt) && inb(r, 297, 210) && inb(rt, 210, 297),
    "'" + opt + "' draws finite in-bounds paths (" + r.paths.length + ")");
}

/* --- layout replica for a single-test sheet (mirrors compute) --- */
const cellOf = (p, ctx, nTests) => {
  const cols = Math.round(p.cols), gap = p.gap, m = p.margin;
  const rowsN = Math.ceil(nTests / cols);
  const fitW = (ctx.W - 2 * m - (cols - 1) * gap) / cols;
  const fitH = (ctx.H - 2 * m - 6 - (rowsN - 1) * (gap + 6) - 6) / rowsN;
  const cs = Math.max(24, Math.min(p.cell, fitW, fitH));
  const gridW = cols * cs + (cols - 1) * gap;
  const x0 = m + Math.max(0, (ctx.W - 2 * m - gridW) / 2), y0 = m + 6;
  return { x0, y0, cs, ix: x0 + 3, iy: y0 + 3, iw: cs - 6, ih: cs - 6 };
};

/* --- label oracle: cluster numeric-label strokes, count clusters --- */
const PEN = 0, LAB = 1;
const single = (opt, ctx, extra) => run({ ...p0, tests: [opt], layer: PEN, labelPen: LAB, labels: true, ...(extra || {}) }, ctx || A4W);
const splitLabels = (r, geo) => {
  const content = r.paths.filter((q) => q.layer === PEN);
  const labs = r.paths.filter((q) => q.layer === LAB);
  const title = labs.filter((q) => bbox(q.pts).y1 < geo.y0 + 1);
  const nums = labs.filter((q) => bbox(q.pts).y1 >= geo.y0 + 1);
  return { content, title, nums };
};
const clusters = (strokes) => {
  const bb = strokes.map((q) => bbox(q.pts));
  const parent = bb.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < bb.length; i++) for (let j = i + 1; j < bb.length; j++) {
    const a = bb[i], b = bb[j];
    const sameRow = a.y0 < b.y1 + 0.3 && b.y0 < a.y1 + 0.3;
    const xgap = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1);
    if (sameRow && xgap < 0.9) parent[find(i)] = find(j);
  }
  const ids = new Set(bb.map((_, i) => find(i)));
  return ids.size;
};
const noOverlap = (nums, content) => nums.every((q) => {
  const a = bbox(q.pts);
  return content.every((c) => !hits(a, bbox(c.pts), 0.05));
});

const FINE_GAPS = [3, 2, 1.4, 1, 0.7, 0.5, 0.35, 0.25];
const THICK_GAPS = [8, 6, 4.5, 3.5, 2.5, 2];

for (const [opt, gaps] of [["Line spacing", FINE_GAPS], ["Line spacing (thick)", THICK_GAPS]]) {
  for (const [ctxName, ctx, extra] of [["A4 wide cell 62", A4W, {}], ["A4 tall cell 62", A4T, {}], ["cell 40", A4W, { cell: 40 }], ["cell 30", A4W, { cell: 30 }]]) {
    const r = single(opt, ctx, extra);
    const geo = cellOf({ ...p0, ...extra }, ctx, 1);
    const { content, nums } = splitLabels(r, geo);
    const n = clusters(nums);
    ok(n === gaps.length, "'" + opt + "' " + ctxName + ": label clusters = " + gaps.length + " (got " + n + ", no overprinting labels)");
    ok(noOverlap(nums, content), "'" + opt + "' " + ctxName + ": no label overlaps a test line");
    /* lanes + exact series */
    const pitch = geo.iw / gaps.length;
    let laneOK = true, seriesOK = true, groupsSeen = new Set(), inCell = true;
    for (const q of content) {
      const x = q.pts[0][0];
      if (Math.abs(q.pts[1][0] - x) > 1e-9) { laneOK = false; continue; }
      const g = Math.max(0, Math.min(gaps.length - 1, Math.floor((x - geo.ix + 1e-6) / pitch)));
      const grp = geo.ix + g * pitch;
      if (x > grp + pitch - 1 + 1e-6) laneOK = false;
      const k = (x - grp) / gaps[g];
      if (Math.abs(k - Math.round(k)) > 1e-6 || k < -1e-6 || k > 4 + 1e-6) seriesOK = false;
      groupsSeen.add(g);
      if (x > geo.ix + geo.iw + 1e-6) inCell = false;
    }
    ok(laneOK, "'" + opt + "' " + ctxName + ": every line stays in its own gap lane");
    ok(seriesOK, "'" + opt + "' " + ctxName + ": every line sits exactly on grp + k*gap (series " + gaps.join("/") + ")");
    ok(groupsSeen.size === gaps.length && inCell, "'" + opt + "' " + ctxName + ": all " + gaps.length + " groups drawn, inside the cell");
  }
}

const FINE_DENS = [2.5, 1.5, 1, 0.6], THICK_DENS = [8, 5, 3.5, 2.5];
for (const [opt, dens] of [["Hatch density", FINE_DENS], ["Hatch density (thick)", THICK_DENS]]) {
  for (const [ctxName, ctx, extra] of [["A4 wide cell 62", A4W, {}], ["cell 40", A4W, { cell: 40 }]]) {
    const r = single(opt, ctx, extra);
    const geo = cellOf({ ...p0, ...extra }, ctx, 1);
    const { content, nums } = splitLabels(r, geo);
    const n = clusters(nums);
    ok(n === 4, "'" + opt + "' " + ctxName + ": 4 label clusters (got " + n + ")");
    ok(noOverlap(nums, content), "'" + opt + "' " + ctxName + ": labels below squares, never over hatch or border");
    /* four squares, hatch pitch exact per square */
    const squares = content.filter((q) => q.closed && q.pts.length === 4);
    ok(squares.length === 4, "'" + opt + "' " + ctxName + ": four squares");
    let pitchOK = squares.length === 4;
    squares.forEach((sq, i) => {
      const b = bbox(sq.pts);
      const hz = content.filter((q) => !q.closed && Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-9 && q.pts[0][0] >= b.x0 - 1e-6 && q.pts[1][0] <= b.x1 + 1e-6 && q.pts[0][1] > b.y0 && q.pts[0][1] < b.y1);
      const ys = hz.map((q) => q.pts[0][1]).sort((a, c) => a - c);
      /* squares are emitted in order 0..3: TL, TR, BL, BR */
      const d = dens[i];
      for (let k = 0; k < ys.length; k++) if (Math.abs(ys[k] - (b.y0 + (k + 1) * d)) > 1e-6) pitchOK = false;
      if (ys.length !== Math.floor((b.y1 - b.y0 - 1e-9) / d)) pitchOK = false;
    });
    ok(pitchOK, "'" + opt + "' " + ctxName + ": hatch pitch exact per square (" + dens.join("/") + ")");
  }
}

/* --- thick weight sweep: wider band than fine, still inside its row --- */
{
  const f = single("Line weight sweep"), t = single("Line weight sweep (thick)");
  const geo = cellOf(p0, A4W, 1);
  const band = (r) => {
    const rows = 6, rowH = geo.ih / rows;
    let maxSpread = 0, rowOK = true;
    for (let rr = 0; rr < rows; rr++) {
      const yc = geo.iy + (rr + 0.5) * rowH;
      const ys = r.paths.filter((q) => q.layer === PEN && Math.abs(q.pts[0][1] - yc) < rowH / 2).map((q) => q.pts[0][1]);
      if (ys.length !== rr + 1) rowOK = false;
      const s = Math.max(...ys) - Math.min(...ys);
      if (s > maxSpread) maxSpread = s;
      if (s > rowH * 0.9) rowOK = false;
    }
    return { maxSpread, rowOK };
  };
  const bf = band(f), bt = band(t);
  ok(bf.rowOK && bt.rowOK, "weight sweep: rows carry 1..6 passes and stay inside their row (fine + thick)");
  ok(bt.maxSpread > bf.maxSpread * 3, "weight sweep (thick) spreads passes wider than fine (" + bt.maxSpread.toFixed(2) + " vs " + bf.maxSpread.toFixed(2) + " mm)");
  ok(JSON.stringify(f) !== JSON.stringify(t), "thick weight sweep differs from fine");
}
ok(JSON.stringify(single("Line spacing")) !== JSON.stringify(single("Line spacing (thick)")), "thick line spacing differs from fine");
ok(JSON.stringify(single("Hatch density")) !== JSON.stringify(single("Hatch density (thick)")), "thick hatch density differs from fine");

/* --- titles fit the cell --- */
for (const opt of ["Line weight sweep (thick)", "Hatch density (thick)", "Line spacing (thick)"]) {
  const r = single(opt), geo = cellOf(p0, A4W, 1);
  const { title } = splitLabels(r, geo);
  const tb = bbox(title.flatMap((q) => q.pts));
  ok(title.length > 0 && tb.x1 <= geo.x0 + geo.cs + 0.5, "'" + opt + "' title fits inside the cell (right edge " + tb.x1.toFixed(1) + " <= " + (geo.x0 + geo.cs).toFixed(1) + ")");
}

/* --- pens: content only on Pen, labels only on Label pen --- */
{
  const r = run({ ...p0, tests: OPTS.filter((o) => o !== "Pen palette (12)"), layer: 4, labelPen: 9 });
  ok(r.paths.every((q) => q.layer === 4 || q.layer === 9), "all paths on Pen or Label pen (palette excluded)");
  const r2 = run({ ...p0, tests: OPTS.filter((o) => o !== "Pen palette (12)"), layer: 4, labels: false });
  ok(r2.paths.every((q) => q.layer === 4), "labels off: everything on Pen");
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, tests: OPTS, cols: 1, cell: 30, gap: 4, margin: 0 })), "degenerate: all tests, one column, small cells, no margin -> no NaN");
const ext = run({ ...p0, tests: OPTS, cols: 4, cell: 120, gap: 8, margin: 20 }, A4T);
ok(finiteAll(ext) && npts(ext) <= 120000 && inb(ext, 210, 297), "extreme: all 12 tests, 4 cols, cell 120 (auto-shrunk) on A4 tall -> finite, budget, in bounds (" + npts(ext) + " pts)");
{
  const r = single("Line spacing", A4W, { cell: 24 });
  const geo = cellOf({ ...p0, cell: 24 }, A4W, 1);
  const { content, nums } = splitLabels(r, geo);
  ok(finiteAll(r) && noOverlap(nums, content), "cell 24 (minimum): line-spacing labels still clear of the lines");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
