/* Validator for the Signature node.
   Run from the repo root: node tools/validate-signature.mjs
   The first line says which source was tested — it must read [baked] before shipping. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "signature";

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
const run = (p, ctx) => def.compute([undefined], p, ctx || { W: 297, H: 210 }, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const bbox = (r) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of r.paths) for (const [x, y] of q.pts) {
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
};

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
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) =>
  x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297), "in bounds on A4 tall");

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ text: "OTHER MARK" }, "text");
diff({ date: "2026-09-05" }, "date");
diff({ edMode: "No. n" }, "edMode");
diff({ num: 12 }, "num");
diff({ total: 60 }, "total");
diff({ font: "Italic" }, "font");
diff({ layout: "Stacked" }, "layout");
diff({ sep: "Slash" }, "sep");
diff({ size: 9 }, "size");
diff({ track: 160 }, "track");
diff({ slant: 15 }, "slant");
diff({ anchor: "Top left" }, "anchor");
diff({ margin: 40 }, "margin");
diff({ offX: 12 }, "offX");
diff({ offY: -9 }, "offY");
diff({ rot: 30 }, "rot");
diff({ rule: "Box" }, "rule");
diff({ layer: 5 }, "layer");

/* params that only bite in a non-default mode: compare against that mode's own base */
const stacked = { ...p0, layout: "Stacked" };
ok(JSON.stringify(run({ ...stacked, lineh: 260 })) !== JSON.stringify(run(stacked)), "param live: lineh (multi-line)");
ok(JSON.stringify(run({ ...stacked, align: "Left" })) !== JSON.stringify(run(stacked)), "param live: align (multi-line)");
const handBase = { ...p0, font: "Hand" };
ok(JSON.stringify(run({ ...handBase, tremor: 1 })) !== JSON.stringify(run(handBase)), "param live: tremor (Hand)");
ok(JSON.stringify(run({ ...handBase, seed: 99 })) !== JSON.stringify(run(handBase)), "param live: seed (Hand)");
ok(JSON.stringify(run({ ...p0, anchor: "Custom", px: 77 })) !== JSON.stringify(run({ ...p0, anchor: "Custom" })), "param live: px (Custom)");
ok(JSON.stringify(run({ ...p0, anchor: "Custom", py: 88 })) !== JSON.stringify(run({ ...p0, anchor: "Custom" })), "param live: py (Custom)");

/* seed must NOT move Plain / Italic — the tremor is the only seeded thing */
ok(JSON.stringify(run({ ...p0, seed: 4242 })) === bJ, "seed inert outside Hand (no hidden randomness)");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const r = run({ ...p0, [pd.key]: opt });
    const need = !(pd.key === "rule" && opt === "None") ? r.paths.length > 0 : r.paths.length > 0;
    ok(need && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
  }
}

/* --- content invariants --- */
ok(run({ ...p0, text: "", date: "", edMode: "None" }).paths.length === 0, "all fields empty -> EMPTY (no stray rule)");
const noEd = run({ ...p0, edMode: "None" });
ok(noEd.paths.length > 0 && npts(noEd) < npts(r1), "Edition None removes the number (" + npts(noEd) + " < " + npts(r1) + " pts)");
const oneL = bbox(r1), stackB = bbox(run(stacked));
ok(stackB.h > oneL.h * 1.8 && stackB.w < oneL.w, "Stacked is taller and narrower than One line");
ok(Math.abs(bbox(run({ ...p0, size: 8 })).h / oneL.h - 2) < 0.25, "size scales the block (2x size -> ~2x height)");

/* anchors land in the right corner of a 297x210 sheet */
const corner = (a) => { const b = bbox(run({ ...p0, anchor: a })); return { l: b.x0, r: 297 - b.x1, t: b.y0, b: 210 - b.y1 }; };
const br = corner("Bottom right"), tl = corner("Top left"), bl = corner("Bottom left");
ok(br.r < 14 && br.b < 14 && br.l > 100, "Bottom right hugs the bottom-right corner");
ok(tl.l < 14 && tl.t < 14 && tl.r > 100, "Top left hugs the top-left corner");
ok(bl.l < 14 && bl.b < 14, "Bottom left hugs the bottom-left corner");
const ct = bbox(run({ ...p0, anchor: "Center" }));
ok(Math.abs((ct.x0 + ct.x1) / 2 - 148.5) < 3 && Math.abs((ct.y0 + ct.y1) / 2 - 105) < 3, "Center centres the block");
const nud = bbox(run({ ...p0, offX: 10, offY: -10 }));
ok(Math.abs(nud.x0 - (oneL.x0 + 10)) < 0.01 && Math.abs(nud.y0 - (oneL.y0 - 10)) < 0.01, "Nudge is an exact mm translation");

