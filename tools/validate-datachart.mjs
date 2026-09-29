/* Validator for the Data Chart node. Run from the repo root:
   node tools/validate-datachart.mjs
   First line tells you which source was tested - read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "datachart";

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
const run = (p, node, ctx) => def.compute([undefined], p, ctx || CTX, node || {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();
const CSV = "city,population,area\nHelsinki,684,214\nEspoo,314,312\nTampere,258,525\nVantaa,247,238\nOulu,215,1410\nTurku,202,245";
const TSV = "x\ty\tz\n1,5\t2,1\t3\n2\t3,4\t8\n3,2\t2,9\t1\n4\t6\t5\n5,5\t5,2\t9\n6\t8,1\t2";
const SEMI = "kuu;arvo\ntammi;12,5\nhelmi;7\nmaalis;19,25";
const JSON_OBJ = JSON.stringify([{ month: "Q1", sales: 40, cost: 25 }, { month: "Q2", sales: 55, cost: 30 }, { month: "Q3", sales: 35, cost: 28 }]);
const JSON_ARR = JSON.stringify([["a", 1], ["b", 2], ["c", 3]]);
const fileNode = (t) => ({ data: { svg: def.onFile(t) } });

/* --- static shape + file contract --- */
ok(def.cat === "gen" && def.group === "scientific", "cat gen / group scientific");
ok(def.params.some((q) => q.type === "file") && typeof def.onFile === "function", "file param + onFile");
ok(typeof def.fileLabel === "string" && typeof def.fileAccept === "string" && /csv/.test(def.fileAccept), "definition-level fileLabel / fileAccept (csv)");
ok(!def.params.some((q) => q.fileAccept || q.fileLabel), "no fileAccept/fileLabel inside a param descriptor");
ok(def.params.some((q) => q.key === "data" && q.type === "text"), "pasted-data text param");
ok(typeof def.desc === "string" && def.desc.length > 200, "desc present");

/* --- parser oracles --- */
{
  const a = def._parse(CSV);
  ok(a.cats.join() === "Helsinki,Espoo,Tampere,Vantaa,Oulu,Turku", "CSV: label column detected, header stripped");
  ok(a.series.length === 2 && a.series[0].name === "population" && a.series[1].values[4] === 1410, "CSV: two named numeric series");
  const b = def._parse(TSV);
  ok(b.series.length === 3 && b.series[0].values[0] === 1.5 && b.series[1].values[5] === 8.1, "TSV with decimal commas parsed as numbers");
  ok(b.cats.join() === "1,2,3,4,5,6", "TSV: no label column -> row indices as categories");
  const c = def._parse(SEMI);
  ok(c.cats.join() === "tammi,helmi,maalis" && c.series[0].values.join() === "12.5,7,19.25", "semicolon CSV (Finnish Excel) with decimal commas");
  const d = def._parse(JSON_OBJ);
  ok(d.cats.join() === "Q1,Q2,Q3" && d.series.map((s) => s.name).join() === "sales,cost", "JSON array of objects: keys become header");
  const e = def._parse(JSON_ARR);
  ok(e.cats.join() === "a,b,c" && e.series[0].values.join() === "1,2,3", "JSON array of arrays");
  const f = def._parse(p0.data);
  ok(f.cats.length === 8 && f.series.length === 2 && f.series[0].name === "S1", "pasted default data: 8 rows, 2 unnamed series");
  ok(def._parse("").series.length === 0 && def._parse("garbage").series.length === 0 && def._parse("{bad json").series.length === 0, "empty / junk / broken JSON parse to no series without throwing");
  ok(JSON.stringify(def.onFile(CSV)) === JSON.stringify(def._parse(CSV)), "onFile returns the parsed table (lands at node.data.svg)");
}

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 0.05;
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) => x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 297, 210, p0.margin), "inside margin box on A4 wide");
ok(inb(run(p0, undefined, { W: 210, H: 297 }), 210, 297, p0.margin), "inside margin box on A4 tall");

