/* Validator for the Snowflake node. Run from the repo root: node tools/validate-snowflake.mjs
   First line tells you which source was tested — read it. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "snowflake";

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
const STYLES = def.params.find((q) => q.key === "style").options;
const symErr = (r, arms) => {
  /* rotate every point by 360/arms about the flake centre and see if it lands on another point */
  const pts = r.paths.flatMap((q) => q.pts);
  let cx = 0, cy = 0; for (const [x, y] of pts) { cx += x; cy += y; } cx /= pts.length; cy /= pts.length;
  const key = (x, y) => Math.round(x * 20) + "," + Math.round(y * 20);
  const set = new Set(pts.map(([x, y]) => key(x, y)));
  const a = Math.PI * 2 / arms, c = Math.cos(a), s = Math.sin(a);
  let miss = 0;
  for (const [x, y] of pts) { const dx = x - cx, dy = y - cy; if (!set.has(key(cx + dx * c - dy * s, cy + dx * s + dy * c))) miss++; }
  return miss / pts.length;
};

/* --- definition shape --- */
ok(def.cat === "gen" && def.group === "nature", "definition: gen/nature");
ok(typeof def.desc === "string" && def.desc.length > 200, "definition: desc present");
ok(Array.isArray(def.ins) && def.ins.length === 1 && def.ins[0].type === "style", "pins: Style input");
ok(Array.isArray(def.outs) && def.outs.length === 1 && def.outs[0].type === "paths", "pins: one paths output");
ok(def.params.every((q) => /^[a-z][a-z0-9]*$/i.test(q.key)) && new Set(def.params.map((q) => q.key)).size === def.params.length, "params: unique keys");
ok(def.params.some((q) => q.type === "seed") && def.params.some((q) => q.type === "pen"), "params: seed and pen present");
ok(STYLES.length === 5, "five styles (" + STYLES.join(", ") + ")");

/* --- universal invariants at defaults --- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(r1.paths.length > 0, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
ok(inb(r1, 297, 210, p0.margin, 1.0), "in bounds inside margin on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }), 210, 297, p0.margin, 1.0), "in bounds inside margin on A4 tall");

/* --- every style renders and is symmetric --- */
const one = { ...p0, count: 1, rows: 1, spin: 0, vary: 0, jitter: 0, wobble: 0 };
for (const st of STYLES) {
  const r = run({ ...one, style: st });
  const bb = bbox(r);
  ok(r.paths.length > 0 && finiteAll(r) && inb(r, 297, 210, p0.margin, 1.0), "style '" + st + "' draws finite paths in bounds (" + r.paths.length + " paths, " + npts(r) + " pts)");
  ok(Math.abs(bb.w - bb.h) < Math.max(bb.w, bb.h) * 0.16 && bb.h > 50, "style '" + st + "' is roughly round at the requested size (" + bb.w.toFixed(0) + " x " + bb.h.toFixed(0) + ")");
  const e = symErr(r, 6);
  ok(e < 0.03, "style '" + st + "' has exact 6-fold symmetry (" + (e * 100).toFixed(1) + "% points without a rotated twin)");
}
for (const arms of def.params.find((q) => q.key === "arms").options) {
  const n = Number(arms);
  const r = run({ ...one, style: "Dendrite", arms });
  const e = symErr(r, n);
  ok(r.paths.length > 0 && e < 0.03, "arms " + arms + ": renders with " + arms + "-fold symmetry (" + (e * 100).toFixed(1) + "%)");
}
{
  const r = run({ ...one, style: "Paper" });
  ok(r.paths.length >= 1 && r.paths[0].closed && r.paths[0].pts.length > 30, "Paper: silhouette is one closed path (" + r.paths[0].pts.length + " pts)");
  ok(r.paths.every((q) => q.closed), "Paper: every path is closed (silhouette, holes, pin hole)");
  const h0 = run({ ...one, style: "Paper", holes: 0 }), h4 = run({ ...one, style: "Paper", holes: 4 });
  ok(h4.paths.length > h0.paths.length, "Paper: Holes adds cut-outs (" + h0.paths.length + " -> " + h4.paths.length + ")");
  const w0 = run({ ...one, style: "Paper", wobble: 0 }), w100 = run({ ...one, style: "Paper", wobble: 100 });
  ok(npts(w100) > npts(w0) && Math.abs(bbox(w100).h - bbox(w0).h) < bbox(w0).h * 0.1, "Paper: wobble densifies without changing the size");
}
{
  const r0 = run({ ...one, style: "Dendrite", width: 0 }), r1w = run({ ...one, style: "Dendrite", width: 1.5 });
  ok(r0.paths.filter((q) => !q.closed).length > 50 && r1w.paths.filter((q) => q.closed).length > r0.paths.filter((q) => q.closed).length + 50, "Width turns branch centre lines into closed rods");
  const rr = run({ ...one, style: "Dendrite", rime: true });
  ok(rr.paths.length > r0.paths.length, "Rime adds dots (" + r0.paths.length + " -> " + rr.paths.length + ")");
  const f = run({ ...one, style: "Fern" }), d = run({ ...one, style: "Dendrite" }), s = run({ ...one, style: "Stellar" });
  ok(npts(f) > npts(d) && npts(d) > npts(s) * 0.7, "Fern is denser than Dendrite (" + npts(f) + " > " + npts(d) + "), Stellar is sparse (" + npts(s) + ")");
  const b0 = run({ ...one, branches: 0, depth: 1, tip: "Needle", core: 0 });
  ok(b0.paths.length === 6 && b0.paths.every((q) => q.pts.length === 2), "Branches 0 + Needle + no core is six bare needles (" + b0.paths.length + ")");
}

