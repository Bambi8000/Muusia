/* Validator for the Sand Painting node.
   Run from the repo root: node tools/validate-sand_painting.mjs

   The correctness proof is a black-box one: stones are drawn on their own pen,
   so the stone outlines can be read back out of the output and every sand point
   tested against them. No node internals are duplicated here. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "sand_painting";
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

const p0 = defaults();
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults (" + npts(r1) + " pts)");

/* --- the margin box is a hard clip, on both orientations and every pattern --- */
const clipped = (r, W, Hh, m) => r.paths.every((q) => q.pts.every(([x, y]) => x >= m - 0.01 && x <= W - m + 0.01 && y >= m - 0.01 && y <= Hh - m + 0.01));
ok(clipped(r1, 297, 210, 10), "everything inside the 10 mm margin on A4 wide");
ok(clipped(run(p0, { W: 210, H: 297 }), 210, 297, 10), "everything inside the margin on A4 tall");
for (const pat of def.params.find((q) => q.key === "pattern").options) {
  const r = run({ ...p0, pattern: pat, margin: 25 });
  ok(clipped(r, 297, 210, 25), "margin clip holds: " + pat);
}

/* --- stone clearing oracle: no sand point may fall inside a drawn stone --- */
const inPoly = (x, y, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) hit = !hit;
  }
  return hit;
};
const area = (poly) => { let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] - poly[i][0]) * (poly[j][1] + poly[i][1]); return Math.abs(a / 2); };
const clearance = (p) => {
  const r = run(p);
  const stones = r.paths.filter((q) => q.layer === p.stonePen && q.closed).map((q) => q.pts).sort((a, b) => area(b) - area(a));
  /* keep only outermost, non-nested outlines */
  const outer = [];
  for (const s of stones) {
    const c = s[0];
    if (!outer.some((o) => inPoly(c[0], c[1], o))) outer.push(s);
  }
  let inside = 0, total = 0;
  for (const q of r.paths) {
    if (q.layer !== p.sandPen) continue;
    for (const [x, y] of q.pts) { total++; if (outer.some((o) => inPoly(x, y, o))) inside++; }
  }
  return { inside, total, stones: outer.length };
};
for (const pat of ["Open rake", "Flow around stones", "Island rings", "Mixed garden", "Spiral rake"]) {
  const c = clearance({ ...p0, pattern: pat });
  const frac = c.total ? c.inside / c.total : 0;
  ok(c.stones > 0 && frac < 0.004, "sand cleared around " + c.stones + " stones: " + pat + " (" + c.inside + "/" + c.total + " pts inside = " + (frac * 100).toFixed(2) + "%)");
}
const c0 = clearance({ ...p0, stoneCount: 0 });
ok(c0.stones === 0, "Stones 0 draws no stones");
ok(run({ ...p0, stoneCount: 0 }).paths.every((q) => q.layer === p0.sandPen), "Stones 0 leaves nothing on the stone pen");

/* --- pens are separable --- */
const ls = [...new Set(r1.paths.map((q) => q.layer))].sort((a, b) => a - b);
ok(ls.length === 2 && ls[0] === 0 && ls[1] === 1, "sand and stones land on two distinct pens");
const swapped = run({ ...p0, sandPen: 4, stonePen: 9 });
ok([...new Set(swapped.paths.map((q) => q.layer))].sort((a, b) => a - b).join() === "4,9", "pen params route the layers");

/* --- param liveness --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label) => ok(JSON.stringify(run({ ...p0, ...patch })) !== bJ, "param live: " + label);
diff({ pattern: "Open rake" }, "pattern");
diff({ spacing: 5 }, "spacing");
diff({ direction: 45 }, "direction");
diff({ wave: 8 }, "wave");
diff({ wavelength: 120 }, "wavelength");
diff({ flow: 0 }, "flow");
diff({ jitter: 2 }, "jitter");
diff({ detail: 3 }, "detail");
diff({ stoneCount: 2 }, "stoneCount");
diff({ stoneSize: 35 }, "stoneSize");
diff({ stoneVariation: 100 }, "stoneVariation");
diff({ stoneIrregular: 100 }, "stoneIrregular");
diff({ stoneContours: 5 }, "stoneContours");
diff({ rings: 12 }, "rings");
diff({ ringGap: 6 }, "ringGap");
diff({ seed: 4242 }, "seed");
diff({ sandPen: 7 }, "sandPen");
diff({ stonePen: 7 }, "stonePen");
diff({ margin: 35 }, "margin");
const spir = { ...p0, pattern: "Spiral rake" };
const spJ = JSON.stringify(run(spir));
ok(JSON.stringify(run({ ...spir, spiralCenterX: 20 })) !== spJ, "param live: spiralCenterX (Spiral)");
ok(JSON.stringify(run({ ...spir, spiralCenterY: 20 })) !== spJ, "param live: spiralCenterY (Spiral)");

/* --- select options --- */
for (const opt of def.params.find((q) => q.key === "pattern").options) {
  const r = run({ ...p0, pattern: opt });
  ok(r.paths.length > 0 && finiteAll(r), "pattern '" + opt + "' draws finite paths (" + r.paths.length + ")");
}

