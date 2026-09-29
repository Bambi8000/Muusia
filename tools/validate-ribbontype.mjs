/* Validator for the Ribbon Type node. Run from the repo root:
   node tools/validate-ribbontype.mjs
   First line tells you which source was tested - read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "ribbontype";

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
const bbox = (r) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of r.paths) for (const [x, y] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 }; };
const p0 = defaults();

/* --- static shape --- */
ok(def.cat === "gen" && def.group === "textimg", "cat gen / group textimg");
ok(typeof def._glyphs === "function" && typeof def._layout === "function", "_glyphs / _layout helpers present");
ok(def.params.some((q) => q.key === "text" && q.type === "text"), "text param");
ok(typeof def.desc === "string" && def.desc.length > 200, "desc present");
{
  const G = def._glyphs(2, 0.6);
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  ok(letters.every((c) => G[c] && Array.isArray(G[c].s) && typeof G[c].adv === "number"), "all 26 lowercase glyphs defined");
  ok(G[" "] && G[" "].s.length === 0, "space is a blank advance");
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
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin), "inside margin box on A4 tall");

/* --- ribbon oracles on a single stem "l" --- */
{
  const pl = { ...p0, text: "l", fit: false, xh: 30, width: 0.5, gap: 0.6, slant: 0, stretchX: 1, stretchY: 1 };
  const r = run(pl);
  const N = Math.round((0.5 * 30) / 0.6) + 1;
  ok(r.paths.length === N, "stem: one path per offset line, N = round(width/gap)+1 (" + r.paths.length + " = " + N + ")");
  ok(r.paths.every((q) => q.pts.length === 2 && Math.abs(q.pts[0][0] - q.pts[1][0]) < 1e-9), "stem: every line is a 2-point vertical");
  const xs = r.paths.map((q) => q.pts[0][0]).sort((a, b) => a - b);
  const gaps = xs.slice(1).map((x, i) => x - xs[i]);
  ok(Math.max(...gaps) - Math.min(...gaps) < 1e-9 && Math.abs(gaps[0] - 15 / (N - 1)) < 1e-9, "stem: lines evenly spaced across exactly the ribbon width");
  ok(Math.abs(bbox(r).h - 30 * p0.asc) < 1e-6, "stem height = ascender x x-height (" + bbox(r).h.toFixed(2) + ")");
  /* alternate direction for pen travel */
  let alt = 0; for (let i = 1; i < r.paths.length; i++) if ((r.paths[i].pts[0][1] < r.paths[i].pts[1][1]) !== (r.paths[i - 1].pts[0][1] < r.paths[i - 1].pts[1][1])) alt++;
  ok(alt === r.paths.length - 1, "stem: consecutive lines alternate direction");
  /* stretch: X leaves a stem's ribbon width alone, Y doubles its height */
  ok(Math.abs(bbox(run({ ...pl, stretchX: 2.5 })).w - 15) < 1e-6, "stretch X keeps the ribbon width (skeleton-only deformation)");
  ok(Math.abs(bbox(run({ ...pl, stretchY: 2 })).h - 60 * p0.asc) < 1e-6, "stretch Y doubles the stem height");
  /* slant: top displaced by tan(slant) x height */
  const rs = run({ ...pl, slant: 20 });
  const q = rs.paths[0].pts, top = q[0][1] < q[1][1] ? q[0] : q[1], bot = q[0][1] < q[1][1] ? q[1] : q[0];
  ok(Math.abs((top[0] - bot[0]) / (bot[1] - top[1]) - Math.tan(20 * Math.PI / 180)) < 1e-6, "slant 20: stems lean by tan(20)");
}
/* --- bowl oracles on "o" --- */
{
  const po = { ...p0, text: "o", fit: false, xh: 30, gap: 0.6, facets: 8 };
  const thin = run({ ...po, width: 0.3 });
  const N = Math.round((0.3 * 30) / 0.6) + 1;
  ok(thin.paths.length === N && thin.paths.every((q) => q.closed), "thin bowl: N concentric closed rings");
  const radii = thin.paths.map((q) => { const b = bbox({ paths: [q] }); return (b.w + b.h) / 4; }).sort((a, b) => a - b);
  const rg = radii.slice(1).map((v, i) => v - radii[i]);
  ok(Math.max(...rg) - Math.min(...rg) < 1e-3 && Math.abs(rg[0] - 9 / (N - 1)) < 1e-3, "thin bowl: ring radii evenly spaced by the line pitch");
  const fat = run({ ...po, width: 1.2 });
  const Nf = Math.round((1.2 * 30) / 0.6) + 1;
  ok(fat.paths.length < Nf && fat.paths.length > Nf / 2 && fat.paths.every((q) => q.closed), "fat bowl: inner rings collapse into the centre and vanish (" + fat.paths.length + " of " + Nf + ")");
  const rmin = Math.min(...fat.paths.map((q) => bbox({ paths: [q] }).w / 2));
  ok(rmin > 0 && rmin < 1.5, "fat bowl: smallest surviving ring is a pinhole (" + rmin.toFixed(2) + " mm)");
  /* facets 1: diamond bowl */
  const dia = run({ ...po, width: 0.3, facets: 1 });
  ok(dia.paths.every((q) => q.closed && q.pts.length === 4), "facets 1: bowl is a 4-point diamond");
}
/* --- arch collapse: fat "n" stays finite and draws --- */
{
  const r = run({ ...p0, text: "n", width: 1.3, fit: false, xh: 30 });
  ok(r.paths.length > 0 && finiteAll(r), "fat arch: finite, inner lines converge to the centre");
}
/* --- text handling --- */
ok(JSON.stringify(run({ ...p0, text: "ORIGIN" })) === JSON.stringify(run({ ...p0, text: "origin" })), "capitals fold to lowercase");
{
  const a = run({ ...p0, text: "oo", fit: false }), b = run({ ...p0, text: "o1o", fit: false });
  ok(a.paths.length === b.paths.length && bbox(b).w > bbox(a).w, "unknown characters draw nothing but keep an advance");
  const e = run({ ...p0, text: "" });
  ok(Array.isArray(e.paths) && e.paths.length === 0, "empty text: empty path set, no crash");
  ok(finiteAll(run({ ...p0, text: "äöå !?. 123" })), "odd characters do not crash");
  ok(finiteAll(run({ ...p0, text: null })), "null text tolerated");
}
/* --- layout --- */
{
  const pl = { ...p0, text: "on", fit: false, xh: 20 };
  const L = bbox(run({ ...pl, align: "Left" })), R = bbox(run({ ...pl, align: "Right" })), C = bbox(run({ ...pl, align: "Center" }));
  ok(Math.abs(L.x0 - p0.margin) < 0.05, "align Left: word starts at the margin");
  ok(Math.abs(R.x1 - (297 - p0.margin)) < 0.05, "align Right: word ends at the margin");
  ok(Math.abs((C.x0 + C.x1) / 2 - 297 / 2) < 0.05, "align Center: word centred");
  const big = run({ ...p0, text: "origin", xh: 400 });
  ok(inb(big, 297, 210, p0.margin) && big.paths.length > 0, "fit: oversized word shrinks into the margin box");
  const small = run({ ...p0, text: "o", xh: 10, fit: true }), smallNoFit = run({ ...p0, text: "o", xh: 10, fit: false });
  ok(Math.abs(bbox(small).w - bbox(smallNoFit).w) < 1e-9, "fit never grows a small word");
  const cyc = run({ ...p0, text: "abc", penCycle: true, layer: 3 });
  ok([...new Set(cyc.paths.map((q) => q.layer))].sort().join() === "3,4,5", "pen per letter cycles 3,4,5");
}