/* --- every parameter must do something --- */
const J = (p) => JSON.stringify(run(p));
const baseJ = J(p0);
const diff = (patch, label, base) => ok(J({ ...(base || p0), ...patch }) !== (base ? J(base) : baseJ), "param live: " + label);
diff({ style: "Fern" }, "style");
diff({ arms: "8" }, "arms");
diff({ branches: 2 }, "branches");
diff({ depth: 3 }, "depth");
diff({ angle: 45 }, "angle");
diff({ falloff: 1 }, "falloff");
diff({ core: 0.3 }, "core");
diff({ tip: "Fan" }, "tip");
diff({ width: 1 }, "width");
diff({ rime: true }, "rime");
const pP = { ...p0, style: "Paper" };
diff({ holes: 0 }, "holes (Paper)", pP);
diff({ wobble: 0 }, "wobble (Paper)", pP);
diff({ layout: "Scatter" }, "layout");
diff({ count: 5 }, "count");
diff({ rows: 3 }, "rows");
diff({ size: 30 }, "size");
diff({ vary: 0.9 }, "vary");
diff({ spin: 60 }, "spin");
diff({ jitter: 90 }, "jitter (Rows)");
diff({ margin: 30 }, "margin (grid cells move)");
diff({ seed: 99 }, "seed");
diff({ layer: 3 }, "layer");
ok(run({ ...p0, layer: 3 }).paths.every((q) => q.layer === 3), "layer applies to every path");

