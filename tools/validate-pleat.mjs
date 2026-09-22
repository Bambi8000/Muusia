/* Validator for the Pleat node (key: pleat).
   Run from the repo root: node tools/validate-pleat.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "pleat";

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

const CTX = { W: 210, H: 297 };
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (p, ctx) => def.compute([undefined], p, ctx || CTX, {});
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));
const p0 = defaults();
const ribbon = (r, p) => r.paths.filter((q) => q.layer === Math.round((p || p0).layer));
const guides = (r, p) => r.paths.filter((q) => q.layer === Math.round((p || p0).guidePen));
const tokensOf = (script) => script.split(/\s+/).filter((t) => t.length > 0);
const PRESET_TOKENS = { Zigzag: 10, Accordion: 8, Twisted: 7, Fan: 5 };

/* ---------- universal ---------- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 0.01;
const inb = (r, W, Hh, mm) => r.paths.every((q) => q.pts.every(([x, y]) => x >= mm - tol && x <= W - mm + tol && y >= mm - tol && y <= Hh - mm + tol));
ok(inb(r1, 210, 297, 0), "in bounds on A4 tall");
ok(inb(run(p0, { W: 297, H: 210 }), 297, 210, 0), "in bounds on A4 wide");
ok(inb(run({ ...p0, margin: 25 }), 210, 297, 25), "Margin 25: everything inside the margin box");
ok(inb(run({ ...p0, orient: "Horizontal", margin: 15 }, { W: 297, H: 210 }), 297, 210, 15), "Horizontal + margin: in bounds");

/* ---------- structure: one polyline per line, one point per crease ---------- */
{
  const rb = ribbon(r1);
  ok(rb.length === p0.lines, "exactly Lines ribbon paths (" + rb.length + ")");
  ok(rb.every((q) => q.pts.length === PRESET_TOKENS.Zigzag), "every ribbon line has one point per crease (" + PRESET_TOKENS.Zigzag + ")");
  ok(rb.every((q) => !q.closed), "ribbon lines are open");
  for (const [name, K] of Object.entries(PRESET_TOKENS)) {
    const r = run({ ...p0, preset: name });
    ok(ribbon(r).length === p0.lines && ribbon(r).every((q) => q.pts.length === K), "preset " + name + ": " + K + " creases per line");
  }
  const rN = run({ ...p0, lines: 120 });
  ok(ribbon(rN).length === 120, "Lines 120 -> 120 ribbon paths");
}

