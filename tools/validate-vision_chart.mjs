/* Validator for the Vision Chart node.
   Run from the repo root: node tools/validate-vision_chart.mjs

   The invariant that matters here is physical: optotype size must follow the
   distance and the logMAR scale, because a chart whose rows are not
   geometrically scaled is decoration, not a chart. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "vision_chart";
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
const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (p, ctx) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((t) => Number.isFinite(t[0]) && Number.isFinite(t[1])));
const pbox = (q) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of q.pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cy: (y0 + y1) / 2 };
};
const CHARTS = def.params.find((q) => q.key === "chart").options;

const p0 = defaults();
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults (" + npts(r1) + " pts)");
const inb = (r, W, Hh, t) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -(t || 1) && x <= W + (t || 1) && y >= -(t || 1) && y <= Hh + (t || 1)));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297), "in bounds on A4 tall");

/* every chart must draw something, on both orientations */
for (const c of CHARTS) {
  const r = run({ ...p0, chart: c });
  ok(r.paths.length > 0 && finiteAll(r), "chart '" + c + "' draws finite paths (" + r.paths.length + ")");
  ok(inb(run({ ...p0, chart: c }, { W: 210, H: 297 }), 210, 297), "chart '" + c + "' stays on the tall sheet");
}
ok(run({ ...p0, chart: "Not a chart at all" }).paths.length > 0, "unknown chart name falls back instead of drawing nothing");

/* --- physical scaling: this is the whole point of the node --- */
/* one optotype subtends 5 arcmin, its detail 1 arcmin; the node's unit is
   2 * distance_mm * tan(2.5') for the logMAR 0 optotype. */
const unitFor = (dist) => 2 * dist * 1000 * Math.tan((2.5 / 60) * Math.PI / 180);
/* rows are read as vertical bands of overlapping ink: an E is dozens of hatch
   lines, so clustering on per-path centres would split one row into many */
const rowHeights = (p) => {
  const r = run(p);
  const seg = r.paths.filter((q) => q.layer === p.pen).map(pbox).filter((b) => b.w > 1).sort((a, b) => a.y0 - b.y0);
  const rows = [];
  for (const b of seg) {
    const last = rows[rows.length - 1];
    if (last && b.y0 <= last.y1 + 1.5) { last.y1 = Math.max(last.y1, b.y1); last.n++; }
    else rows.push({ y0: b.y0, y1: b.y1, n: 1 });
  }
  return rows.map((q) => ({ cy: (q.y0 + q.y1) / 2, h: q.y1 - q.y0, n: q.n }));
};
const lc = { ...p0, chart: "Landolt C — ISO/logMAR", labels: false };
const rows = rowHeights(lc);
ok(rows.length >= 5, "Landolt chart builds at least 5 rows (" + rows.length + ")");
/* read the distance from the node's own default — never hardcode it here, or a
   changed default turns a correct chart into a red test */
const D0 = p0.distance, L0 = p0.topLogmar;
const expectTop = unitFor(D0) * Math.pow(10, L0);
ok(Math.abs(rows[0].h - expectTop) / expectTop < 0.06,
  "top row is physically sized for " + D0 + " m at logMAR " + L0 + " (" + rows[0].h.toFixed(1) + " mm, expected " + expectTop.toFixed(1) + ")");
let geoBad = 0;
for (let i = 1; i < Math.min(rows.length, 7); i++) {
  const ratio = rows[i - 1].h / rows[i].h;
  if (Math.abs(ratio - Math.pow(10, 0.1)) > 0.06) { console.log("     row " + i + " ratio " + ratio.toFixed(3)); geoBad++; }
}
ok(geoBad === 0, "consecutive rows scale by 10^0.1 (the logMAR step)");
const far = rowHeights({ ...lc, distance: D0 * 2 });
ok(Math.abs(far[0].h / rows[0].h - 2) < 0.06, "doubling the viewing distance doubles the optotypes");
const half = rowHeights({ ...lc, scale: 50 });
ok(Math.abs(half[0].h / rows[0].h - 0.5) < 0.06, "Scale % is a straight multiplier");
const rowsMore = rowHeights({ ...lc, topLogmar: 0.4 });
ok(rowsMore[0].h < rows[0].h, "a smaller top logMAR starts with smaller optotypes");