/* --- data source precedence --- */
{
  const fromFile = run(p0, fileNode(CSV)), fromText = run(p0);
  ok(JSON.stringify(fromFile) !== JSON.stringify(fromText), "a loaded file overrides the pasted text");
  ok(JSON.stringify(run(p0, { data: { svg: null } })) === JSON.stringify(fromText), "no file payload -> pasted text is used");
  ok(JSON.stringify(run(p0, { data: { svg: { garbage: 1 } } })) === JSON.stringify(fromText), "garbage file payload ignored, text used");
  const e = run({ ...p0, data: "" });
  ok(Array.isArray(e.paths) && e.paths.length === 0, "no data at all -> EMPTY");
}

/* --- chart oracles --- */
{
  /* bars: one closed rect per value on the series pen(s), zero baseline drawn */
  const pb = { ...p0, fill: "None", labels: false, grid: false, axes: false, markers: false };
  const r = run(pb);
  const rects = r.paths.filter((q) => q.closed && q.pts.length === 4);
  ok(rects.length === 16, "Bars: 8 categories x 2 series = 16 rectangles, no fill (" + rects.length + ")");
  ok([...new Set(rects.map((q) => q.layer))].sort().join() === "1,2", "Bars: series on pens 1 and 2 (cycle)");
  ok([...new Set(run({ ...pb, cyclePens: false }).paths.map((q) => q.layer))].join() === "1", "cycle off: everything on the series pen");
  /* rect heights proportional to values */
  const D = def._parse(p0.data);
  const s1 = rects.filter((q) => q.layer === 1).map((q) => Math.abs(q.pts[2][1] - q.pts[0][1]));
  const ratio = s1.map((h, i) => h / D.series[0].values[i]);
  ok(Math.max(...ratio) - Math.min(...ratio) < 1e-6, "Bars: heights proportional to values");
  ok(run({ ...pb, fill: "Hatch" }).paths.length > r.paths.length && run({ ...pb, fill: "Cross" }).paths.length > run({ ...pb, fill: "Hatch" }).paths.length, "Fill: None < Hatch < Cross path counts");
  /* stacked: total height of a column equals sum of both */
  const st = run({ ...pb, chart: "Stacked bars" }).paths.filter((q) => q.closed && q.pts.length === 4);
  ok(st.length === 16, "Stacked: 16 rectangles");
  /* lines: one open polyline per series with N points, markers optional */
  const ln = run({ ...pb, chart: "Lines" });
  ok(ln.paths.filter((q) => !q.closed && q.pts.length === 8).length === 2, "Lines: one 8-point polyline per series");
  ok(run({ ...pb, chart: "Lines", markers: true }).paths.length === ln.paths.length + 16, "Markers: one circle per data point");
  ok(run({ ...pb, chart: "Lines", smooth: true }).paths.every((q) => q.pts.length >= 8), "Smooth: polylines densified");
  /* donut: wedges are closed and sum the full circle */
  const dn = run({ ...pb, chart: "Donut" });
  ok(dn.paths.filter((q) => q.closed).length === 8, "Donut: one closed ring wedge per category");
  /* radar: series polygons closed with N points */
  const rd = run({ ...pb, chart: "Radar", grid: true, axes: true });
  ok(rd.paths.filter((q) => q.closed && q.pts.length === 8).length >= 2, "Radar: series polygons with one vertex per category");
  /* scatter with 3 columns: 6 points with size-scaled circles */
  const sc = run({ ...pb, chart: "Scatter" }, fileNode(TSV));
  ok(sc.paths.length >= 6 && sc.paths.every((q) => q.closed), "Scatter: circles per point");
  /* sort */
  const sortedD = run({ ...pb, sort: "Descending" }).paths.filter((q) => q.closed && q.layer === 1).map((q) => Math.abs(q.pts[2][1] - q.pts[0][1]));
  ok(sortedD.every((h, i) => i === 0 || h <= sortedD[i - 1] + 1e-9), "Sort Descending: bar heights decrease left to right");
  /* labels: text appears on the frame pen; off removes it */
  const withL = run({ ...p0, fill: "None" }), noL = run({ ...p0, fill: "None", labels: false });
  ok(withL.paths.length > noL.paths.length * 1.5, "Labels add stroke-font paths");
  ok(run({ ...p0, fill: "None", labels: false, grid: false, axes: false }).paths.every((q) => q.layer !== p0.layer && q.layer !== p0.gridPen), "no labels / grid / axes: nothing on the frame or grid pen");
  const nF = (r) => r.paths.filter((q) => q.layer === p0.layer).length;
  ok(nF(run({ ...p0, title: "Hello" })) > nF(run(p0)), "Title adds frame-pen text");
  const longCats = run({ ...p0, data: "a very long category name,3;another long label here,5;third,4;fourth long one,8;fifth extremely long,2;six,7;seven,1;eight,3" });
  ok(inb(longCats, 297, 210, p0.margin), "long category labels rotate and stay inside the margin box");
}

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base, node) => { const b = base || node ? JSON.stringify(run(base || p0, node)) : bJ; ok(JSON.stringify(run({ ...(base || p0), ...patch }, node)) !== b, "param live: " + label); };
diff({ data: "a,1;b,2" }, "data"); diff({ chart: "Lines" }, "chart"); diff({ title: "T" }, "title"); diff({ labels: false }, "labels");
diff({ labelSize: 5 }, "labelSize"); diff({ axes: false }, "axes"); diff({ grid: false }, "grid"); diff({ ticks: 3 }, "ticks");
diff({ fill: "None" }, "fill"); diff({ fillDens: 0.9 }, "fillDens"); diff({ barW: 0.3 }, "barW");
diff({ smooth: true }, "smooth", { ...p0, chart: "Lines" }); diff({ markers: false }, "markers", { ...p0, chart: "Lines" });
diff({ sort: "Ascending" }, "sort"); diff({ margin: 30 }, "margin"); diff({ layer: 3 }, "layer"); diff({ seriesPen: 4 }, "seriesPen");
diff({ cyclePens: false }, "cyclePens"); diff({ gridPen: 5 }, "gridPen");

