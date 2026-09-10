/* Validator for the Frame Grid node.
   Run from the repo root: node tools/validate-frame_grid.mjs
   First line tells you which source was tested — read it.
   Optional: node tools/validate-frame_grid.mjs --proof  writes proof-frame_grid.svg */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "frame_grid";

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
const CTX = { W: 420, H: 297, frameIdx: 0, frameCount: 6 };
const insOf = (p, node) => (typeof def.ins === "function" ? def.ins(node || { params: p }) : def.ins);
const run = (p, wired, ctx, node) => {
  const pins = insOf(p, node);
  const ins = pins.map((_, i) => (wired && wired[i]) || undefined);
  return def.compute.call(def, ins, p, ctx || CTX, node || { params: p });
};
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => pt.every((v) => Number.isFinite(v))));

/* synthetic frame content: full-canvas diagonal + a marked triangle, pen 5, one z point */
const mkFrame = (W, Hh) => ({
  paths: [
    { pts: [[0, 0], [W, Hh]], closed: false, layer: 5 },
    { pts: [[W * 0.2, Hh * 0.8], [W * 0.5, Hh * 0.2], [W * 0.8, Hh * 0.8]], closed: true, layer: 2 },
    { pts: [[10, 10, 1.5], [30, 10, 1.5]], closed: false, layer: 5 },
  ],
});

const pA = defaults();
const p0 = { ...pA, fill: "Inputs" };
const F = mkFrame(420, 297);
const wired6 = [F, F, F, F, F, F];

/* --- universal invariants --- */
const r1 = run(p0, wired6), r2 = run(p0, wired6);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");

const tol = 0.5;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) =>
  x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 420, 297), "in bounds on A3 wide");
ok(inb(run(p0, [mkFrame(297, 420)], { W: 297, H: 420 }), 297, 420), "in bounds on A3 tall");
ok(inb(run(p0, [mkFrame(297, 210)], { W: 297, H: 210 }), 297, 210), "in bounds on A4 wide");

/* --- markers with nothing wired --- */
const rBare = run(p0, []);
ok(rBare.paths.length > 0, "markers draw with no inputs wired (" + rBare.paths.length + " paths)");

/* --- marker oracle: photo_trace language --- */
/* centers exactly 20 mm from corners: an outline square (closed, 4 pts,
   side = markSize) must exist centered on each of the four points */