/* --- asymmetry: m's second arch grows, advance follows, None is the identity --- */
{
  const pm = { ...p0, text: "m", fit: false, xh: 40, width: 0.45, gap: 0.9 };
  const none = run(pm), grow = run({ ...pm, asym: "Grow", asymAmt: 0.4 });
  ok(JSON.stringify(none) === JSON.stringify(run({ ...pm, asym: "None", asymAmt: 0.9 })), "asymmetry None ignores the amount (identity)");
  const bn = bbox(none), bg = bbox(grow);
  ok(Math.abs(bg.w - bn.w - 0.4 * 40) < 1e-6, "Grow 0.4 on m: word widens by exactly amount x x-height (" + (bg.w - bn.w).toFixed(2) + ")");
  ok(Math.abs(bg.h - bn.h - 0.4 * 0.5 * 40) < 1e-6 || bg.h > bn.h, "Grow on m: the second arch stands taller than the first");
  ok(bg.y1 >= bn.y1 - 1e-6 && Math.abs(bg.y1 - bn.y1) < 1e-6, "Grow on m: both arches keep their feet on the baseline");
  const shrink = bbox(run({ ...pm, asym: "Shrink", asymAmt: 0.4 }));
  ok(shrink.w < bn.w, "Shrink on m: second arch smaller, word narrower");
  ok(JSON.stringify(run({ ...pm, asym: "Random", asymAmt: 0.5, seed: 1 })) !== JSON.stringify(run({ ...pm, asym: "Random", asymAmt: 0.5, seed: 2 })), "Random asymmetry: seed changes the letter");
  ok(JSON.stringify(run({ ...pm, seed: 1 })) === JSON.stringify(run({ ...pm, seed: 2 })), "seed has no effect unless asymmetry is Random");
  ok(inb(run({ ...p0, text: "mmm", asym: "Grow", asymAmt: 1, xh: 200 }), 297, 210, p0.margin), "fit accounts for the grown strokes (stays inside the margin box)");
  ok(run({ ...p0, text: "w", fit: false }).paths.length === 2 * run({ ...p0, text: "v", fit: false }).paths.length, "w is two v-strokes so asymmetry can act on it");
  /* chained strokes stay joined: s grows its top bowl, baseline and join intact */
  const ps = { ...p0, text: "s", fit: false, xh: 40, width: 0.3, gap: 0.8 };
  const sN = bbox(run(ps)), sG = bbox(run({ ...ps, asym: "Grow", asymAmt: 0.5 }));
  ok(Math.abs(sG.y1 - sN.y1) < 1e-6 && sG.y0 < sN.y0 - 1 && sG.x1 > sN.x1 + 1, "s Grow: bottom bowl unchanged, top bowl taller and wider, baseline kept");
  const G = def._glyphs(2, 0.6);
  ok(G.s.s.length === 2 && G.h.s.length === 2 && G.g.s[1][0][0] === "@", "s and h are two strokes, g pins its hook to the stem foot");
  /* g Grow: stem stays at the bowl's right edge, hook reaches further left and down */
  const pg = { ...p0, text: "g", fit: false, xh: 40, width: 0.3, gap: 0.8 };
  const gN = bbox(run(pg)), gG = bbox(run({ ...pg, asym: "Grow", asymAmt: 0.5 }));
  ok(Math.abs(gG.x1 - gN.x1) < 1e-6 && gG.y1 > gN.y1 + 1 && gG.x0 <= gN.x0 + 1e-6, "g Grow: right edge fixed, hook deeper, nothing detaches to the right");
}