/* ---------- token semantics (Custom, everything else neutral) ---------- */
const base = { ...p0, preset: "Custom", spVar: 0, guides: false, shade: 0, lines: 41, margin: 0, lenPct: 100 };
const custom = (script, extra) => run({ ...base, ...(extra || {}), script });
const creasePts = (r, k) => ribbon(r, base).map((q) => q.pts[k]); /* points of crease k across all lines */
const xs = (pts) => pts.map((q) => q[0]);
const mid = (arr) => arr[(arr.length - 1) / 2];
{
  /* straight: crease 1 of "- - -" is horizontal at the sheet middle, evenly spaced, Width wide */
  const r = custom("- - -");
  const c1 = creasePts(r, 1);
  ok(c1.every((q) => Math.abs(q[1] - 297 / 2) < 1e-9), "'-': straight crease lies on one axis line");
  const gaps = c1.slice(1).map((q, i) => q[0] - c1[i][0]);
  ok(gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9), "'=' / Shade 0: even spacing along the crease");
  ok(Math.abs(c1[c1.length - 1][0] - c1[0][0] - p0.width) < 1e-9, "crease spans Width mm (" + p0.width + ")");
  ok(Math.abs(mid(c1)[0] - 105) < 1e-9, "crease centred on the sheet axis");
  /* ^ v : apex moves the middle point by exactly Chevron mm toward start / end */
  const up = mid(creasePts(custom("- ^ -"), 1)), dn = mid(creasePts(custom("- v -"), 1));
  ok(Math.abs(up[1] - (297 / 2 - p0.chevron)) < 1e-9 && Math.abs(dn[1] - (297 / 2 + p0.chevron)) < 1e-9, "'^' / 'v': apex offset is exactly ±Chevron mm");
  const upEnds = creasePts(custom("- ^ -"), 1);
  ok(Math.abs(upEnds[0][1] - 297 / 2) < 1e-9 && Math.abs(upEnds[upEnds.length - 1][1] - 297 / 2) < 1e-9, "'^': crease ends stay on the axis line");
  /* < > : centre shifts by exactly Shift mm */
  const lft = mid(creasePts(custom("- < -"), 1)), rgt = mid(creasePts(custom("- > -"), 1));
  ok(Math.abs(lft[0] - (105 - p0.shift)) < 1e-9 && Math.abs(rgt[0] - (105 + p0.shift)) < 1e-9, "'<' / '>': centre shifted by exactly ∓/±Shift mm");
  /* ( ) : width divided / multiplied by Pinch */
  const nar = creasePts(custom("- ( -"), 1), wid = creasePts(custom("- ) -"), 1);
  const span = (pts) => pts[pts.length - 1][0] - pts[0][0];
  ok(Math.abs(span(nar) - p0.width / p0.pinch) < 1e-9 && Math.abs(span(wid) - p0.width * p0.pinch) < 1e-9, "'(' / ')': width ÷ / × Pinch");
  /* / \ : right end moves along the axis by tan(Tilt)·halfwidth, opposite signs */
  const sl = creasePts(custom("- / -"), 1), bs = creasePts(custom("- \\ -"), 1);
  const dz = Math.tan((p0.tilt * Math.PI) / 180) * (p0.width / 2);
  ok(Math.abs(sl[sl.length - 1][1] - (297 / 2 + dz)) < 1e-9 && Math.abs(bs[bs.length - 1][1] - (297 / 2 - dz)) < 1e-9, "'/' / '\\': crease ends tilt by ±tan(Tilt)·half-width");
  /* x : line order flips from that crease on */
  const rx = custom("- x -");
  const rb = ribbon(rx, base);
  const first = rb[0];
  ok(first.pts[0][0] < 105 && first.pts[1][0] > 105 && first.pts[2][0] > 105, "'x': line 0 starts left, crosses to the right at the twist and stays there");
  const rxx = ribbon(custom("- x x -"), base)[0];
  ok(rxx.pts[3][0] < 105, "'x x': second twist flips back");
  /* ~ : cylinder distribution -> edge gaps smaller than centre gap */
  const cy = creasePts(custom("- ~ -"), 1);
  const g0 = cy[1][0] - cy[0][0], gm = cy[21][0] - cy[20][0];
  ok(g0 < gm * 0.5, "'~': cylinder shading packs lines toward the edges (edge gap " + g0.toFixed(2) + " < centre gap " + gm.toFixed(2) + ")");
  const ev = creasePts(custom("- = -", { shade: 1 }), 1);
  const eg = ev.slice(1).map((q, i) => q[0] - ev[i][0]);
  ok(eg.every((g) => Math.abs(g - eg[0]) < 1e-9), "'=': forces even spacing even at Shade 1");
  /* combined token */
  const cmb = creasePts(custom("- ^<) -"), 1);
  ok(Math.abs(mid(cmb)[0] - (105 - p0.shift)) < 1e-9 && Math.abs(mid(cmb)[1] - (297 / 2 - p0.chevron)) < 1e-9 && Math.abs(span(cmb) - p0.width * p0.pinch) < 1e-9, "'^<)': characters combine within one token");
  /* unknown chars ignored; empty script -> 2 straight creases */
  ok(JSON.stringify(custom("- q7# -")) === JSON.stringify(custom("- - -")), "unknown characters are ignored silently");
  const emp = custom("");
  ok(ribbon(emp, base).every((q) => q.pts.length === 2), "empty script -> two creases");
  ok(ribbon(custom("-"), base).every((q) => q.pts.length === 2), "single token -> padded to two creases");
  ok(ribbon(custom("   -   ^   -  "), base).every((q) => q.pts.length === 3), "whitespace tolerated");
  const many = custom(Array(80).fill("-").join(" "));
  ok(ribbon(many, base).every((q) => q.pts.length === 60), "token count capped at 60");
  /* first and last crease sit exactly at the sheet ends at Length 100 */
  const ends = ribbon(custom("- - -"), base);
  ok(ends.every((q) => Math.abs(q.pts[0][1]) < 1e-9 && Math.abs(q.pts[2][1] - 297) < 1e-9), "Length 100: ribbon runs from edge to edge");
  const half = ribbon(custom("- - -", { lenPct: 50 }), base);
  ok(half.every((q) => Math.abs(q.pts[0][1] - 297 * 0.25) < 1e-9 && Math.abs(q.pts[2][1] - 297 * 0.75) < 1e-9), "Length 50: ribbon centred, half the sheet");
  /* horizontal orientation swaps axes */
  const hz = ribbon(custom("- ^ -", { orient: "Horizontal" }), base);
  ok(hz.every((q) => Math.abs(q.pts[0][0]) < 1e-9 && Math.abs(q.pts[2][0] - 210) < 1e-9) && Math.abs(mid(hz.map((q) => q.pts[1]))[0] - (105 - p0.chevron)) < 1e-9, "Horizontal: axis is X, chevron apex moves along X");
}

