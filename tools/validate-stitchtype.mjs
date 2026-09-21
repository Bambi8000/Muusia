/* Validator for the Stitch Type node (key stitchtype).
   Run from the repo root: node tools/validate-stitchtype.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "stitchtype";

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
const CTX = { W: 297, H: 210 };
const run = (p, ctx, node) => def.compute([undefined], p, ctx || CTX, node || {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();

/* ---------------------------------------------------------- universal */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
ok(r1.paths.every((q) => q.pts.every((pt) => pt.length === 2)), "points are [x,y] pairs");
const tol = 0.01;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297), "in bounds on A4 tall");
/* the margin box is the real bound (shrink-only fit includes the rings) */
const inMargin = (r, p, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= p.margin - tol && x <= W - p.margin + tol && y >= p.margin - tol && y <= Hh - p.margin + tol));
ok(inMargin(r1, p0, 297, 210), "everything inside the margin box (rings included)");
ok(inMargin(run({ ...p0, cell: 12 }, { W: 210, H: 297 }), p0, 210, 297), "cell 12 mm on A4 tall still fits the margin box (shrink-only fit)");
ok(inMargin(run({ ...p0, text: "MUUSIA|PLOTTER|PATCHER|VIIVAIN", cell: 12 }, { W: 148, H: 105 }), p0, 148, 105), "four lines on A6 stay inside the margin box");

/* ---------------------------------------------------------- pens */
const pensUsed = (r) => new Set(r.paths.map((q) => q.layer));
const P1 = pensUsed(r1);
ok(P1.has(p0.penCore) && P1.has(p0.penEdge) && P1.has(p0.penHalo) && P1.has(p0.penPins) && P1.has(p0.penAura), "all five ring pens present at defaults");
ok(P1.size === 5, "exactly five pens at defaults (" + [...P1].sort().join(",") + ")");
const byPen = (r, pen) => r.paths.filter((q) => q.layer === pen);
const rp = run({ ...p0, penCore: 9, penEdge: 9, penHalo: 9, penPins: 9, penAura: 9 });
ok(pensUsed(rp).size === 1 && pensUsed(rp).has(9), "all pens re-routable to one pen");

/* ---------------------------------------------------------- layout oracle */
/* Rebuild the cell classification through the shared _layout and check the
   ring geometry itself, then check every mark lands in the ring it belongs to. */
const L = def._layout(p0, CTX);
ok(L && L.cols > 0 && L.rows > 0, "_layout returns a grid (" + L.cols + "x" + L.rows + ", cell " + L.cell.toFixed(3) + " mm)");
const K = (c, r) => (c >= 0 && r >= 0 && c < L.cols && r < L.rows) ? L.kind[r * L.cols + c] : 0;
const isIn = (c, r) => K(c, r) === 1 || K(c, r) === 2;
{
  let coreBad = 0, edgeBad = 0, haloBad = 0, auraBad = 0, farBad = 0, counts = {};
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
    const k = K(c, r); counts[k] = (counts[k] || 0) + 1;
    const n4out = !isIn(c - 1, r) || !isIn(c + 1, r) || !isIn(c, r - 1) || !isIn(c, r + 1);
    let n8in = false, n8prev = false;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      if (isIn(c + dc, r + dr)) n8in = true;
      if (k >= 4 && K(c + dc, r + dr) === k - 1) n8prev = true;
    }
    if (k === 1 && n4out) coreBad++;
    if (k === 2 && !n4out) edgeBad++;
    if (k === 3 && !n8in) haloBad++;
    if (k >= 4 && (n8in || !n8prev)) auraBad++;
    if (k === 0 && n8in) farBad++;
  }
  ok(coreBad === 0, "core cells never touch the outside (4-neighbourhood)");
  ok(edgeBad === 0, "every edge cell touches the outside");
  ok(haloBad === 0, "every halo cell 8-touches the letter");
  ok(auraBad === 0, "aura ring k cells are outside the letter and 8-touch ring k-1");
  ok(farBad === 0, "no unclassified cell touches the letter");
  ok((counts[1] || 0) > 0 && (counts[2] || 0) > 0 && (counts[3] || 0) > 0 && (counts[4] || 0) > 0, "all four classes populated at defaults");
  ok(L.cell <= p0.cell + 1e-9, "fit never grows the cell (shrink only)");
  const rNo = def._layout({ ...p0, rings: 0 }, CTX);
  ok(rNo.R === 1 && rNo.cols === L.cols - 2 && rNo.rows === L.rows - 2, "Aura rings 0 removes exactly one ring of padding on every side");
}