/* --- every parameter must do something --- */
const bJ = JSON.stringify(r1);
const diff = (patch, label, base) => { const b = base ? JSON.stringify(run(base)) : bJ; ok(JSON.stringify(run({ ...(base || p0), ...patch })) !== b, "param live: " + label); };
diff({ text: "arc" }, "text"); diff({ xh: 20 }, "xh"); diff({ width: 0.3 }, "width"); diff({ gap: 1 }, "gap");
diff({ stretchX: 1.5 }, "stretchX"); diff({ stretchY: 1.5 }, "stretchY"); diff({ slant: 15 }, "slant");
diff({ asc: 1.5 }, "asc"); diff({ desc: 1.2 }, "desc"); diff({ facets: 2 }, "facets"); diff({ spacing: 0.5 }, "spacing");
diff({ asym: "Grow" }, "asym"); diff({ asymAmt: 0.8 }, "asymAmt", { ...p0, asym: "Grow" }); diff({ seed: 9 }, "seed", { ...p0, asym: "Random" });
diff({ align: "Left" }, "align"); diff({ baseline: 0.4 }, "baseline"); diff({ fit: false }, "fit", { ...p0, xh: 400 });
diff({ margin: 30 }, "margin", { ...p0, align: "Left" }); diff({ penCycle: true }, "penCycle"); diff({ layer: 5 }, "layer");

/* --- every select option renders --- */
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) {
  const r = run({ ...p0, [pd.key]: opt });
  ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
}
/* every glyph renders finite at every facet level */
{
  const alpha = "abcdefghijklmnopqrstuvwxyz";
  let all = true, allF = true;
  for (const f of [1, 2, 3, 4, 8]) { const r = run({ ...p0, text: alpha, xh: 12, facets: f, width: 0.9 }); if (!(r.paths.length > 100 && finiteAll(r))) all = false; if (npts(r) > 120000) allF = false; }
  ok(all && allF, "full alphabet renders finite at facets 1, 2, 3, 4, 8 with a fat ribbon");
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, text: "w", xh: 5, width: 0.05, gap: 4, stretchX: 0.3, stretchY: 0.3, asc: 1, desc: 0.1, facets: 1, spacing: -0.6, margin: 0 })), "degenerate params produce no NaN");
const ext = run({ ...p0, text: "abcdefghijklmnopqrstuvwxyz abcdefghijklm", xh: 200, width: 1.4, gap: 0.25, stretchY: 4, slant: 35, facets: 8, margin: 0 });
ok(finiteAll(ext) && npts(ext) <= 120000, "extreme params: finite + budget held (" + npts(ext) + " pts)");
const wild = run({ ...p0, xh: -50, width: 99, gap: 0, stretchX: 0, stretchY: -2, slant: 89, asc: 0, desc: -1, facets: 0, spacing: -99, baseline: 7, margin: -20, layer: 40 });
ok(finiteAll(wild) && npts(wild) <= 120000, "wired-out-of-range values: finite + budget held (" + npts(wild) + " pts)");
ok(finiteAll(run(p0, { W: 4, H: 4 })), "tiny canvas: finite");

/* --- showIf --- */
const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
ok(!vis(p0).includes("asymAmt") && vis({ ...p0, asym: "Grow" }).includes("asymAmt"), "showIf: asymmetry amount only with a mode");
ok(!vis({ ...p0, asym: "Grow" }).includes("seed") && vis({ ...p0, asym: "Random" }).includes("seed"), "showIf: seed only for Random asymmetry");
ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");

/* --- overlay --- */
{
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 3 && g1[0].kind === "rect" && g1[1].kind === "rect" && g1[2].kind === "arrow", "overlay: margin rect + word box + baseline arrow");
  const bb = bbox(r1);
  ok(Math.abs(g1[1].x - bb.x0) < 0.5 && Math.abs(g1[1].x + g1[1].w - bb.x1) < 0.5, "overlay word box matches the drawn extents");
  let threw = false;
  try { def.overlay({ ...p0, text: "" }, { W: 4, H: 4 }, undefined, undefined); def.overlay(undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