const sqAt = (r, cx, cy, size) => r.paths.some((q) => {
  if (!q.closed || q.pts.length !== 4) return false;
  const xs = q.pts.map((pt) => pt[0]), ys = q.pts.map((pt) => pt[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
  return Math.abs(w - size) < 1e-9 && Math.abs(h - size) < 1e-9 &&
    Math.abs(mx - cx) < 1e-9 && Math.abs(my - cy) < 1e-9;
});
for (const [cx, cy, tag] of [[20, 20, "TL"], [400, 20, "TR"], [400, 277, "BR"], [20, 277, "BL"]]) {
  ok(sqAt(r1, cx, cy, p0.markSize), "marker square at " + tag + " center (" + cx + "," + cy + "), side " + p0.markSize);
}
/* TL orientation hole: dia 0.4 x size — no plotted point strictly inside it,
   and a circle outline riding exactly on its radius */
const holeR = 0.2 * p0.markSize;
const inHole = r1.paths.some((q) => q.pts.some(([x, y]) =>
  Math.hypot(x - 20, y - 20) < holeR * 0.98));
ok(!inHole, "TL hole is clean (no point inside r*0.98)");
const onHole = r1.paths.some((q) => q.closed && q.pts.length > 20 &&
  q.pts.every(([x, y]) => Math.abs(Math.hypot(x - 20, y - 20) - holeR) < 1e-6));
ok(onHole, "TL hole circle outline present at r = 0.2 x size");
/* the other three markers are solid: hatch reaches their centers */
const solid = (cx, cy) => r1.paths.some((q) => !q.closed && q.pts.length === 2 &&
  Math.abs(q.pts[0][1] - cy) < 0.35 && Math.abs(q.pts[1][1] - cy) < 0.35 &&
  Math.min(q.pts[0][0], q.pts[1][0]) < cx && Math.max(q.pts[0][0], q.pts[1][0]) > cx);
ok(solid(400, 20) && solid(400, 277) && solid(20, 277), "TR/BR/BL markers hatched through center");
/* hatch pitch 0.6 mm: count hatch lines inside the TR marker */
const trHatch = r1.paths.filter((q) => !q.closed && q.pts.length === 2 &&
  q.pts.every(([x, y]) => Math.abs(x - 400) <= p0.markSize / 2 + 1e-9 && Math.abs(y - 20) <= p0.markSize / 2 + 1e-9) &&
  Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-9);
ok(Math.abs(trHatch.length - Math.round((p0.markSize - 0.6) / 0.6 + 1)) <= 1,
  "TR hatch line count ~ size/pitch (" + trHatch.length + ")");
/* chrome pen */
ok(r1.paths.filter((q) => !wiredContent(q)).every((q) => q.layer === p0.penMark), "chrome on marker pen");
function wiredContent(q) { return q.layer === 5 || q.layer === 2; }

/* --- cell mapping oracle (independent math, Map canvas) --- */
const W = 420, Hh = 297, m = p0.margin, gap = p0.gap, cols = 3, rows = 2;
const cw = (W - 2 * m - (cols - 1) * gap) / cols;
const ch = (Hh - 2 * m - (rows - 1) * gap) / rows;
const s = Math.min(cw / W, ch / Hh);
const cell = (i) => ({ x: m + (i % cols) * (cw + gap), y: m + Math.floor(i / cols) * (ch + gap) });
const expectPt = (i, x, y) => {
  const q = cell(i);
  return [q.x + (cw - W * s) / 2 + x * s, q.y + (ch - Hh * s) / 2 + y * s];
};
const diagIn = (r, i) => r.paths.find((q) => !q.closed && q.pts.length === 2 && q.layer === 5 &&
  Math.abs(q.pts[0][0] - expectPt(i, 0, 0)[0]) < 1e-9 && Math.abs(q.pts[0][1] - expectPt(i, 0, 0)[1]) < 1e-9 &&
  Math.abs(q.pts[1][0] - expectPt(i, W, Hh)[0]) < 1e-9 && Math.abs(q.pts[1][1] - expectPt(i, W, Hh)[1]) < 1e-9);
for (const i of [0, 1, 5]) ok(!!diagIn(r1, i), "cell " + (i + 1) + " canvas map matches oracle exactly");

/* registration: cells differ by pure translation */
const tri = (r, i) => r.paths.filter((q) => q.closed && q.layer === 2)[i].pts;
const t0 = tri(r1, 0), t1 = tri(r1, 1);
const dx = t1[0][0] - t0[0][0], dy = t1[0][1] - t0[0][1];
ok(t0.every((pt, k) => Math.abs(t1[k][0] - pt[0] - dx) < 1e-9 && Math.abs(t1[k][1] - pt[1] - dy) < 1e-9),
  "registration: cell 1 -> 2 is a pure translation");

/* z passthrough and no scaling of z */
const zed = r1.paths.filter((q) => q.pts.some((pt) => pt.length > 2));
ok(zed.length === 6 && zed.every((q) => q.pts.every((pt) => pt.length < 3 || pt[2] === 1.5)),
  "z component passes through unscaled in all 6 cells");
/* content pens survive */
ok(r1.paths.some((q) => q.layer === 5) && r1.paths.some((q) => q.layer === 2), "content keeps its pen layers");

/* input not mutated */
const frozen = mkFrame(420, 297);
const snap = JSON.stringify(frozen);
Object.freeze(frozen); frozen.paths.forEach((q) => { Object.freeze(q); q.pts.forEach((pt) => Object.freeze(pt)); });
run(p0, [frozen, frozen]);
ok(JSON.stringify(frozen) === snap, "inputs never mutated (deep-frozen run)");

/* empty / missing inputs per cell */
const rHole = run(p0, [F, undefined, { paths: [] }, F]);
ok(finiteAll(rHole) && !!diagIn(rHole, 0) && !diagIn(rHole, 1) && !diagIn(rHole, 2) && !!diagIn(rHole, 3),
  "unwired and empty inputs leave their cells empty");

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, wired, ctx) =>
  ok(JSON.stringify(run({ ...p0, ...patch }, wired || wired6, ctx)) !== bJ, "param live: " + label);
diff({ fill: "Clock" }, "fill");
diff({ count: 4 }, "count");
diff({ layout: "4\u00d73 \u00b7 12" }, "layout");
diff({ layout: "Custom", cols: 5 }, "cols (Custom)");
diff({ layout: "Custom", rows: 4 }, "rows (Custom)");
diff({ order: "Column-major" }, "order");
{
  const one = [{ paths: [F.paths[1]] }];
  ok(JSON.stringify(run({ ...p0, scale: "Fit each" }, one)) !== JSON.stringify(run(p0, one)),
    "param live: scale (sub-canvas content)");
}
diff({ margin: 10 }, "margin");
diff({ gap: 2 }, "gap");
diff({ marks: "Off" }, "marks");
diff({ markSize: 9 }, "markSize");
diff({ cellFrames: "On" }, "cellFrames");
diff({ numbers: "On" }, "numbers");
diff({ labelText: "TEST 2X3" }, "labelText");
diff({ penMark: 3 }, "penMark");
{
  const base = JSON.stringify(run({ ...p0, fill: "Clock", chrome: "Every frame" }, [F], { ...CTX, frameIdx: 2 }));
  const alt = JSON.stringify(run({ ...p0, fill: "Clock", chrome: "First frame only" }, [F], { ...CTX, frameIdx: 2 }));
  ok(base !== alt, "param live: chrome (Clock, frame 3)");
}

/* order semantics: frame 2 lands in a different cell */
const rCol = run({ ...p0, order: "Column-major" }, [F, F]);
ok(!!diagIn(rCol, 0) && !diagIn(rCol, 1) && !!diagIn(rCol, 3),
  "Column-major sends frame 2 to reading cell 4 (below cell 1)");

/* Fit each: triangle bbox fills its cell */
const rFit = run({ ...p0, scale: "Fit each" }, [{ paths: [F.paths[1]] }]);
const ft = rFit.paths.filter((q) => q.layer === 2)[0].pts;
const fw = Math.max(...ft.map((p) => p[0])) - Math.min(...ft.map((p) => p[0]));
const fh = Math.max(...ft.map((p) => p[1])) - Math.min(...ft.map((p) => p[1]));
ok(Math.abs(fw - cw) < 1e-6 || Math.abs(fh - ch) < 1e-6, "Fit each fills the cell on one axis");
ok(fw <= cw + 1e-6 && fh <= ch + 1e-6, "Fit each stays inside the cell");

/* --- Clock mode --- */
const pC = { ...p0, fill: "Clock" };
ok(insOf(pC).length === 1, "Clock mode exposes a single input pin");
ok(insOf(p0).length === p0.count, "Inputs mode exposes count pins");
const rC0 = run(pC, [F], { ...CTX, frameIdx: 0 });
const rC3 = run(pC, [F], { ...CTX, frameIdx: 3 });
ok(!!diagIn(rC0, 0) && !diagIn(rC0, 3), "Clock frame 1 fills cell 1 only");
ok(!!diagIn(rC3, 3) && !diagIn(rC3, 0), "Clock frame 4 fills cell 4 only");
const rC99 = run(pC, [F], { ...CTX, frameIdx: 99 });
ok(!!diagIn(rC99, 5), "Clock frameIdx clamps to the last cell");
const rCF = run({ ...pC, chrome: "First frame only" }, [F], { ...CTX, frameIdx: 3 });
ok(!sqAt(rCF, 20, 20, p0.markSize), "First frame only: no markers at frame 4");
ok(sqAt(run({ ...pC, chrome: "First frame only" }, [F], { ...CTX, frameIdx: 0 }), 20, 20, p0.markSize),
  "First frame only: markers present at frame 1");
ok(finiteAll(run(pC, [F], { W: 420, H: 297 })), "Clock survives a ctx without frameIdx");

/* --- Animate mode (frameFan seam v2 consumer) --- */
const runA = (p, frames, ctx) => def.compute.call(def, frames, p, ctx || CTX, { params: p });
ok(typeof def.frameFan === "function", "frameFan hook is a function");
ok(def.frameFan(null, pA) === pA.total && def.frameFan({ params: pA }) === pA.total,
  "frameFan returns Total frames in Animate (merged or node.params)");
ok(def.frameFan(null, p0) === 0 && def.frameFan(null, { ...pA, fill: "Clock" }) === 0,
  "frameFan opts out (0) in Inputs and Clock");
ok(def.frameFan(null, { ...pA, total: 999 }) === 64 && def.frameFan(null, { ...pA, total: -3 }) === 1,
  "frameFan clamps 1..64");
ok(insOf(pA).length === 1, "Animate mode exposes a single input pin");

/* 14 distinct frames: full-canvas diagonal + an ID tick at x = g */
const AF = Array.from({ length: 14 }, (_, g) => ({ paths: [
  { pts: [[0, 0], [420, 297]], closed: false, layer: 5 },
  { pts: [[g, 0], [g, 1]], closed: false, layer: 9 },
] }));
const pA14 = { ...pA, total: 14 };
const tickIn = (r, cellI, g) => r.paths.some((q) => q.layer === 9 &&
  Math.abs(q.pts[0][0] - expectPt(cellI, g, 0)[0]) < 1e-9 &&
  Math.abs(q.pts[0][1] - expectPt(cellI, g, 0)[1]) < 1e-9);
const pg0 = runA(pA14, AF, { ...CTX, frameIdx: 0 });
const pg1 = runA(pA14, AF, { ...CTX, frameIdx: 1 });
const pg2 = runA(pA14, AF, { ...CTX, frameIdx: 2 });
ok([0, 1, 2, 3, 4, 5].every((i) => tickIn(pg0, i, i)), "sheet 1 carries frames 1-6 in order");
ok([0, 1, 2, 3, 4, 5].every((i) => tickIn(pg1, i, 6 + i)), "sheet 2 carries frames 7-12");
ok(tickIn(pg2, 0, 12) && tickIn(pg2, 1, 13) &&
   !pg2.paths.some((q) => q.layer === 5 && q.pts.length === 2 && q.pts[0][0] > cell(2).x - 1),
  "sheet 3 carries frames 13-14 and leaves cells 3-6 empty");
ok(JSON.stringify(runA(pA14, AF, { ...CTX, frameIdx: 99 })) === JSON.stringify(pg2),
  "sheet index clamps to the last sheet");
ok(sqAt(pg1, 20, 20, pA.markSize), "full chrome on every sheet (markers on sheet 2)");

/* P n/N page tag: present only when there is more than one sheet */
const chromeOnly = (p, ctx) => runA(p, [], ctx).paths.length;
const tagStrokes = H.fontStrokes("P 1/3", 4).strokes.length;
ok(chromeOnly(pA14) - chromeOnly({ ...pA, total: 4 }) === tagStrokes,
  "P n/N tag drawn only on multi-sheet runs (" + tagStrokes + " strokes)");

/* global numbering: last sheet numbers 13 and 14 under its two occupied cells */
const numStrokes = H.fontStrokes("13", 3).strokes.length + H.fontStrokes("14", 3).strokes.length;
ok(runA({ ...pA14, numbers: "On" }, [], { ...CTX, frameIdx: 2 }).paths.length -
   runA(pA14, [], { ...CTX, frameIdx: 2 }).paths.length === numStrokes,
  "global frame numbers, only under occupied cells (13, 14)");

/* param liveness + fallback without the seam */
ok(JSON.stringify(runA(pA14, AF)) !== JSON.stringify(runA({ ...pA, total: 6 }, AF)), "param live: total");
const fb = runA(pA, [F]);
ok(!!diagIn(fb, 0) && !diagIn(fb, 1), "seamless fallback: single wired frame lands in cell 1");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt }, wired6);
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, margin: 0, gap: 0, markSize: 8, labelText: "X" }, wired6)), "margin 0 / gap 0 no NaN");
ok(finiteAll(run({ ...p0, layout: "Custom", cols: 1, rows: 1 }, wired6)), "1x1 grid no NaN");
ok(finiteAll(run({ ...p0, margin: 60, gap: 20, layout: "4\u00d74 \u00b7 16", count: 16, numbers: "On" },
  Array.from({ length: 16 }, () => F))), "16 cells, fat margin: finite");