/* classify a canvas point into the grid cell it falls in */
const cellOf = (x, y) => [Math.floor((x - L.x0) / L.cell), Math.floor((y - L.y0) / L.cell)];
/* sample interior points of a segment away from its endpoints (endpoints sit on cell corners) */
const samples = (a, b) => { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / L.cell)); const o = []; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } return o; };
const kindsOfPath = (q) => {
  const ks = new Set();
  if (q.closed) { const cx = q.pts.reduce((a, pt) => a + pt[0], 0) / q.pts.length, cy = q.pts.reduce((a, pt) => a + pt[1], 0) / q.pts.length; const [c, r] = cellOf(cx, cy); ks.add(K(c, r)); return ks; }
  for (let i = 1; i < q.pts.length; i++) for (const s of samples(q.pts[i - 1], q.pts[i])) { const [c, r] = cellOf(s[0], s[1]); ks.add(K(c, r)); }
  return ks;
};
const allIn = (paths, pred) => paths.every((q) => [...kindsOfPath(q)].every(pred));
ok(allIn(byPen(r1, p0.penCore), (k) => k === 1), "core marks (X) lie only in core cells");
ok(allIn(byPen(r1, p0.penEdge), (k) => k === 2), "edge marks (lattice) lie only in edge cells");
ok(allIn(byPen(r1, p0.penHalo), (k) => k === 3), "halo stripes lie only in halo cells");
ok(allIn(byPen(r1, p0.penAura), (k) => k >= 4), "aura marks lie only in aura rings");
ok(allIn(byPen(r1, p0.penPins), (k) => k >= 3), "pins never enter the letter");
ok(byPen(r1, p0.penPins).every((q) => Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-9), "default pins are vertical (x constant)");
{
  const rh = run({ ...p0, preset: "Custom", pinMark: "Horizontal" });
  ok(byPen(rh, p0.penPins).length > 0 && byPen(rh, p0.penPins).every((q) => Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-9), "Horizontal pins are horizontal (y constant)");
}
/* every core cell carries both diagonals of its X */
{
  const cover = new Map();
  for (const q of byPen(r1, p0.penCore)) {
    const dx = Math.sign(q.pts[1][0] - q.pts[0][0]), dy = Math.sign(q.pts[1][1] - q.pts[0][1]);
    const dir = dx * dy > 0 ? "b" : "s";
    for (const s of samples(q.pts[0], q.pts[1])) { const [c, r] = cellOf(s[0], s[1]); const key = c + "," + r; cover.set(key, (cover.get(key) || "") + dir); }
  }
  let miss = 0, core = 0;
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) if (K(c, r) === 1) { core++; const v = cover.get(c + "," + r) || ""; if (!v.includes("b") || !v.includes("s")) miss++; }
  ok(miss === 0, "every core cell is crossed by both diagonals (" + core + " cells)");
  const nBack = byPen(r1, p0.penCore).filter((q) => Math.sign(q.pts[1][0] - q.pts[0][0]) * Math.sign(q.pts[1][1] - q.pts[0][1]) > 0).length;
  const nSlash = byPen(r1, p0.penCore).length - nBack;
  ok(nBack < core * 0.7 && nSlash < core * 0.7, "both diagonal families are merged into runs (" + nBack + " \\ + " + nSlash + " / strokes for " + core + " cells)");
}
/* halo stripes: exactly Halo stripes per halo row-run, horizontal */
{
  const halo = byPen(r1, p0.penHalo);
  ok(halo.every((q) => Math.abs(q.pts[0][1] - q.pts[1][1]) < 1e-9), "Stripes - are horizontal");
  const rows = new Map();
  for (const q of halo) { const [c, r] = cellOf((q.pts[0][0] + q.pts[1][0]) / 2, q.pts[0][1]); const key = r + ":" + Math.floor((q.pts[0][0] - L.x0) / L.cell); rows.set(key, (rows.get(key) || 0) + 1); }
  ok([...rows.values()].every((n) => n === p0.haloLines), "each halo run carries exactly Halo stripes lines");
  const r5 = run({ ...p0, haloLines: 5 });
  ok(byPen(r5, p0.penHalo).length === Math.round(halo.length * 5 / p0.haloLines), "Halo stripes 5 gives 5/3 the stripe count");
}