/* --- placement --- */
{
  const small = bbox(run({ ...one, size: 20 }));
  ok(small.h <= 20 * 1.03 && small.h > 15, "shrink only: size 20 stays about 20 mm on a full sheet (" + small.h.toFixed(1) + ")");
  const big = run({ ...p0, size: 250, count: 5, rows: 3, spin: 30 });
  ok(inb(big, 297, 210, p0.margin, 1.0), "shrink only: size 250 in a 5x3 grid is fitted into the cells");
  const cw = (297 - 20) / 5, ch = (210 - 20) / 3;
  const cells = new Set(); for (const q of big.paths) for (const pt of q.pts) cells.add(Math.floor((pt[0] - 10) / cw) + "," + Math.floor((pt[1] - 10) / ch));
  ok(cells.size === 15, "5x3 grid: every cell has a flake and nothing leaks between cells (" + cells.size + ")");
  const sc = run({ ...p0, layout: "Scatter", count: 30, size: 60, vary: 0.7 });
  ok(inb(sc, 297, 210, p0.margin, 1.0) && inb(run({ ...p0, layout: "Scatter", count: 30, size: 60 }, { W: 210, H: 297 }), 210, 297, p0.margin, 1.0), "Scatter: 30 flakes in bounds on both orientations");
  const dense = run({ ...p0, layout: "Scatter", count: 60, size: 250 });
  ok(finiteAll(dense) && inb(dense, 297, 210, p0.margin, 1.0), "Scatter: 60 huge flakes still fitted and in bounds");
  const a = run({ ...p0, count: 2, rows: 1, spin: 0, vary: 0, jitter: 0 });
  ok(a.paths.length > 0, "two flakes side by side render (" + a.paths.length + " paths)");
}

/* --- degenerate and extreme values --- */
ok(finiteAll(run({ ...p0, count: 0, rows: 0, size: 0, branches: 0, core: 0, margin: 0, width: 0 })), "degenerate params produce no NaN");
ok(finiteAll(run({ ...p0, count: -5, rows: -2, size: -10, branches: -3, depth: 9, angle: 500, falloff: -1, core: 3, width: -2, margin: -5, arms: "99" })), "out-of-range wired values produce no NaN");
ok(finiteAll(run({ ...p0, margin: 200 })), "margin larger than the sheet does not throw");
ok(finiteAll(run(p0, { W: 30, H: 20 })), "tiny sheet does not throw");
for (const st of STYLES) {
  const ext = run({ ...p0, style: st, count: 60, rows: 12, branches: 12, depth: 3, width: 3, rime: true, holes: 4, size: 250 });
  ok(finiteAll(ext) && npts(ext) <= 120000 && ext.paths.length > 0, "extreme " + st + " 60x12 full branching: finite, budget held (" + npts(ext) + " pts)");
}

/* --- showIf --- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
  const vP = vis({ ...p0, style: "Paper" }), vD = vis({ ...p0, style: "Dendrite" }), vPl = vis({ ...p0, style: "Plate" });
  ok(vP.includes("holes") && vP.includes("wobble") && !vP.includes("branches") && !vP.includes("tip") && !vP.includes("width"), "showIf: Paper shows Holes/Wobble, hides growth params");
  ok(vD.includes("branches") && vD.includes("depth") && vD.includes("tip") && !vD.includes("holes") && !vD.includes("wobble"), "showIf: Dendrite shows growth params, hides Paper params");
  ok(!vPl.includes("depth") && !vPl.includes("tip") && vPl.includes("branches"), "showIf: Plate hides Depth and Tip");
  ok(!vis({ ...p0, layout: "Scatter" }).includes("rows") && !vis({ ...p0, layout: "Scatter" }).includes("jitter") && vis({ ...p0, layout: "Rows" }).includes("rows"), "showIf: Scatter hides Rows and Jitter");
}

/* --- overlay --- */
if (def.overlay) {
  const g1 = def.overlay(p0, CTX, undefined, {});
  ok(Array.isArray(g1) && g1.length === 1 + p0.count * p0.rows, "overlay: margin rect + one cell per flake (" + g1.length + ")");
  const gS = def.overlay({ ...p0, layout: "Scatter" }, CTX, undefined, {});
  ok(gS.length === 1, "overlay Scatter: margin rect only");
  let threw = false;
  try { def.overlay({ ...p0 }, { W: 4, H: 4 }, undefined, undefined); def.overlay({}, {}, null, null); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate input");
} else ok(false, "overlay missing (node places a spatial region)");

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