/* --- the seed must actually move the garden, not just wobble it --- */
const centres = (s) => run({ ...p0, seed: s }).paths.filter((q) => q.layer === 1 && q.closed)
  .map((q) => q.pts.reduce((a, t) => [a[0] + t[0] / q.pts.length, a[1] + t[1] / q.pts.length], [0, 0]));
const cA = centres(108), cB = centres(999);
const moved = cA.length !== cB.length || cA.some((a, i) => cB[i] && Math.hypot(a[0] - cB[i][0], a[1] - cB[i][1]) > 10);
ok(moved, "a new seed relocates the stones, not just the rake noise");

/* --- rake spacing is physical: halving the spacing roughly doubles the furrows --- */
const furrows = (sp) => run({ ...p0, pattern: "Open rake", spacing: sp, stoneCount: 0 }).paths.length;
const f2 = furrows(4), f1 = furrows(2);
ok(f1 > f2 * 1.6 && f1 < f2 * 2.4, "furrow count scales with rake spacing (" + f2 + " -> " + f1 + ")");

/* --- adaptive coarsening must hold the budget at the worst settings --- */
for (const [label, pp] of [
  ["densest rake", { pattern: "Open rake", spacing: 0.5, detail: 0.3, stoneCount: 0 }],
  ["densest spiral", { pattern: "Spiral rake", spacing: 0.5, detail: 0.3, stoneCount: 0 }],
  ["everything maxed", { pattern: "Mixed garden", spacing: 0.5, detail: 0.3, stoneCount: 12, stoneSize: 45, rings: 14, ringGap: 0.5, stoneContours: 6, wave: 15, jitter: 3 }],
]) {
  const r = run({ ...p0, ...pp });
  const n = npts(r);
  ok(finiteAll(r) && n <= 120000, "budget held: " + label + " (" + n + " pts)");
}

/* --- degenerate --- */
ok(finiteAll(run({ ...p0, spacing: 0.5, detail: 0.3, wave: 0, jitter: 0, stoneCount: 0, margin: 0 })), "minimum params produce no NaN");
ok(finiteAll(run(p0, { W: 40, H: 30 })), "tiny canvas produces no NaN");
ok(finiteAll(run({ ...p0, margin: 60 }, { W: 80, H: 80 })), "margin larger than half the sheet produces no NaN");
ok(finiteAll(run({ ...p0, stoneSize: 45, stoneCount: 12 }, { W: 60, H: 60 })), "stones larger than the sheet produce no NaN");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
ok(!vis({ ...p0, pattern: "Island rings" }).includes("direction"), "showIf: direction hidden for Island rings");
ok(vis(spir).includes("spiralCenterX") && !vis(p0).includes("spiralCenterX"), "showIf: spiral centre only for Spiral rake");
ok(vis(p0).includes("rings"), "showIf: ring controls visible in Mixed garden");

/* --- overlay --- */
const g = def.overlay(p0, { W: 297, H: 210 }, undefined, {});
ok(Array.isArray(g) && g.length > 0, "overlay returns guides (" + g.length + ")");
const gr = g.find((q) => q.kind === "rect");
ok(gr && Math.abs(gr.x - 10) < 0.01 && Math.abs(gr.w - 277) < 0.01, "overlay rect equals the margin box");
const gs = def.overlay(spir, { W: 297, H: 210 }, undefined, {});
ok(gs.some((q) => q.kind === "point"), "overlay marks the spiral centre in Spiral rake");
let threw = false;
try { def.overlay(p0, { W: 4, H: 4 }); def.overlay({ ...p0, margin: 999 }, { W: 297, H: 210 }); } catch (e) { threw = true; }
ok(!threw, "overlay never throws on degenerate input");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