/* Landolt C is a broken ring: the gap is one fifth of the diameter (ISO 8596) */
const allArcs = run({ ...lc, rows: 3, topLogmar: 0.7 }).paths.filter((q) => !q.closed && pbox(q).w > 10);
/* one optotype is drawn as concentric arcs; only the outermost has diameter d,
   so measure the gap against those or the ratio is read off an inner ring */
const widest = Math.max(...allArcs.map((q) => pbox(q).w));
const rings = allArcs.filter((q) => pbox(q).w > widest * 0.92);
ok(rings.length > 0, "Landolt optotypes are open arcs, not closed circles (" + rings.length + " outer arcs of " + allArcs.length + ")");
let gapBad = 0;
for (const q of rings.slice(0, 6)) {
  const b = pbox(q);
  const gap = Math.hypot(q.pts[0][0] - q.pts[q.pts.length - 1][0], q.pts[0][1] - q.pts[q.pts.length - 1][1]);
  const ratio = gap / b.w;
  if (ratio < 0.15 || ratio > 0.28) { console.log("     gap/diameter " + ratio.toFixed(3)); gapBad++; }
}
ok(gapBad === 0, "ring gap is about one fifth of the optotype diameter");

/* --- param liveness --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ chart: "Tumbling E — logMAR" }, "chart");
diff({ rows: 5 }, "rows");
diff({ distance: 3 }, "distance");
diff({ topLogmar: 0.3 }, "topLogmar");
diff({ scale: 60 }, "scale");
diff({ spacing: 1.8 }, "spacing");
diff({ labels: false }, "labels");
diff({ seed: 4242 }, "seed");
diff({ pen: 5 }, "pen");
diff({ margin: 35 }, "margin");
const te = { ...p0, chart: "Tumbling E — logMAR" };
ok(JSON.stringify(run({ ...te, inkPitch: 1.6 })) !== JSON.stringify(run(te)), "param live: inkPitch (E charts)");
const ps = { ...p0, chart: "Pseudoisochromatic art" };
const psJ = JSON.stringify(run(ps));
for (const [k, v] of [["size", 200], ["target", "473"], ["dots", 500], ["dotMin", 2.5], ["dotMax", 6], ["secondPen", 9]]) {
  ok(JSON.stringify(run({ ...ps, [k]: v })) !== psJ, "param live: " + k + " (Pseudoisochromatic)");
}
const gs = { ...p0, chart: "Golovin–Sivtsev" };
ok(JSON.stringify(run({ ...gs, secondPen: 9 })) !== JSON.stringify(run(gs)), "param live: secondPen (Golovin-Sivtsev)");

/* --- ink pitch is a physical pen setting: finer pitch means more ink --- */
const coarse = npts(run({ ...te, inkPitch: 2 })), fineP = npts(run({ ...te, inkPitch: 0.15 }));
ok(fineP > coarse * 2, "finer ink pitch fills the E strokes more densely (" + coarse + " -> " + fineP + " pts)");

/* Tumbling E must keep all three arms at every pitch — the classic failure is a
   hatch step wide enough to drop an arm and turn the E into a C. */
let armBad = 0;
for (const pitch of [0.15, 0.45, 1, 2]) {
  const r = run({ ...te, rows: 3, inkPitch: pitch, labels: false });
  const marks = r.paths.map(pbox).filter((b) => b.w > 3);
  if (!marks.length) { armBad++; continue; }
  const widest = Math.max(...marks.map((b) => b.w));
  const arms = marks.filter((b) => b.w > widest * 0.85).length;
  if (arms < 3) { console.log("     pitch " + pitch + ": only " + arms + " full-width arms"); armBad++; }
}
ok(armBad === 0, "Tumbling E keeps three full-width arms at every ink pitch");