/* ---------------------------------------------------------- seed scope */
{
  const rs = run({ ...p0, seed: 99 });
  const same = (pen) => JSON.stringify(byPen(r1, pen)) === JSON.stringify(byPen(rs, pen));
  ok(same(p0.penCore) && same(p0.penEdge) && same(p0.penHalo), "seed leaves core, edge and halo byte-identical");
  ok(!same(p0.penPins) && !same(p0.penAura), "seed moves pins and aura");
  const ra = run({ ...p0, auraFill: 1 }), rb = run({ ...p0, auraFill: 0.2 });
  ok(byPen(ra, p0.penAura).length > byPen(r1, p0.penAura).length && byPen(rb, p0.penAura).length < byPen(r1, p0.penAura).length, "Aura fill is monotonic (0.2 < 0.55 < 1)");
  const auraCells = [...L.kind].filter((k) => k === 4).length;
  ok(byPen(ra, p0.penAura).length === auraCells, "Aura fill 1 marks every ring-1 aura cell exactly once (" + auraCells + ")");
  ok(byPen(run({ ...p0, auraFill: 0 }), p0.penAura).length === 0, "Aura fill 0 draws no aura");
  ok(byPen(run({ ...p0, pinFill: 0 }), p0.penPins).length === 0, "Pin density 0 draws no pins");
  ok(byPen(run({ ...p0, pinFill: 1 }), p0.penPins).length > byPen(r1, p0.penPins).length, "Pin density 1 draws more pins than 0.5");
  const r3 = run({ ...p0, rings: 3 });
  const L3 = def._layout({ ...p0, rings: 3 }, CTX);
  const K3 = (c, r) => L3.kind[r * L3.cols + c];
  const far = byPen(r3, p0.penAura).filter((q) => { const [c, r] = [Math.floor((q.pts[0][0] + q.pts[1][0]) / 2 / L3.cell - L3.x0 / L3.cell), Math.floor((q.pts[0][1] - L3.y0) / L3.cell)]; return K3(c, r) === 6; });
  ok(far.length > 0, "Aura rings 3 reaches ring 3 (" + far.length + " marks in the outermost ring)");
}

