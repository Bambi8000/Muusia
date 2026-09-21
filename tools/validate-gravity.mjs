/* Validator for the Gravity node (key gravity).
   Run from the repo root: node tools/validate-gravity.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "gravity";

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
const CTX = { W: 297, H: 210 }, TALL = { W: 210, H: 297 };
const run = (p, stamp, ctx) => def.compute([stamp, undefined], p, ctx || CTX, {});
const lay = (p, ctx) => def._layout(p, ctx || CTX, [undefined, undefined]);
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();
const F0 = def._frame(p0, CTX);
const star = { paths: [{ pts: Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 0.45 : 1; return [Math.cos(a) * r, Math.sin(a) * r]; }), closed: true, layer: 0 }, { pts: [[-0.3, 0], [0.3, 0]], closed: false, layer: 0 }] };
const centroid = (pts) => [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
const bbox = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };
const tol = 1e-6;

/* ---------------------------------------------------------- universal */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length === p0.cols * p0.rows, "one Dot per grid element at defaults (" + r1.paths.length + ")");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const inMargin = (r, m, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= m - 0.01 && x <= W - m + 0.01 && y >= m - 0.01 && y <= Hh - m + 0.01));
ok(inMargin(r1, p0.margin, 297, 210), "everything inside the margin box");
ok(inMargin(run({ ...p0, drift: 0, sizeMod: 0 }, undefined, TALL), p0.margin, 210, 297), "A4 tall, no drift: inside the margin box");

/* ---------------------------------------------------------- release logic */
{
  const L0 = lay({ ...p0, release: 0 });
  ok(L0.els.length === p0.cols * p0.rows && L0.els.every((e) => e.state === "grid"), "Release 0: nothing released");
  const onGrid = L0.els.every((e) => Math.abs(e.x - (F0.gx + (e.i + 0.5) * F0.cell)) < tol && Math.abs(e.y - (F0.gy + (e.j + 0.5) * F0.cell)) < tol);
  ok(onGrid, "Release 0: every element exactly on its cell centre (no jitter)");
  const L1 = lay({ ...p0, release: 1, softness: 0, clumps: 0 });
  ok(L1.els.every((e) => e.state !== "grid") && L1.els.length + (p0.cols * p0.rows - L1.els.length) === p0.cols * p0.rows, "Release 1 (crisp): every element released");
  /* crisp line: rows below the line released, rows above intact */
  const Lc = lay({ ...p0, release: 0.5, softness: 0, clumps: 0 });
  const edge = 0.5;
  ok(Lc.els.every((e) => (((e.j + 0.5) / p0.rows > edge) === (e.state !== "grid"))), "Softness 0 + Clumps 0: release is a clean horizontal line");
  const Lt = lay({ ...p0, release: 0.7 });
  ok(Lt.els.filter((e) => e.j === 0).every((e) => e.state === "grid") && Lt.els.filter((e) => e.j === 0).length === p0.cols, "Release 0.7 with defaults: the top row is intact");
  const Ld = lay(p0);
  const released = Ld.els.filter((e) => e.state !== "grid").length + Ld.landedCount - Ld.els.filter((e) => e.state === "landed").length;
  ok(released > 0 && Ld.els.filter((e) => e.state === "grid").length > 0, "defaults: both intact and released elements exist");
  /* Clumps free elements above the line */
  const Lk = lay({ ...p0, release: 0.5, softness: 0, clumps: 1 });
  ok(Lk.els.some((e) => (e.j + 0.5) / p0.rows < 0.45 && e.state !== "grid"), "Clumps 1 frees elements above the release line");
  /* Progress = landed share */
  for (const pr of [0.2, 0.55, 0.9]) {
    const L = lay({ ...p0, progress: pr, pile: "Heap" });
    const rel = L.els.filter((e) => e.state !== "grid").length;
    const landed = L.els.filter((e) => e.state === "landed").length;
    ok(Math.abs(landed / rel - pr) < 0.12, "Progress " + pr + ": landed share " + (landed / rel).toFixed(2));
  }
  ok(lay({ ...p0, progress: 1 }).els.every((e) => e.state !== "falling"), "Progress 1: nobody is mid-air");
  ok(lay({ ...p0, progress: 0 }).els.every((e) => e.state !== "landed"), "Progress 0: nobody has landed");
}

