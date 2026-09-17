/* Validator for the Lettering node. Run from the repo root: node tools/validate-lettering.mjs
   First line tells you which source was tested — read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "lettering";

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
const run = (p, ctx) => def.compute([undefined], p, ctx || CTX, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bbox = (r) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of r.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; };
const inb = (r, W, Hh, m, tol) => r.paths.every((q) => q.pts.every(([x, y]) => x >= m - tol && x <= W - m + tol && y >= m - tol && y <= Hh - m + tol));
const longest = (r) => { let m = 0; for (const q of r.paths) for (let i = 1; i < q.pts.length; i++) m = Math.max(m, Math.hypot(q.pts[i][0] - q.pts[i - 1][0], q.pts[i][1] - q.pts[i - 1][1])); return m; };

const p0 = defaults();
const FONTS = def.params.find((q) => q.key === "font").options;
const flat = (t, extra) => run({ ...p0, text: t, depth: 0, ...(extra || {}) });

/* --- definition shape --- */
ok(def.cat === "gen" && def.group === "textimg", "definition: gen/textimg");
ok(typeof def.desc === "string" && def.desc.length > 200, "definition: desc present");
ok(Array.isArray(def.ins) && def.ins.length === 1 && def.ins[0].type === "style", "pins: Style input");
ok(Array.isArray(def.outs) && def.outs.length === 1 && def.outs[0].type === "paths", "pins: one paths output");
ok(def.params.every((q) => /^[a-z][a-z0-9]*$/i.test(q.key)) && new Set(def.params.map((q) => q.key)).size === def.params.length, "params: unique keys");
ok(def.params.some((q) => q.type === "pen") && def.params.some((q) => q.type === "text"), "params: text and pen present (no seed: the node is fully deterministic)");
ok(FONTS.length === 3, "three fonts (" + FONTS.join(", ") + ")");