/* ---------------------------------------------------------- text handling */
ok(run({ ...p0, text: "" }).paths.length === 0, "empty text -> EMPTY");
ok(run({ ...p0, text: "   " }).paths.length === 0, "spaces only -> EMPTY");
ok(run({ ...p0, text: "@@@" }).paths.length === 0, "unknown glyphs only -> EMPTY");
{
  const a = def._layout({ ...p0, text: "A" }, CTX), ab = def._layout({ ...p0, text: "AB" }, CTX), two = def._layout({ ...p0, text: "A|B" }, CTX);
  ok(ab.cols > a.cols && ab.rows === a.rows, "second letter widens, does not heighten");
  ok(two.rows > a.rows && two.rows === 2 * a.rows - 2 * a.R + p0.linegap * p0.px, "| starts a new line at Line gap");
  const lg = def._layout({ ...p0, text: "A|B", linegap: 4 }, CTX);
  ok(lg.rows === two.rows + 2 * p0.px, "Line gap 4 adds two more pixel rows");
  const g = def._layout({ ...p0, text: "AB", gap: 5 }, CTX);
  ok(g.cols === ab.cols + 2 * p0.px, "Letter gap 5 adds two pixel columns");
  const px3 = def._layout({ ...p0, text: "A", px: 3 }, CTX);
  ok(px3.bw === a.bw * 3 / 2 && px3.bh === a.bh * 3 / 2, "Pixel 3 scales the letter block 3:2 against Pixel 2");
  ok(JSON.stringify(run({ ...p0, text: "muusia" })) === JSON.stringify(r1), "lower case is upper-cased");
  const sp = def._layout({ ...p0, text: "A B" }, CTX);
  ok(sp.cols === ab.cols + 3 * p0.px, "space is three font pixels wide");
  const lc = def._layout({ ...p0, text: "A|MMM", align: "Left" }, CTX), rc = def._layout({ ...p0, text: "A|MMM", align: "Right" }, CTX), cc = def._layout({ ...p0, text: "A|MMM", align: "Center" }, CTX);
  const firstCol = (LL) => { for (let c = 0; c < LL.cols; c++) for (let r = LL.R; r < LL.R + 8 * p0.px; r++) if (LL.kind[r * LL.cols + c] === 1 || LL.kind[r * LL.cols + c] === 2) return c; return -1; };
  ok(firstCol(lc) < firstCol(cc) && firstCol(cc) < firstCol(rc), "Align Left/Center/Right moves the short first line");
}
/* bridge: a Sampler Z keeps one connected component with bridging, several without */
{
  const comps = (LL) => {
    const seen = new Uint8Array(LL.cols * LL.rows); let n = 0;
    const isI = (i) => LL.kind[i] === 1 || LL.kind[i] === 2;
    for (let i = 0; i < seen.length; i++) {
      if (seen[i] || !isI(i)) continue;
      n++; const st = [i]; seen[i] = 1;
      while (st.length) { const j = st.pop(); const c = j % LL.cols, r = (j - c) / LL.cols;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= LL.cols || rr >= LL.rows) continue; const k = rr * LL.cols + cc; if (!seen[k] && isI(k)) { seen[k] = 1; st.push(k); } } }
    }
    return n;
  };
  const zb = def._layout({ ...p0, text: "Z", font: "Sampler 5x7", px: 3, bridge: true }, CTX);
  const zn = def._layout({ ...p0, text: "Z", font: "Sampler 5x7", px: 3, bridge: false }, CTX);
  ok(comps(zb) === 1, "Sampler Z is one connected letter with Bridge diagonals");
  ok(comps(zn) > 1, "Sampler Z without bridging falls apart at the diagonal (" + comps(zn) + " pieces)");
  const bb = def._layout({ ...p0, text: "Z", bridge: true }, CTX), bn = def._layout({ ...p0, text: "Z", bridge: false }, CTX);
  ok(JSON.stringify([...bb.kind]) === JSON.stringify([...bn.kind]), "Bold font is unaffected by bridging (already edge-connected)");
}

/* ---------------------------------------------------------- param liveness */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ text: "VIIVAIN" }, "text");
diff({ font: "Sampler 5x7" }, "font Sampler");
diff({ font: "Tiny 3x5" }, "font Tiny");
diff({ px: 3 }, "px");
diff({ cell: 2 }, "cell");
diff({ gap: 1 }, "gap");
diff({ linegap: 4, text: "A|B" }, "linegap");
diff({ align: "Left", text: "A|MMM" }, "align");
diff({ yoff: 10 }, "yoff");
diff({ preset: "Circuit" }, "preset");
diff({ haloLines: 2 }, "haloLines");
diff({ rings: 2 }, "rings");
diff({ auraFill: 0.9 }, "auraFill");
diff({ pinFill: 0.9 }, "pinFill");
diff({ margin: 40 }, "margin");
diff({ seed: 3 }, "seed");
diff({ penCore: 0 }, "penCore");
diff({ penEdge: 0 }, "penEdge");
diff({ penHalo: 0 }, "penHalo");
diff({ penPins: 0 }, "penPins");
diff({ penAura: 0 }, "penAura");
diff({ bridge: false, font: "Sampler 5x7", text: "Z" }, "bridge (Sampler Z)");
{
  const base = { ...p0, preset: "Custom" };
  const bC = JSON.stringify(run(base));
  ok(bC === bJ, "Custom with default selectors equals the Sampler preset");
  for (const key of ["coreMark", "edgeMark", "haloMark", "auraMark", "pinMark"]) {
    const pd = def.params.find((q) => q.key === key);
    const seen = new Set();
    for (const opt of pd.options) {
      const r = run({ ...base, [key]: opt });
      const j = JSON.stringify(r);
      ok(finiteAll(r) && (opt === "None" || r.paths.length > 0) && !seen.has(j), key + " '" + opt + "' renders finite + distinct (" + r.paths.length + " paths)");
      seen.add(j);
    }
  }
  const rN = run({ ...base, coreMark: "None", edgeMark: "None", haloMark: "None", auraMark: "None", pinMark: "None" });
  ok(rN.paths.length === 0, "all marks None -> nothing drawn");
}
for (const pd of def.params.filter((q) => q.type === "select" && !q.showIf)) {
  const seen = new Set();
  for (const opt of pd.options) {
    const r = run({ ...p0, text: "A|MZ", [pd.key]: opt });
    const j = JSON.stringify(r);
    /* Custom with untouched selectors is the Sampler preset by design */
    const distinct = pd.key === "preset" && opt === "Custom" ? true : !seen.has(j);
    ok(r.paths.length > 0 && finiteAll(r) && distinct, pd.key + " '" + opt + "' draws finite, distinct paths (" + r.paths.length + ")");
    seen.add(j);
  }
}

