/* Validator for the Fruits node. Run from the repo root:
   node tools/validate-fruits.mjs
   First line tells you which source was tested - read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "fruits";

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
const run = (p, ctx, node) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, node || {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const KINDS = def.params.find((q) => q.key === "kind").options.filter((k) => k !== "Mix");

const p0 = defaults();

/* --- static shape --- */
ok(def.cat === "gen" && def.group === "nature", "cat gen / group nature");
ok(typeof def.desc === "string" && def.desc.length > 200, "desc present");
ok(KINDS.length === 9, "nine fruit kinds (" + KINDS.join(", ") + ")");
ok(def.params.filter((q) => q.type === "pen").length === 4, "four pen params");
ok(def.params.some((q) => q.key === "label" && q.type === "text"), "label is a text param");

/* --- universal invariants --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");

const tol = 1.0;
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) =>
  x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 297, 210, p0.margin), "inside margin box on A4 wide (No overlap measures whole specimens)");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin), "inside margin box on A4 tall");
ok(inb(run({ ...p0, place: "Loose (may overlap)" }), 297, 210, 0), "Loose placement stays on the sheet (clamped)");

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ kind: "Lemon" }, "kind");
diff({ cut: "Whole" }, "cut");
diff({ count: 3 }, "count");
diff({ size: 30 }, "size");
diff({ sizeVar: 0 }, "sizeVar");
diff({ irr: 0.3 }, "irr");
diff({ fill: "None" }, "fill");
diff({ fillDens: 0.9 }, "fillDens");
diff({ details: 0 }, "details");
diff({ stems: false }, "stems");
diff({ sticker: "None" }, "sticker");
diff({ label: "BIO" }, "label");
diff({ place: "Loose (may overlap)" }, "place");
diff({ rotation: "Upright" }, "rotation");
diff({ tilt: 50 }, "tilt");
diff({ margin: 40 }, "margin");
diff({ seed: 24 }, "seed");
diff({ layer: 2 }, "layer");
diff({ penDetail: 2 }, "penDetail");
diff({ penLeaf: 2 }, "penLeaf");
diff({ penSticker: 2 }, "penSticker");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}
/* every kind x cut combination renders with interior details on the Detail pen when halved */
for (const k of KINDS) {
  const rw = run({ ...p0, kind: k, cut: "Whole", count: 4 });
  const rh = run({ ...p0, kind: k, cut: "Halved", count: 4 });
  ok(rw.paths.length > 0 && finiteAll(rw) && rh.paths.length > 0 && finiteAll(rh), k + ": Whole (" + rw.paths.length + ") and Halved (" + rh.paths.length + ") render");
  ok(rh.paths.some((q) => q.layer === p0.penDetail), k + " Halved: has Detail-pen interior");
  ok(!rw.paths.some((q) => q.layer === p0.penDetail), k + " Whole: nothing on the Detail pen");
}