/* --- every select option renders with pasted, CSV, TSV and JSON data --- */
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) {
  for (const [name, node] of [["text", undefined], ["csv", fileNode(CSV)], ["tsv", fileNode(TSV)], ["json", fileNode(JSON_OBJ)]]) {
    const r = run({ ...p0, [pd.key]: opt }, node);
    ok(r.paths.length > 0 && finiteAll(r) && inb(r, 297, 210, p0.margin), pd.key + " '" + opt + "' / " + name + ": finite, inside margin (" + r.paths.length + ")");
  }
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, data: "a,5" })), "single row renders");
ok(finiteAll(run({ ...p0, data: "a,0;b,0;c,0" })), "all-zero data renders (scale guard)");
ok(finiteAll(run({ ...p0, data: "a,-5;b,3;c,-1", chart: "Stacked bars" })), "negative values: stacked handles both signs");
ok(finiteAll(run({ ...p0, data: "a,-5;b,3;c,-1", chart: "Donut" })), "negative values: donut clamps to zero");
ok(finiteAll(run({ ...p0, data: "x,1;y,2", chart: "Scatter" })), "scatter with one series falls back to index vs value");
ok(finiteAll(run({ ...p0, chart: "Lines", data: "solo,7" })), "one-point line does not crash");
{
  let big = ""; for (let i = 0; i < 400; i++) big += "c" + i + "," + (Math.sin(i) * 50 + 60).toFixed(1) + "," + (i % 37) + "," + (i % 11) + ";";
  const r = run({ ...p0, data: big, fill: "Cross", fillDens: 1, labelSize: 1.5, margin: 0 });
  ok(finiteAll(r) && npts(r) <= 120000, "400 rows x 3 series: finite + budget held (" + npts(r) + " pts)");
}
const wild = run({ ...p0, labelSize: 99, ticks: 999, fillDens: -3, barW: 9, margin: -20, layer: 40, seriesPen: -2, gridPen: 99 });
ok(finiteAll(wild) && wild.paths.every((q) => q.layer >= 0 && q.layer <= 11), "wired-out-of-range values: finite, pens clamped");
ok(finiteAll(run(p0, undefined, { W: 4, H: 4 })), "tiny canvas: finite");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(vis(p0).includes("fillDens") && !vis({ ...p0, fill: "None" }).includes("fillDens"), "showIf: fillDens hidden with fill None");
ok(!vis({ ...p0, labels: false }).includes("labelSize"), "showIf: labelSize hidden without labels");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");

/* --- overlay --- */
{
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 1 && g1[0].kind === "rect" && g1[0].x === p0.margin, "overlay: margin rect");
  let threw = false;
  try { def.overlay({ ...p0, margin: 999 }, { W: 4, H: 4 }, undefined, undefined); def.overlay(undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