/* ---------------------------------------------------------- falling modulation */
{
  const L = lay({ ...p0, drift: 0, sizeMod: 0, spin: 0 });
  const fall = L.els.filter((e) => e.state === "falling");
  ok(fall.length > 0 && fall.every((e) => Math.abs(e.x - (F0.gx + (e.i + 0.5) * F0.cell)) < tol), "Drift 0: falling elements keep their column x");
  ok(fall.every((e) => e.y > F0.gy + (e.j + 0.5) * F0.cell - tol && e.y <= F0.floor - e.r + tol), "falling elements are below their cell and above the floor");
  ok(fall.every((e) => e.ang === 0 && Math.abs(e.r - L.r0) < tol), "Spin 0 / Size mod 0: no rotation, no size change");
  const Ld = lay({ ...p0, drift: 10, sizeMod: -0.5, spin: 360 });
  const fd = Ld.els.filter((e) => e.state === "falling");
  ok(fd.some((e) => Math.abs(e.x - (F0.gx + (e.i + 0.5) * F0.cell)) > 0.5), "Drift 10 moves falling elements sideways");
  ok(fd.every((e) => e.r <= Ld.r0 + tol) && Ld.els.filter((e) => e.state === "landed").every((e) => Math.abs(e.r - Ld.r0 * 0.5) < tol), "Size mod -0.5: shrinks with the fall, landed at half radius");
  ok(fd.some((e) => Math.abs(e.ang) > 0.1) && Ld.els.filter((e) => e.state === "grid").every((e) => e.ang === 0), "Spin: falling elements rotate, intact ones do not");
  /* drift scales with the fall fraction: elements that have fallen little move little */
  const near = fd.filter((e) => e.f < 0.1), far = fd.filter((e) => e.f > 0.6);
  const mean = (a) => a.reduce((s, e) => s + Math.abs(e.x - (F0.gx + (e.i + 0.5) * F0.cell)), 0) / Math.max(1, a.length);
  ok(near.length && far.length && mean(near) < mean(far), "Drift grows with the fall fraction (" + mean(near).toFixed(2) + " < " + mean(far).toFixed(2) + " mm)");
  /* grid jitter: intact elements near the line move, top rows do not */
  const Lj = lay({ ...p0, gridJitter: 1, clumps: 0, softness: 0 });
  const grid = Lj.els.filter((e) => e.state === "grid");
  const off = (e) => Math.hypot(e.x - (F0.gx + (e.i + 0.5) * F0.cell), e.y - (F0.gy + (e.j + 0.5) * F0.cell));
  ok(grid.filter((e) => e.j === 0).every((e) => off(e) < tol) && grid.some((e) => off(e) > 0.5), "Grid jitter shakes intact elements near the line, not the top row");
}

/* ---------------------------------------------------------- Spin / size apply to */
{
  const LA = lay({ ...p0, modulate: "All", spin: 360, sizeMod: 0.8 });
  const grid = LA.els.filter((e) => e.state === "grid");
  ok(grid.some((e) => Math.abs(e.ang) > 0.1) && grid.some((e) => e.r > LA.r0 * 1.3), "All: intact elements spin and vary in size");
  ok(LA.els.every((e) => e.r >= LA.r0 - tol && e.r <= LA.r0 * 1.8 + tol), "All: Size mod +0.8 gives radii in [r0, 1.8 r0]");
  ok(LA.els.filter((e) => e.state === "landed").some((e) => Math.abs(e.ang) > 0.1), "All: landed elements spin too");
  const LF = lay({ ...p0, modulate: "Fallen only", spin: 360, sizeMod: 0.8 });
  ok(LF.els.filter((e) => e.state === "grid").every((e) => e.ang === 0 && Math.abs(e.r - LF.r0) < tol), "Fallen only: intact elements untouched");
  const ang = (LL) => new Map(LL.els.map((e) => [e.i + "," + e.j, e.ang]));
  const aA = ang(LA), aF = ang(LF);
  ok([...aF].filter(([k, v]) => v !== 0).every(([k, v]) => Math.sign(v) === Math.sign(aA.get(k))), "both modes share the hashed spin direction per element");
  ok(JSON.stringify(lay({ ...p0, modulate: "All", spin: 0, sizeMod: 0 })) === JSON.stringify(lay({ ...p0, modulate: "Fallen only", spin: 0, sizeMod: 0 })), "Spin 0 / Size mod 0: modes identical");
  const rS = run({ ...p0, modulate: "All", stamp: "Square", spin: 90 });
  const rotated = rS.paths.filter((q) => q.pts.some((P, k) => { const Q = q.pts[(k + 1) % 4]; return Math.abs(P[0] - Q[0]) > 1e-6 && Math.abs(P[1] - Q[1]) > 1e-6; })).length;
  ok(rotated > rS.paths.length * 0.8, "All + Square + Spin 90: nearly every square rotated (" + rotated + "/" + rS.paths.length + ")");
}