/* ---------------------------------------------------------- degenerate / extreme */
ok(finiteAll(run({ ...p0, px: 0, cell: 0, gap: -3, linegap: -1, rings: -2, haloLines: 0, auraFill: -1, pinFill: 5, margin: -5, seed: 0 })), "degenerate params produce no NaN");
ok(run({ ...p0, px: 0 }).paths.length > 0, "px 0 clamps to 1 and still draws");
{
  const ext = run({ ...p0, text: "MUUSIA PLOTTER|PATCHER VIIVAIN|HELSINKI 2026", px: 5, rings: 3, haloLines: 5, auraFill: 1, pinFill: 1, cell: 12, margin: 0 }, { W: 841, H: 594 });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
  ok(inb(ext, 841, 594), "extreme params stay on the A1 sheet");
}
ok(finiteAll(run(p0, { W: 20, H: 20 })) && inb(run(p0, { W: 20, H: 20 }), 20, 20), "20x20 mm canvas: finite and on-sheet (margin collapses to fit)");
ok(finiteAll(run({ ...p0, margin: 200 })), "margin larger than the sheet: no NaN");
{
  const t0 = Date.now(); run({ ...p0, text: "MUUSIA PLOTTER|PATCHER VIIVAIN", px: 4, rings: 3 }, { W: 594, H: 420 }); const ms = Date.now() - t0;
  ok(ms < 400, "heavy A2 case computes in " + ms + " ms");
}

/* ---------------------------------------------------------- showIf */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(!vis(p0).includes("coreMark") && vis({ ...p0, preset: "Custom" }).includes("coreMark"), "mark selectors hidden unless Preset = Custom");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "hidden params carry defaults");
}

/* ---------------------------------------------------------- overlay */
{
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 3, "overlay returns margin box + letter box + ring box (" + g1.length + ")");
  const letter = g1[1], ring = g1[2];
  ok(Math.abs(letter.x - (L.x0 + L.R * L.cell)) < 1e-9 && Math.abs(letter.w - L.bw * L.cell) < 1e-9, "letter guide matches _layout");
  ok(Math.abs(ring.x - L.x0) < 1e-9 && Math.abs(ring.w - L.cols * L.cell) < 1e-9, "ring guide matches _layout");
  /* every plotted point lies inside the ring guide */
  ok(r1.paths.every((q) => q.pts.every(([x, y]) => x >= ring.x - tol && x <= ring.x + ring.w + tol && y >= ring.y - tol && y <= ring.y + ring.h + tol)), "all output inside the ring guide");
  let threw = false;
  try { def.overlay({ ...p0 }, { W: 4, H: 4 }, undefined, undefined); def.overlay({ ...p0, text: "" }, CTX); def.overlay.call(undefined, p0, CTX); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws (degenerate canvas, empty text, unbound this)");
  ok(def.overlay({ ...p0, text: "" }, CTX).length === 1, "empty text overlay shows only the margin box");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