/* rotation preserves the ink: total length is invariant */
const plen = (r) => r.paths.reduce((a, q) => a + H.pathLength(q.pts, q.closed), 0);
ok(Math.abs(plen(run({ ...p0, rot: 37 })) - plen(r1)) < 1e-6, "Rotate is rigid (path length preserved)");

/* Hand stays legible: glyph bbox must not blow up, and tremor 0 must equal a clean trace of the same skeleton */
const h1 = bbox(run({ ...handBase, tremor: 1 }));
ok(h1.w < oneL.w * 1.35 && h1.h < oneL.h * 1.6, "Hand at full tremor stays near the nominal block");
const hz = run({ ...handBase, tremor: 0 });
ok(finiteAll(hz) && hz.paths.length === run({ ...p0, font: "Italic" }).paths.length, "Hand at tremor 0 keeps the stroke count");

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, size: 1.5, track: 50, margin: 0, total: 1, num: 1, lineh: 90 })), "minimum params produce no NaN");
const ext = run({ ...p0, size: 40, track: 250, slant: 30, rot: 180, margin: 80, num: 500, total: 500, font: "Hand", tremor: 1, layout: "Stacked", rule: "Box" });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
ok(finiteAll(run({ ...p0, size: 40, font: "Hand", tremor: 1 }, { W: 60, H: 40 })), "tiny canvas produces no NaN");
ok(finiteAll(run({ ...p0, text: "ÄÖÅ 1234567890 .,-:!?'()+/" })), "full SFONT repertoire renders finite");
ok(finiteAll(run({ ...p0, text: "abc\u00e4\u00f6\u2603|~" })), "lowercase and unknown glyphs fall back safely");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(vis(p0).length > 0, "showIf: something is visible at defaults");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined),
  "showIf: hidden params still carry defaults");
ok(!vis(p0).includes("tremor") && vis({ ...p0, font: "Hand" }).includes("tremor"), "showIf: tremor only in Hand");
ok(!vis(p0).includes("px") && vis({ ...p0, anchor: "Custom" }).includes("px"), "showIf: px only in Custom");
ok(!vis({ ...p0, edMode: "None" }).includes("num"), "showIf: copy no. hidden when Edition None");
ok(!vis({ ...p0, edMode: "No. n" }).includes("total"), "showIf: edition size hidden in 'No. n'");

/* --- overlay: drift oracle against the real ink --- */
if (def.overlay) {
  const g1 = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
  ok(Array.isArray(g1) && g1.length > 0, "overlay returns guides (" + g1.length + ")");
  ok(g1.every((g) => g.kind !== "poly" || g.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))), "overlay guides finite");
  const cases = [
    ["defaults", p0],
    ["stacked", stacked],
    ["italic 20mm", { ...p0, font: "Italic", size: 20, layout: "Two lines" }],
    ["rotated", { ...p0, rot: 33 }],
    ["custom pos", { ...p0, anchor: "Custom", px: 60, py: 120, layout: "Stacked" }],
    ["top left slanted", { ...p0, anchor: "Top left", slant: 20, size: 12 }],
  ];
  let drift = 0;
  for (const [label, pp] of cases) {
    const gs = def.overlay(pp, { W: 297, H: 210 }, undefined, {});
    const poly = gs.find((g) => g.kind === "poly");
    const r = run(pp);
    if (!poly || !r.paths.length) { console.log("FAIL overlay drift: " + label + " (missing guide or ink)"); drift++; continue; }
    const gb = { x0: Math.min(...poly.pts.map((q) => q[0])), x1: Math.max(...poly.pts.map((q) => q[0])),
      y0: Math.min(...poly.pts.map((q) => q[1])), y1: Math.max(...poly.pts.map((q) => q[1])) };
    const ib = bbox(r);
    const pad = 0.6 * pp.size;
    const inside = ib.x0 > gb.x0 - pad && ib.x1 < gb.x1 + pad && ib.y0 > gb.y0 - pad && ib.y1 < gb.y1 + pad;
    const tight = (gb.x1 - gb.x0) < (ib.x1 - ib.x0) + 4 * pp.size && (gb.y1 - gb.y0) < (ib.y1 - ib.y0) + 4 * pp.size;
    ok(inside && tight, "overlay matches ink: " + label);
    if (!(inside && tight)) drift++;
  }
  ok(drift === 0, "overlay/compute layout in sync across " + cases.length + " cases");
  let threw = false;
  try {
    def.overlay({ ...p0 }, { W: 4, H: 4 }, undefined, undefined);
    def.overlay({ ...p0, text: "", date: "", edMode: "None" }, { W: 297, H: 210 });
    def.overlay(p0, undefined);
  } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