/* --- two-pen charts --- */
const psR = run(ps);
const psLayers = [...new Set(psR.paths.map((q) => q.layer))].sort((a, b) => a - b);
ok(psLayers.length === 2, "Pseudoisochromatic uses both pens (figure and ground)");
const disc = psR.paths.map(pbox).sort((a, b) => b.w - a.w)[0];
const cx = (disc.x0 + disc.x1) / 2, cy = (disc.y0 + disc.y1) / 2, R = disc.w / 2;
ok(psR.paths.every((q) => q.pts.every(([x, y]) => Math.hypot(x - cx, y - cy) <= R + 0.6)), "every dot sits inside the plate circle");
const dotCount = psR.paths.length - 1;
ok(dotCount > 100, "Pseudoisochromatic packs a usable number of dots (" + dotCount + ")");
const gsLayers = [...new Set(run(gs).paths.map((q) => q.layer))].sort((a, b) => a - b);
ok(gsLayers.length === 2, "Golovin-Sivtsev alternates two pens across the row");

/* labels toggle only removes the labels, never the optotypes */
const withL = run({ ...p0, labels: true }), noL = run({ ...p0, labels: false });
/* the label column also narrows the usable width, so total ink is NOT a valid
   probe: count marks in the label gutter instead */
const gutter = (r) => r.paths.filter((q) => pbox(q).x1 < 12 + 24).length;
ok(gutter(withL) > 0 && gutter(noL) === 0, "Scale labels appear in the gutter only when on (" + gutter(withL) + " vs " + gutter(noL) + ")");
ok(rowHeights({ ...p0, labels: true }).length === rowHeights({ ...p0, labels: false }).length, "turning labels off keeps every row");

/* --- degenerate and extreme --- */
ok(finiteAll(run({ ...p0, rows: 2, distance: 0.3, scale: 10, spacing: 0.2, inkPitch: 2, margin: 0 })), "minimum params produce no NaN");
const ext = run({ ...p0, rows: 14, distance: 8, scale: 200, spacing: 2, inkPitch: 0.15, chart: "Tumbling E — logMAR" });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
const extP = run({ ...ps, dots: 700, dotMin: 0.5, dotMax: 9, size: 260 });
ok(finiteAll(extP) && npts(extP) <= 120000, "extreme Pseudoisochromatic: finite + budget held (" + npts(extP) + " pts)");
ok(finiteAll(run(p0, { W: 40, H: 30 })), "tiny canvas produces no NaN");
ok(finiteAll(run({ ...ps, target: "" })), "empty hidden number falls back safely");
ok(finiteAll(run({ ...ps, target: "abcdef" })), "non-numeric hidden number falls back safely");
ok(finiteAll(run({ ...ps, dotMin: 9, dotMax: 1 })), "inverted dot size range produces no NaN");
ok(finiteAll(run({ ...p0, margin: 50 }, { W: 90, H: 90 })), "margin larger than half the sheet produces no NaN");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
ok(!vis(ps).includes("rows") && !vis(ps).includes("distance"), "showIf: chart-scale controls hidden for the art plate");
ok(vis(ps).includes("target") && !vis(p0).includes("target"), "showIf: hidden-number field only on the art plate");
ok(!vis(gs).includes("topLogmar"), "showIf: top logMAR hidden for the fixed Golovin-Sivtsev scale");
ok(!vis({ ...p0, chart: "Landolt C — ISO/logMAR" }).includes("inkPitch"), "showIf: ink pitch hidden for Landolt (arc-drawn, not hatched)");

/* --- overlay --- */
const g1 = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
ok(Array.isArray(g1) && g1.length > 0, "overlay returns guides (" + g1.length + ")");
const gr = g1.find((q) => q.kind === "rect");
ok(gr && Math.abs(gr.x - 12) < 0.01 && Math.abs(gr.w - 273) < 0.01, "overlay rect equals the margin box");
const gp = def.overlay(ps, { W: 297, H: 210 }, undefined, {}).find((q) => q.kind === "circle");
ok(gp && Math.abs(gp.r - R) < 1.2, "overlay circle matches the drawn plate (" + (gp ? gp.r.toFixed(1) : "none") + " vs " + R.toFixed(1) + " mm)");
let threw = false;
try { def.overlay(p0, { W: 4, H: 4 }); def.overlay({ ...ps, size: 999 }, { W: 297, H: 210 }); def.overlay(p0, undefined); } catch (e) { threw = true; }
ok(!threw, "overlay never throws on degenerate input");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