/* ---------------------------------------------------------- pile */
{
  const L = lay(p0);
  const landed = L.els.filter((e) => e.state === "landed");
  ok(landed.length > 10, "Heap: landed elements present (" + landed.length + ")");
  ok(landed.every((e) => e.y <= F0.floor - e.r + tol && e.x >= F0.m && e.x <= F0.m + F0.bw), "Heap: landed elements rest on or above the floor, inside the box");
  ok(landed.some((e) => Math.abs(e.y - (F0.floor - e.r)) < tol), "Heap: the bottom layer touches the floor");
  /* same-column stacking never overlaps */
  let overlap = 0;
  for (let a = 0; a < landed.length; a++) for (let b = a + 1; b < landed.length; b++) {
    const A = landed[a], B = landed[b];
    if (Math.abs(A.x - B.x) < A.r && Math.abs(A.y - B.y) < 2 * A.r * p0.packing * 0.99) overlap++;
  }
  ok(overlap === 0, "Heap: stacked elements in a column never overlap");
  /* sandpile: neighbouring column heights never differ by more than the roll threshold + one element */
  {
    const nCol = Math.max(1, Math.round(F0.bw / Math.max(0.5, 2 * L.r0 * 0.9))), cw = F0.bw / nCol;
    const hgt = new Float64Array(nCol);
    for (const e of landed) { const k = Math.min(nCol - 1, Math.max(0, Math.floor((e.x - F0.m) / cw))); hgt[k] = Math.max(hgt[k], F0.floor - (e.y - e.r)); }
    const lim = 2 * L.r0 * p0.packing * 0.9 + 2 * L.r0 * p0.packing + 1e-6;
    let steep = 0;
    for (let k = 0; k + 1 < nCol; k++) if (hgt[k] > 0 && hgt[k + 1] > 0 && Math.abs(hgt[k] - hgt[k + 1]) > lim) steep++;
    ok(steep === 0 && Math.max(...hgt) > 3 * L.r0, "Heap: sandpile slope limit holds between occupied neighbour columns (peak " + Math.max(...hgt).toFixed(1) + " mm)");
  }
  /* mound: with spread 0.3 the highest element sits in the middle 40 % of the box */
  const Lm = lay({ ...p0, spread: 0.3, progress: 0.9, release: 0.8 });
  const top = Lm.els.filter((e) => e.state === "landed").sort((a, b) => a.y - b.y)[0];
  ok(top && Math.abs(top.x - (F0.m + F0.bw / 2)) < F0.bw * 0.2, "Pile spread 0.3: the heap peaks in the middle");
  const Lw = lay({ ...p0, spread: 1, progress: 0.9, release: 0.8 });
  const peak = (LL) => Math.min(...LL.els.filter((e) => e.state === "landed").map((e) => e.y));
  ok(peak(Lm) < peak(Lw), "narrower spread -> higher heap");
  const Lf = lay({ ...p0, pile: "Floor" });
  ok(Lf.els.filter((e) => e.state === "landed").every((e) => Math.abs(e.y - (F0.floor - e.r)) < tol), "Floor: every landed element on the floor line");
  const Ln = lay({ ...p0, pile: "None" });
  ok(Ln.els.length === p0.cols * p0.rows - Ln.landedCount && Ln.els.every((e) => e.state !== "landed"), "None: landed elements leave the sheet (" + Ln.landedCount + " gone)");
  ok(run({ ...p0, pile: "None" }).paths.length === Ln.els.length, "None: output count matches");
  const Lp = lay({ ...p0, packing: 1.4 });
  ok(peak(Lp) < peak(L), "Packing 1.4 stacks looser -> taller heap");
}