/* --- universal invariants at defaults --- */
const t0 = Date.now();
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
ok(inb(r1, 297, 210, p0.margin, 1.0), "in bounds inside margin on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin, 1.0), "in bounds inside margin on A4 tall");
ok(Date.now() - t0 < 6000, "two default renders under 6 s (" + (Date.now() - t0) + " ms)");

/* --- every font, flat and extruded --- */
for (const f of FONTS) {
  const r = flat("BUNDLE|EVERYTHING", { font: f });
  const bb = bbox(r);
  ok(r.paths.length > 0 && finiteAll(r) && inb(r, 297, 210, p0.margin, 1.0) && r.paths.every((q) => q.closed), "font '" + f + "' flat: closed outlines in bounds (" + r.paths.length + " paths)");
  ok(bb.w > 100 && bb.h > 40, "font '" + f + "' has real extent (" + bb.w.toFixed(0) + " x " + bb.h.toFixed(0) + " mm)");
  const e = run({ ...p0, font: f });
  ok(e.paths.length > r.paths.length && npts(e) > npts(r) && inb(e, 297, 210, p0.margin, 1.0), "font '" + f + "' extruded: more paths, still in bounds (" + e.paths.length + ")");
}

/* --- face geometry --- */
{
  const bold = flat("I", { font: "Bold", size: 40, weight: 20, slant: 0 });
  const bb = bbox(bold);
  ok(bold.paths.length === 1 && bold.paths[0].closed, "Bold 'I' is a single closed outline");
  ok(Math.abs(bb.w - 8) < 0.8, "Bold 'I' at size 40 weight 20% is ~8 mm wide (" + bb.w.toFixed(2) + ")");
  ok(Math.abs(bb.h - 48) < 1.2, "Bold 'I' is cap height plus the round ends (" + bb.h.toFixed(2) + " ~ 48)");
  const block = flat("I", { font: "Block", size: 40, weight: 20 });
  ok(Math.abs(bbox(block).w - 8) < 0.8 && Math.abs(bbox(block).h - 48) < 1.2, "Block 'I' has square ends at the same weight");
  const rom0 = flat("I", { font: "Roman", size: 40, weight: 20, nib: 0 }), rom90 = flat("I", { font: "Roman", size: 40, weight: 20, nib: 90 });
  ok(Math.abs(bbox(rom0).w - 8) < 0.8 && bbox(rom90).w < 1.6, "Roman nib 0 makes a vertical stroke full width (" + bbox(rom0).w.toFixed(2) + "), nib 90 a hairline (" + bbox(rom90).w.toFixed(2) + ")");
  const romH = flat("-", { font: "Roman", size: 40, weight: 20, nib: 0 });
  ok(bbox(romH).h < 1.6, "Roman nib 0 makes a horizontal stroke a hairline (" + bbox(romH).h.toFixed(2) + ")");
  const outl = flat("BOLD", { fill: "Outline" }), hat = flat("BOLD", { fill: "Hatch" }), inl = flat("BOLD", { fill: "Inline" });
  ok(hat.paths.length > outl.paths.length * 3 && hat.paths.some((q) => !q.closed), "Fill Hatch adds open hatch lines (" + outl.paths.length + " -> " + hat.paths.length + ")");
  ok(inl.paths.length > outl.paths.length && inl.paths.every((q) => q.closed), "Fill Inline adds concentric closed outlines (" + outl.paths.length + " -> " + inl.paths.length + ")");
  const h1 = flat("BOLD", { fill: "Hatch", hatch: 1 }), h2 = flat("BOLD", { fill: "Hatch", hatch: 2 });
  ok(h1.paths.length > h2.paths.length * 1.5, "Hatch spacing controls line count (" + h1.paths.length + " vs " + h2.paths.length + ")");
  const a0 = flat("BOLD", { fill: "Hatch", hangle: 0 }), a90 = flat("BOLD", { fill: "Hatch", hangle: 90 });
  const horiz = (r) => r.paths.filter((q) => !q.closed).every((q) => Math.abs(q.pts[0][1] - q.pts[q.pts.length - 1][1]) < 0.3);
  ok(horiz(a0) && !horiz(a90), "Hatch angle 0 is horizontal, 90 is vertical");
  const wide = flat("W", { size: 40, weight: 40 }), thin = flat("W", { size: 40, weight: 6 });
  ok(bbox(wide).w > bbox(thin).w + 8 && thin.paths.length >= 1, "Weight changes the stroke thickness (" + bbox(thin).w.toFixed(1) + " -> " + bbox(wide).w.toFixed(1) + ")");
  ok(JSON.stringify(flat("bold")) === JSON.stringify(flat("BOLD")), "input is upper-cased");
  const s0 = bbox(flat("I", { slant: 0, size: 40 })), s20 = bbox(flat("I", { slant: 20, size: 40 }));
  ok(s20.w > s0.w + 8, "Slant shears the letters (" + s0.w.toFixed(1) + " -> " + s20.w.toFixed(1) + " mm wide)");
}

/* --- extrusion --- */
{
  const base = { ...p0, text: "I", font: "Bold", size: 40, weight: 20, slant: 0, fill: "Outline" };
  const d0 = run({ ...base, depth: 0 }), d10 = run({ ...base, depth: 10, dangle: 0, side: "Outline" });
  const b0 = bbox(d0), b10 = bbox(d10);
  ok(Math.abs(b10.w - (b0.w + 10)) < 0.6 && Math.abs(b10.h - b0.h) < 0.6, "Depth 10 at angle 0 widens the block by exactly 10 mm (" + b0.w.toFixed(1) + " -> " + b10.w.toFixed(1) + ")");
  const d90 = bbox(run({ ...base, depth: 10, dangle: 90, side: "Outline" }));
  ok(Math.abs(d90.h - (b0.h + 10)) < 0.6 && Math.abs(d90.w - b0.w) < 0.6, "Depth angle 90 extrudes straight down");
  ok(d10.paths.length >= 2 && d10.paths.every((q) => q.closed || q.pts.length >= 2), "extruded 'I' has the face outline plus a back silhouette (" + d10.paths.length + " paths)");
  const backs = d10.paths.filter((q) => !q.closed);
  ok(backs.length >= 1 && backs.every((q) => q.pts.some((pt) => pt[0] > b0.x1 + 5)) && d10.paths.filter((q) => q.closed).length === 1, "back silhouette is an open path reaching the depth side; the face outline is drawn once (" + backs.length + " back, 1 face)");
  for (const st of ["Zigzag", "Lines", "Hatch", "Outline"]) {
    const r = run({ ...p0, side: st });
    ok(r.paths.length > 0 && finiteAll(r) && inb(r, 297, 210, p0.margin, 1.0), "side texture '" + st + "' renders in bounds (" + r.paths.length + " paths)");
  }
  const zo = run({ ...p0, side: "Outline" }), zz = run({ ...p0, side: "Zigzag" }), zl = run({ ...p0, side: "Lines" }), zh = run({ ...p0, side: "Hatch" });
  ok(zz.paths.length > zo.paths.length && zz.paths.some((q) => !q.closed && q.pts.length >= 3), "Zigzag adds open sawtooth strips");
  ok(zl.paths.length > zz.paths.length && zl.paths.filter((q) => !q.closed).every((q) => q.pts.length >= 2), "Lines adds many rules (" + zl.paths.length + " > " + zz.paths.length + ")");
  ok(zh.paths.length > zo.paths.length, "Hatch fills the sides");
  const g1 = run({ ...p0, side: "Lines", sidegap: 1 }), g3 = run({ ...p0, side: "Lines", sidegap: 3 });
  ok(g1.paths.length > g3.paths.length * 1.8, "Side pitch controls the rule count (" + g1.paths.length + " vs " + g3.paths.length + ")");
  /* a rule never runs into another letter's face */
  const two = run({ ...p0, text: "II", font: "Block", size: 40, weight: 20, tracking: 0.6, depth: 14, dangle: 0, side: "Lines", sidegap: 2, fill: "Outline" });
  const faces = flat("II", { font: "Block", size: 40, weight: 20, tracking: 0.6 });
  const fb = faces.paths.map((q) => bbox({ paths: [q] }));
  const rightFace = fb.reduce((a, b) => (b.x0 > a.x0 ? b : a));
  const rules = two.paths.filter((q) => !q.closed);
  const leak = rules.filter((q) => q.pts.some((pt) => pt[0] > rightFace.x0 + 0.6 && pt[0] < rightFace.x1 - 0.6 && pt[1] > rightFace.y0 + 0.6 && pt[1] < rightFace.y1 - 0.6));
  ok(rules.length > 4 && leak.length === 0, "rules from the first I stop at the second I's face (" + rules.length + " rules, " + leak.length + " leaking)");
}

/* --- layout --- */
{
  const L = flat("MUUSIA", { align: "Left" }), R = flat("MUUSIA", { align: "Right" }), C = flat("MUUSIA", { align: "Center" });
  ok(Math.abs(bbox(L).x0 - p0.margin) < 4 && Math.abs(bbox(R).x1 - (297 - p0.margin)) < 4, "Align Left/Right hug the margins (" + bbox(L).x0.toFixed(1) + ", " + bbox(R).x1.toFixed(1) + ")");
  ok(Math.abs((bbox(C).x0 + bbox(C).x1) / 2 - 148.5) < 3, "Align Center centres the line");
  const y0 = bbox(flat("MUUSIA", { yoff: 0 })), yUp = bbox(flat("MUUSIA", { yoff: -40 }));
  ok(Math.abs((y0.y0 - yUp.y0) - 40) < 0.05, "Y offset moves the block exactly");
  const l1 = bbox(flat("A|B", { lineh: 1.2 })), l2 = bbox(flat("A|B", { lineh: 2.5 }));
  ok(l2.h > l1.h + 20, "Line height spreads the lines (" + l1.h.toFixed(1) + " -> " + l2.h.toFixed(1) + ")");
  const t1 = bbox(flat("MMM", { tracking: 0.6 })), t2 = bbox(flat("MMM", { tracking: 2 }));
  ok(t2.w > t1.w, "Tracking widens the word");
  const big = flat("A VERY LONG LINE THAT CANNOT FIT", { size: 80 });
  ok(inb(big, 297, 210, p0.margin, 1.0) && bbox(big).w > 250, "shrink only: an over-long line is fitted to the margins (" + bbox(big).w.toFixed(0) + " mm)");
  const small = bbox(flat("I", { size: 20, weight: 10 }));
  ok(small.h < 20 * 1.15 && small.h > 19, "shrink only: a short line keeps its size (" + small.h.toFixed(1) + ")");
  ok(inb(run({ ...p0, text: "MUUSIA|PLOTTER|LETTERING", size: 120, weight: 30, depth: 30 }), 297, 210, p0.margin, 1.0), "shrink only: heavy 120 mm extruded capitals fit the sheet");
  const rotd = run({ ...p0, rotate: 30, size: 60 });
  ok(inb(rotd, 297, 210, p0.margin, 1.0) && JSON.stringify(rotd) !== JSON.stringify(run({ ...p0, size: 60 })), "Rotate turns the block and keeps it inside the margins");
  const rb = bbox(run({ ...p0, text: "I", rotate: 90, depth: 0, size: 40, weight: 10 }));
  ok(rb.w > rb.h * 3, "Rotate 90 lays the I on its side");
}

/* --- every parameter must do something --- */
const J = (p) => JSON.stringify(run(p));
const baseJ = J(p0);
const diff = (patch, label, base) => ok(J({ ...(base || p0), ...patch }) !== (base ? J(base) : baseJ), "param live: " + label);
diff({ text: "OTHER" }, "text");
diff({ font: "Block" }, "font");
diff({ size: 40 }, "size (short text, not shrink-fitted)", { ...p0, text: "MU" });
diff({ weight: 35 }, "weight");
diff({ nib: 70 }, "nib (Roman)", { ...p0, font: "Roman" });
diff({ slant: 15 }, "slant");
diff({ fill: "Hatch" }, "fill");
diff({ hatch: 0.6 }, "hatch (Hatch fill)", { ...p0, fill: "Hatch" });
diff({ hangle: 90 }, "hangle (Hatch fill)", { ...p0, fill: "Hatch" });
diff({ depth: 0 }, "depth");
diff({ dangle: 45 }, "dangle");
diff({ side: "Lines" }, "side");
diff({ sidegap: 3 }, "sidegap");
diff({ rotate: 10 }, "rotate");
diff({ tracking: 1.5 }, "tracking");
diff({ lineh: 2.5 }, "lineh");
diff({ align: "Left" }, "align");
diff({ yoff: 30 }, "yoff");
diff({ margin: 40 }, "margin (with an over-long line)", { ...p0, text: "A VERY LONG LINE THAT CANNOT FIT" });
diff({ layer: 3 }, "layer");
ok(run({ ...p0, layer: 3 }).paths.every((q) => q.layer === 3), "layer applies to every path");

/* --- degenerate --- */
ok(run({ ...p0, text: "" }).paths.length === 0, "empty text gives empty output, no throw");
ok(run({ ...p0, text: "   " }).paths.length === 0, "spaces only give empty output");
ok(finiteAll(run({ ...p0, text: "§¤{}~^" })), "unknown characters are skipped without throwing");
ok(finiteAll(run({ ...p0, text: "|||" })), "empty lines do not throw");
ok(finiteAll(run({ ...p0, text: "MUUSIA", size: 0, weight: 0, margin: -5, tracking: 0, lineh: 0, slant: 400, depth: -3, sidegap: 0, hatch: 0 })), "degenerate params produce no NaN");
ok(finiteAll(run(p0, { W: 30, H: 20 })), "tiny sheet does not throw");
for (const f of FONTS) {
  const tt = Date.now();
  const ext = run({ ...p0, font: f, text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ|0123456789 ÄÖÅ|BUNDLE EVERYTHING", size: 60, weight: 40, fill: "Hatch", hatch: 0.4, depth: 40, side: "Lines", sidegap: 0.5, rotate: 20 });
  ok(finiteAll(ext) && npts(ext) <= 120000 && ext.paths.length > 0 && inb(ext, 297, 210, p0.margin, 1.0), "extreme " + f + ": alphabet, dense hatch, deep rotated extrusion — finite, budget, in bounds (" + npts(ext) + " pts, " + (Date.now() - tt) + " ms)");
}

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
  const vB = vis({ ...p0, font: "Bold", fill: "Outline", depth: 0 }), vR = vis({ ...p0, font: "Roman", fill: "Hatch", depth: 7, side: "Zigzag" }), vO = vis({ ...p0, depth: 7, side: "Outline" });
  ok(!vB.includes("nib") && !vB.includes("hatch") && !vB.includes("dangle") && !vB.includes("side") && !vB.includes("sidegap"), "showIf: flat Bold Outline hides Nib, Hatch, Depth angle, Side texture");
  ok(vR.includes("nib") && vR.includes("hatch") && vR.includes("hangle") && vR.includes("dangle") && vR.includes("side") && vR.includes("sidegap"), "showIf: extruded Roman Hatch shows all of them");
  ok(vO.includes("side") && !vO.includes("sidegap"), "showIf: Side texture Outline hides Side pitch");
}

/* --- overlay --- */
if (def.overlay) {
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 1 && g1[0].kind === "rect", "overlay: margin rect");
  let threw = false;
  try { def.overlay({ ...p0 }, { W: 4, H: 4 }, undefined, undefined); def.overlay({}, {}, null, null); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
} else ok(false, "overlay missing");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