/* --- node-specific oracles --- */
/* bare outlines: no fill, no details, no stems, no sticker -> exactly one closed body path per specimen */
{
  const pb = { ...p0, kind: "Lemon", cut: "Whole", fill: "None", details: 0, stems: false, sticker: "None", count: 5, size: 30, sizeVar: 0 };
  const r = run(pb);
  ok(r.paths.length === 5 && r.paths.every((q) => q.closed && q.layer === p0.layer), "bare Lemon: exactly one closed outline per specimen (" + r.paths.length + ")");
  const rp = run({ ...pb, kind: "Pomegranate" });
  ok(rp.paths.length === 10, "bare Pomegranate: outline + crown per specimen (" + rp.paths.length + ")");
  /* No overlap: specimen outlines have disjoint bounding boxes */
  const bbs = r.paths.map((q) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of q.pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; });
  let disjoint = true;
  for (let i = 0; i < bbs.length; i++) for (let j = i + 1; j < bbs.length; j++) { const A = bbs[i], B = bbs[j]; if (!(A[2] < B[0] || A[0] > B[2] || A[3] < B[1] || A[1] > B[3])) disjoint = false; }
  ok(disjoint, "No overlap: outline bounding boxes are pairwise disjoint");
  /* size is the body height (Upright, Lemon lies sideways so measure Apple) */
  const ra = run({ ...pb, kind: "Apple", rotation: "Upright", count: 1, size: 40, irr: 0 });
  const ys = ra.paths[0].pts.map((q) => q[1]);
  const hgt = Math.max(...ys) - Math.min(...ys);
  ok(hgt > 40 * 0.9 && hgt <= 40 + 1e-6, "Apple height is the size less only the dimple sink (" + hgt.toFixed(2) + " mm of 40)");
  const yTopMid = Math.min(...ra.paths[0].pts.filter((q) => Math.abs(q[0] - (Math.max(...ra.paths[0].pts.map((z) => z[0])) + Math.min(...ra.paths[0].pts.map((z) => z[0]))) / 2) < 1).map((q) => q[1]));
  ok(yTopMid - Math.min(...ys) > 3, "Apple: stem cavity sinks the top centre below the shoulders (" + (yTopMid - Math.min(...ys)).toFixed(2) + " mm)");
  const rl = run({ ...pb, rotation: "Upright", count: 1, size: 40, irr: 0 });
  const xs = rl.paths[0].pts.map((q) => q[0]), ys2 = rl.paths[0].pts.map((q) => q[1]);
  ok(Math.max(...xs) - Math.min(...xs) > Math.max(...ys2) - Math.min(...ys2), "Upright Lemon lies on its side (wider than tall)");
}
/* sticker: only on whole fruit, none when None, label adds strokes */
ok(!run({ ...p0, sticker: "None" }).paths.some((q) => q.layer === p0.penSticker), "sticker None: nothing on the Sticker pen");
ok(!run({ ...p0, cut: "Halved" }).paths.some((q) => q.layer === p0.penSticker), "halved fruit never carries a sticker");
{
  const nS = (r) => r.paths.filter((q) => q.layer === p0.penSticker).length;
  const a = run({ ...p0, cut: "Whole", label: "" }), b = run({ ...p0, cut: "Whole", label: "FRESH" });
  ok(nS(a) > 0 && nS(b) > nS(a), "empty label draws the oval only, a label adds glyph strokes (" + nS(a) + " -> " + nS(b) + ")");
  ok(finiteAll(run({ ...p0, cut: "Whole", label: "äö!? 123 lemon tree" })), "odd label characters do not crash");
  ok(finiteAll(run({ ...p0, cut: "Whole", label: null })), "null label tolerated");
}
/* fill: None has fewer paths than Hatch; hatch segments are 2-point open runs on the body pen */
{
  const pb = { ...p0, kind: "Lemon", cut: "Whole", details: 0, stems: false, sticker: "None", count: 3, size: 30, sizeVar: 0 };
  const rn = run({ ...pb, fill: "None" }), rh = run({ ...pb, fill: "Hatch" });
  ok(rn.paths.length === 3 && rh.paths.length > 3, "Hatch adds paths over bare outlines (" + rn.paths.length + " -> " + rh.paths.length + ")");
  ok(rh.paths.filter((q) => !q.closed).every((q) => q.pts.length === 2 && q.layer === p0.layer), "every hatch path is a 2-point open run on the body pen");
  ok(rh.paths.filter((q) => q.closed).length === 3, "hatch leaves the three outlines intact");
  const rd = run({ ...pb, fill: "Hatch", fillDens: 1 });
  ok(rd.paths.length > rh.paths.length, "higher Fill density = more hatch runs");
}
/* stems: leaf pen only appears with stems on */
ok(!run({ ...p0, stems: false }).paths.some((q) => q.layer === p0.penLeaf), "stems off: nothing on the Leaf pen");
ok(run({ ...p0, stems: true, kind: "Apple", cut: "Whole" }).paths.some((q) => q.layer === p0.penLeaf), "Apple whole with stems: Leaf-pen paths present");
/* starfruit halved is a 90-point star outline */
ok(run({ ...p0, kind: "Starfruit", cut: "Halved", count: 1 }).paths.some((q) => q.closed && q.pts.length === 90 && q.layer === p0.layer), "Starfruit halved: 90-point star outline");
/* details 0 removes the halved pomegranate arils but keeps membranes */
{
  const a = run({ ...p0, kind: "Pomegranate", cut: "Halved", count: 2, details: 0 }), b = run({ ...p0, kind: "Pomegranate", cut: "Halved", count: 2, details: 1 });
  ok(b.paths.length > a.paths.length * 2, "Pomegranate halved: Details fills in the arils (" + a.paths.length + " -> " + b.paths.length + ")");
}
/* Mix cycles kinds: nine specimens with Mix use all nine kinds -> more distinct path signatures than a single kind */
ok(JSON.stringify(run({ ...p0, kind: "Mix", count: 9 })) !== JSON.stringify(run({ ...p0, kind: "Lemon", count: 9 })), "Mix differs from a single kind");

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, count: 1, size: 10, sizeVar: 1, irr: 0, fillDens: 0.1, details: 0, tilt: 0, margin: 0 })), "degenerate params produce no NaN");
const ext = run({ ...p0, count: 40, size: 150, sizeVar: 0, irr: 0.5, fill: "Stipple", fillDens: 1, details: 1, cut: "Halved", kind: "Pomegranate", margin: 0 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
const wild = run({ ...p0, count: 400, size: 9999, sizeVar: 5, irr: -3, fillDens: 50, details: 9, tilt: -80, margin: -20, seed: -1, layer: 99, penDetail: -4 });
ok(finiteAll(wild) && npts(wild) <= 120000 && wild.paths.every((q) => q.layer >= 0 && q.layer <= 11), "wired-out-of-range values: finite, budget held, pens clamped (" + npts(wild) + " pts)");
ok(finiteAll(run(p0, { W: 8, H: 8 })), "tiny canvas: finite");
ok(finiteAll(run({ ...p0, size: 300 })), "oversized specimens skipped without error");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(vis(p0).includes("fillDens") && !vis({ ...p0, fill: "None" }).includes("fillDens"), "showIf: fillDens hidden when fill None");
ok(vis(p0).includes("label") && !vis({ ...p0, sticker: "None" }).includes("label"), "showIf: label hidden when sticker None");
ok(vis(p0).includes("tilt") && !vis({ ...p0, rotation: "Random" }).includes("tilt"), "showIf: tilt only in Tilt mode");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");

/* --- overlay --- */
{
  const g1 = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g1) && g1.length === 1 && g1[0].kind === "rect" && g1[0].x === p0.margin, "overlay returns the margin rect");
  let threw = false;
  try { def.overlay({ ...p0, margin: 999 }, { W: 4, H: 4 }, undefined, undefined); def.overlay(undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