ok(finiteAll(run(p0, wired6, { W: 100, H: 80 })), "tiny 100x80 canvas: finite (cells collapse cleanly)");
const big = { paths: Array.from({ length: 60 }, (_, i) => ({
  pts: Array.from({ length: 2000 }, (_, k) => [k * 0.2, i * 4]), closed: false, layer: 1 })) };
const rBig = run({ ...p0, layout: "4\u00d74 \u00b7 16", count: 16 }, Array.from({ length: 16 }, () => big));
ok(npts(rBig) <= 110000, "budget held with 16 heavy inputs (" + npts(rBig) + " pts)");
ok(sqAt(rBig, 20, 20, p0.markSize), "markers survive truncation (chrome first)");

/* --- overlay --- */
ok(typeof def.overlay === "function", "overlay exists");
const g1 = def.overlay.call(def, p0, CTX);
ok(Array.isArray(g1) && g1.some((q) => q.kind === "rect") && g1.some((q) => q.kind === "circle"),
  "overlay: cell rects + marker rects + hole circle");
ok(Array.isArray(def.overlay.call(def, p0, null)) &&
   Array.isArray(def.overlay.call(def, { ...p0, layout: "junk", margin: NaN }, CTX)),
  "overlay never throws on null ctx / garbage params");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(!vis(p0).includes("cols") && vis({ ...p0, layout: "Custom" }).includes("cols"), "showIf: cols only in Custom");