/* ---------- construction lines ---------- */
{
  const p = { ...base, guides: true, script: "- ^< v> -" };
  const r = run(p);
  const g = guides(r, p);
  ok(g.length === 4, "guides: two per inner crease, none for the edge creases at Length 100 (" + g.length + ")");
  const corners = [];
  for (const k of [1, 2]) { const c = creasePts(r, k); corners.push(c[0], c[c.length - 1]); }
  ok(g.every((q) => corners.some((c) => Math.hypot(c[0] - q.pts[0][0], c[1] - q.pts[0][1]) < 1e-9)), "every guide starts at a ribbon corner");
  const onEdge = (P) => Math.abs(P[0]) < 1e-6 || Math.abs(P[0] - 210) < 1e-6 || Math.abs(P[1]) < 1e-6 || Math.abs(P[1] - 297) < 1e-6;
  ok(g.every((q) => onEdge(q.pts[1])), "every guide ends on the margin box");
  /* guide is collinear with the crease half it extends */
  const col = g.every((q) => {
    const k = corners.findIndex((c) => Math.hypot(c[0] - q.pts[0][0], c[1] - q.pts[0][1]) < 1e-9);
    const crease = creasePts(r, 1 + Math.floor(k / 2));
    const apex = crease[(crease.length - 1) / 2];
    const A = q.pts[0], B = q.pts[1];
    const crossv = (B[0] - A[0]) * (apex[1] - A[1]) - (B[1] - A[1]) * (apex[0] - A[0]);
    return Math.abs(crossv) / Math.hypot(B[0] - A[0], B[1] - A[1]) < 1e-6;
  });
  ok(col, "chevron guides are collinear with their crease half");
  ok(guides(run({ ...p, guides: false }), p).length === 0, "Construction lines off: no guides");
  ok(guides(run({ ...p, guidePen: 9 }), { ...p, guidePen: 9 }).length === 4, "Guide pen 9");
  const gm = guides(run({ ...p, margin: 20 }), p);
  ok(gm.every((q) => [q.pts[1][0], q.pts[1][1]].some((v, i) => Math.abs(v - 20) < 1e-6 || Math.abs(v - (i === 0 ? 210 : 297) + 20) < 1e-6)), "guides stop at the margin box when Margin is set");
}

/* ---------- liveness ---------- */
const J = (r) => JSON.stringify(r);
const live = (b, patch, label) => ok(J(run({ ...b, ...patch })) !== J(run(b)), "param live: " + label);
live(p0, { preset: "Fan" }, "preset");
live({ ...p0, preset: "Custom" }, { script: "- x -" }, "script (Custom)");
live(p0, { orient: "Horizontal" }, "orient");
live(p0, { lines: 30 }, "lines");
live(p0, { width: 50 }, "width");
live(p0, { lenPct: 60 }, "lenPct");
live(p0, { spVar: 1 }, "spVar");
ok(J(run({ ...p0, tilt: 30 })) === J(run(p0)), "tilt is inert on Zigzag (no tilt token) -- by design");
live({ ...p0, preset: "Accordion" }, { tilt: 30 }, "tilt (Accordion)");
live(p0, { chevron: 20 }, "chevron");
live(p0, { shift: 30 }, "shift");
live(p0, { pinch: 2.5 }, "pinch");
live(p0, { shade: 0 }, "shade");
live(p0, { guides: false }, "guides");
live(p0, { guidePen: 3 }, "guidePen");
live(p0, { margin: 20 }, "margin");
live(p0, { seed: 77 }, "seed (spVar > 0)");
live(p0, { layer: 5 }, "layer");

/* ---------- selects ---------- */
for (const pd of def.params.filter((q) => q.type === "select")) for (const opt of pd.options) {
  const r = run({ ...p0, [pd.key]: opt });
  ok(r.paths.length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite paths (" + r.paths.length + ")");
}

/* ---------- degenerate / extreme ---------- */
{
  const ext = run({ ...p0, preset: "Custom", script: Array(60).fill("^<)x~").join(" "), lines: 200, width: 200, chevron: 30, shift: 60, pinch: 3 });
  ok(finiteAll(ext) && npts(ext) <= 120000 && inb(ext, 210, 297, 0), "extreme (60 max-tokens, 200 lines, everything max): finite, budget, in bounds (" + npts(ext) + " pts)");
  ok(finiteAll(run({ ...p0, preset: "Custom", script: null })), "null script: no throw");
  ok(finiteAll(run({ ...p0, lines: 2, width: 1 })), "Lines 2 / Width 1: finite");
  ok(finiteAll(run(p0, { W: 30, H: 30 })), "tiny canvas: finite");
  ok(finiteAll(run({ ...p0, margin: 60 }, { W: 100, H: 100 })), "margin larger than half the sheet: clamped, finite");
}

/* ---------- showIf ---------- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(!vis(p0).includes("script") && vis({ ...p0, preset: "Custom" }).includes("script"), "showIf: Folds field only in Custom");
  ok(vis(p0).includes("guidePen") && !vis({ ...p0, guides: false }).includes("guidePen"), "showIf: Guide pen follows Construction lines");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
}

/* ---------- overlay ---------- */
{
  const g = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g) && g.some((q) => q.kind === "rect") && g.filter((q) => q.kind === "point").length === PRESET_TOKENS.Zigzag, "overlay: margin rect + one point per crease");
  const pts = g.filter((q) => q.kind === "point");
  const rb = ribbon(r1);
  ok(pts.every((q, k) => Math.abs(q.x - (rb[0].pts[k][0] + rb[rb.length - 1].pts[k][0]) / 2) < 1e-6) && pts.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), "overlay points sit on each crease centre (x = midpoint of the crease ends)");
  let threw = false;
  try { def.overlay(p0, { W: 4, H: 4 }, undefined, undefined); def.overlay({ ...p0, preset: "Custom", script: undefined }, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