/* ---------------------------------------------------------- stamps */
{
  const rs = run(p0, star);
  ok(rs.paths.length === p0.cols * p0.rows * star.paths.length, "wired stamp: input paths x elements (" + rs.paths.length + ")");
  ok(rs.paths.some((q) => !q.closed) && rs.paths.some((q) => q.closed), "wired stamp keeps open/closed per path");
  const L = lay(p0);
  const intact = L.els.filter((e) => e.state === "grid");
  const rq = run({ ...p0, stamp: "Square", spin: 0 });
  const sq = rq.paths.filter((q) => q.pts.length === 4);
  ok(sq.length === p0.cols * p0.rows && sq.every((q) => q.pts.every((P, k) => { const Q = q.pts[(k + 1) % 4]; return Math.abs(P[0] - Q[0]) < 1e-9 || Math.abs(P[1] - Q[1]) < 1e-9; })), "Square, Spin 0: every square axis-aligned");
  const rq2 = run({ ...p0, stamp: "Square", spin: 360 });
  ok(rq2.paths.some((q) => q.pts.some((P, k) => { const Q = q.pts[(k + 1) % 4]; return Math.abs(P[0] - Q[0]) > 1e-6 && Math.abs(P[1] - Q[1]) > 1e-6; })), "Square, Spin 360: some squares rotated");
  /* stamp size: intact dot diameter = Stamp size x cell */
  const dots = r1.paths.filter((q, k) => intact.some((e) => Math.abs(centroid(q.pts)[0] - e.x) < 1e-6 && Math.abs(centroid(q.pts)[1] - e.y) < 1e-6));
  const b = bbox(dots[0].pts);
  ok(dots.length === intact.length && Math.abs((b[2] - b[0]) - p0.stampSize * F0.cell) < 0.05, "Dot diameter = Stamp size x cell (" + (b[2] - b[0]).toFixed(2) + " vs " + (p0.stampSize * F0.cell).toFixed(2) + ")");
  const bs = bbox(run(p0, star).paths[0].pts);
  ok(Math.abs(Math.max(bs[2] - bs[0], bs[3] - bs[1]) - p0.stampSize * F0.cell) < 0.05, "wired stamp normalised to Stamp size x cell");
  for (const st of ["Dot", "Ring", "Square", "Diamond", "Cross"]) { const r = run({ ...p0, stamp: st }); ok(r.paths.length >= p0.cols * p0.rows && finiteAll(r), "stamp " + st + " draws (" + r.paths.length + " paths)"); }
  ok(run({ ...p0, stamp: "Ring" }).paths.length === 2 * p0.cols * p0.rows && run({ ...p0, stamp: "Cross" }).paths.length === 2 * p0.cols * p0.rows, "Ring and Cross are two paths per element");
}

/* ---------------------------------------------------------- colours */
{
  const L = lay(p0);
  const pens = [p0.penA, p0.penB, p0.penC, p0.penD];
  ok(L.els.every((e) => e.pen === pens[(e.i + e.j) % 4]), "Diagonal: pen = pens[(i + j) mod 4] for every element, released included");
  ok(new Set(r1.paths.map((q) => q.layer)).size === 4, "four pens in the output");
  ok(new Set(run({ ...p0, palette: 1 }).paths.map((q) => q.layer)).size === 1, "Palette 1: one pen");
  ok(new Set(run({ ...p0, palette: 2 }).paths.map((q) => q.layer)).size === 2, "Palette 2: two pens");
  const Lr = lay({ ...p0, assign: "Rows" }), Lc = lay({ ...p0, assign: "Columns" });
  ok(Lr.els.every((e) => e.pen === pens[e.j % 4]) && Lc.els.every((e) => e.pen === pens[e.i % 4]), "Rows / Columns assignment");
  const Lx = lay({ ...p0, assign: "Random" });
  ok(new Set(Lx.els.map((e) => e.pen)).size === 4 && Lx.els.some((e) => e.pen !== pens[(e.i + e.j) % 4]), "Random assignment uses all pens, differs from Diagonal");
  /* the colour travels: landed elements keep their grid pen */
  ok(L.els.filter((e) => e.state === "landed").every((e) => e.pen === pens[(e.i + e.j) % 4]), "landed elements keep their grid colour");
}