ok(!vis(p0).includes("chrome") && vis(pC).includes("chrome"), "showIf: chrome only in Clock");
ok(vis(pC).indexOf("count") === -1 && vis(pA).indexOf("count") === -1, "showIf: count only in Inputs");
ok(vis(pA).includes("total") && !vis(p0).includes("total") && !vis(pC).includes("total"),
  "showIf: total only in Animate");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined),
  "showIf: hidden params still carry defaults");

/* --- proof render --- */
if (process.argv.includes("--proof")) {
  const demo = (k) => {
    const paths = [];
    const rng = H.mulberry32(7);
    const cx = 210, cy = 148, R = 90;
    const a0 = (k / 6) * Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const a = a0 + (i / 80) * Math.PI * 2 * 2;
      const r = R * (0.35 + 0.6 * (i / 80));
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    paths.push({ pts, closed: false, layer: 2 });
    paths.push({ pts: [[cx - 100, cy], [cx + 100, cy]], closed: false, layer: 5 });
    void rng;
    return { paths };
  };
  const rP = run({ ...p0, numbers: "On", cellFrames: "On", labelText: "FRAME GRID 3X2" },
    Array.from({ length: 6 }, (_, k) => demo(k)));
  const cols10 = ["#23242A", "#2A56A8", "#C23A30", "#1F7A48", "#D2761E", "#6C42A6",
    "#1F8A80", "#C2408F", "#7A4A2B", "#7D828C", "#B8952E", "#3E9BD6"];
  const seg = rP.paths.map((q) =>
    `<polyline points="${q.pts.map((pt) => pt[0].toFixed(2) + "," + pt[1].toFixed(2)).join(" ") +
      (q.closed ? " " + q.pts[0][0].toFixed(2) + "," + q.pts[0][1].toFixed(2) : "")}" ` +
    `fill="none" stroke="${cols10[q.layer]}" stroke-width="0.5"/>`).join("\n");
  writeFileSync("proof-frame_grid.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 297" width="840" height="594">` +
    `<rect width="420" height="297" fill="#FAF7F0"/>\n${seg}\n</svg>`);
  console.log("proof written: proof-frame_grid.svg (" + rP.paths.length + " paths)");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