/* ---------------------------------------------------------- seed scope */
{
  const A = lay({ ...p0, seed: 1 }), B = lay({ ...p0, seed: 99 });
  ok(JSON.stringify(A) !== JSON.stringify(B), "seed changes the fall");
  const gridA = new Map(A.els.filter((e) => e.state === "grid").map((e) => [e.i + "," + e.j, e]));
  let moved = 0, shared = 0;
  for (const e of B.els) { if (e.state !== "grid") continue; const a = gridA.get(e.i + "," + e.j); if (!a) continue; shared++; if (Math.abs(a.x - e.x) > 0.3 * F0.cell || Math.abs(a.y - e.y) > 0.3 * F0.cell) moved++; }
  ok(shared > 50 && moved === 0, "elements intact under both seeds stay within their cell (" + shared + " shared)");
  ok(JSON.stringify(run({ ...p0, release: 0, seed: 1 })) === JSON.stringify(run({ ...p0, release: 0, seed: 99 })), "Release 0 is seed-independent");
}

/* ---------------------------------------------------------- liveness */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ cols: 10 }, "cols"); diff({ rows: 10 }, "rows"); diff({ stamp: "Ring" }, "stamp"); diff({ stampSize: 0.3 }, "stampSize");
diff({ release: 0.3 }, "release"); diff({ softness: 0 }, "softness"); diff({ clumps: 0 }, "clumps"); diff({ progress: 0.9 }, "progress");
diff({ drift: 0 }, "drift"); diff({ spin: 180, stamp: "Square" }, "spin"); diff({ sizeMod: 0.5 }, "sizeMod"); diff({ gridJitter: 0 }, "gridJitter");
diff({ pile: "Floor" }, "pile"); diff({ modulate: "All", spin: 90, stamp: "Square" }, "modulate"); diff({ spread: 0.2 }, "spread"); diff({ packing: 1.3 }, "packing"); diff({ palette: 2 }, "palette");
diff({ assign: "Rows" }, "assign"); diff({ penA: 5 }, "penA"); diff({ penB: 5 }, "penB"); diff({ penC: 5 }, "penC"); diff({ penD: 5 }, "penD");
diff({ margin: 30 }, "margin"); diff({ seed: 3 }, "seed");
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) { const r = run({ ...p0, [pd.key]: opt }); ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")"); }

/* ---------------------------------------------------------- extreme / degenerate */
ok(finiteAll(run({ ...p0, cols: 0, rows: 0, stampSize: 0, release: 5, softness: -1, clumps: 9, progress: 2, drift: -5, spin: -10, sizeMod: 9, spread: 0, packing: 0, palette: 0, margin: -3 })), "degenerate params produce no NaN");
{
  const t0 = Date.now(); const big = run({ ...p0, cols: 80, rows: 80, stamp: "Ring" }); const ms = Date.now() - t0;
  ok(finiteAll(big) && npts(big) <= 120000 && big.paths.length === 2 * 6400, "80 x 80 Ring: budget held by trimming circle segments (" + npts(big) + " pts, " + big.paths.length + " paths)");
  ok(ms < 1500, "80 x 80 computes in " + ms + " ms");
  const t1 = Date.now(); run(p0); ok(Date.now() - t1 < 200, "defaults compute fast");
}
ok(finiteAll(run(p0, undefined, { W: 20, H: 20 })), "20 x 20 mm canvas: finite");

/* ---------------------------------------------------------- showIf / overlay */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(!vis({ ...p0, palette: 1 }).includes("penB") && vis(p0).includes("penD") && !vis({ ...p0, palette: 3 }).includes("penD"), "pens follow Palette");
  ok(!vis({ ...p0, pile: "Floor" }).includes("spread") && vis(p0).includes("spread"), "spread / packing only for Heap");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "hidden params carry defaults");
  const g = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g) && g.length === 3 && g[2].kind === "poly" && Math.abs(g[2].pts[0][1] - F0.floor) < 1e-9, "overlay: margin box, grid box, floor line");
  let threw = false; try { def.overlay(p0, { W: 4, H: 4 }); def.overlay.call(undefined, p0, CTX); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
