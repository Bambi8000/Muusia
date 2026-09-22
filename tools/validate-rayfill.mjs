/* Validator for the Ray Fill node (key: rayfill).
   Run from the repo root: node tools/validate-rayfill.mjs
   First line tells you which source was tested: [lab] or [baked]. */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as H from "../src/defs/helpers.js";

const KEY = "rayfill";

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

/* ---------- fixture: a city-block sheet with rects, L-shapes, a ring with a hole, blobs, one open stroke ---------- */
function fixture(W = 297, H = 210, seed = 3, layer = 0) {
  const rng = H_mul(seed);
  const paths = [];
  const cols = 6, rows = 4, gx = 12, gy = 12, m = 14;
  const cw = (W - 2 * m - (cols - 1) * gx) / cols, ch = (H - 2 * m - (rows - 1) * gy) / rows;
  let id = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = m + c * (cw + gx), y = m + r * (ch + gy);
    const kind = id++ % 5;
    if (kind === 0) paths.push({ pts: [[x, y], [x + cw, y], [x + cw, y + ch], [x, y + ch]], closed: true, layer });
    else if (kind === 1) paths.push({ pts: [[x, y], [x + cw, y], [x + cw, y + ch * 0.45], [x + cw * 0.5, y + ch * 0.45], [x + cw * 0.5, y + ch], [x, y + ch]], closed: true, layer });
    else if (kind === 2) {
      paths.push({ pts: [[x, y], [x + cw, y], [x + cw, y + ch], [x, y + ch]], closed: true, layer });
      const hx = x + cw * 0.35, hy = y + ch * 0.35;
      paths.push({ pts: [[hx, hy], [hx + cw * 0.3, hy], [hx + cw * 0.3, hy + ch * 0.3], [hx, hy + ch * 0.3]], closed: true, layer, hole: true });
    } else if (kind === 3) {
      const pts = [];
      const n = 9, cx = x + cw / 2, cy = y + ch / 2;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const rr = 0.7 + rng() * 0.3; pts.push([cx + Math.cos(a) * cw * 0.5 * rr, cy + Math.sin(a) * ch * 0.5 * rr]); }
      paths.push({ pts, closed: true, layer });
    } else {
      paths.push({ pts: [[x, y + ch * 0.2], [x + cw * 0.6, y], [x + cw, y + ch * 0.6], [x + cw * 0.7, y + ch], [x + cw * 0.2, y + ch * 0.8]], closed: true, layer });
      paths.push({ pts: [[x, y + ch * 0.9], [x + cw * 0.15, y + ch]], closed: false, layer: 2 });
    }
  }
  return { paths };
}
function H_mul(seed) { return H.mulberry32(seed); }

const FIX = fixture();
const FIX_N = FIX.paths.length;
const CTX = { W: 297, H: 210 };
const defaults = () => { const p = {}; for (const pr of def.params) p[pr.key] = pr.def; return p; };
const run = (p, ctx, fix) => def.compute([fix || FIX], p, ctx || CTX, {});
const rays = (r) => r.paths.filter((q) => !q.closed && q.layer !== 2);
const npts = (r) => r.paths.reduce((a, q) => a + q.pts.length, 0);
const finiteAll = (r) => r.paths.every((q) => q.pts.every((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])));

/* ---------- geometry oracles ---------- */
const ringContains = (ring, x, y) => {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
};
const RINGS = FIX.paths.filter((q) => q.closed);
const insideUnion = (x, y) => { let c = 0; for (const r of RINGS) if (ringContains(r.pts, x, y)) c++; return c % 2 === 1; };
/* strict proper segment crossing (shared endpoints / touching excluded by shrinking the ray) */
const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
const segsCross = (A, B, C, D) => {
  const d1 = cross(C[0], C[1], D[0], D[1], A[0], A[1]), d2 = cross(C[0], C[1], D[0], D[1], B[0], B[1]);
  const d3 = cross(A[0], A[1], B[0], B[1], C[0], C[1]), d4 = cross(A[0], A[1], B[0], B[1], D[0], D[1]);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
};
const shrink = (A, B, e) => {
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
  return [[A[0] + (dx / L) * e, A[1] + (dy / L) * e], [B[0] - (dx / L) * e, B[1] - (dy / L) * e]];
};
const midpointsInside = (r) => rays(r).every((q) => { const [A, B] = q.pts; return insideUnion((A[0] + B[0]) / 2, (A[1] + B[1]) / 2); });
const noEdgeCrossing = (r) => {
  for (const q of rays(r)) {
    const [A, B] = shrink(q.pts[0], q.pts[1], 0.02);
    for (const ring of RINGS) {
      const P = ring.pts;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (segsCross(A, B, P[j], P[i])) return false;
    }
  }
  return true;
};
const holesEmpty = (r) => {
  const holes = RINGS.filter((q) => q.hole);
  const at = (q, t) => [q.pts[0][0] + (q.pts[1][0] - q.pts[0][0]) * t, q.pts[0][1] + (q.pts[1][1] - q.pts[0][1]) * t];
  return rays(r).every((q) => holes.every((h) => [0.25, 0.5, 0.75].every((t) => { const [x, y] = at(q, t); return !ringContains(h.pts, x, y); })));
};

/* mutation tests: the oracles must catch a deliberately bad result */
{
  const badMid = { paths: [{ pts: [[2, 2], [8, 8]], closed: false, layer: 11 }] }; /* entirely in the margin */
  const badX = { paths: [{ pts: [[5, 5], [60, 60]], closed: false, layer: 11 }] }; /* pierces block 0 outline */
  ok(!midpointsInside(badMid), "oracle mutation: midpoint test catches a ray outside every shape");
  ok(midpointsInside(badX) && !noEdgeCrossing(badX), "oracle mutation: crossing test catches a ray piercing an outline that the midpoint test misses");
  const hole = RINGS.find((q) => q.hole);
  const hx = (hole.pts[0][0] + hole.pts[2][0]) / 2, hy = (hole.pts[0][1] + hole.pts[2][1]) / 2;
  const badH = { paths: [{ pts: [[hx - 1, hy], [hx + 1, hy]], closed: false, layer: 11 }] };
  ok(!holesEmpty(badH), "oracle mutation: hole test catches a ray inside a hole");
  ok(!midpointsInside(badH), "oracle mutation: midpoint test also rejects the hole ray (even-odd)");
}

const p0 = defaults();

/* ---------- universal invariants ---------- */
const r1 = run(p0), r2 = run(p0);
ok(JSON.stringify(r1) === JSON.stringify(r2), "deterministic (double run byte-identical)");
ok(rays(r1).length > 500, "non-empty at defaults (" + r1.paths.length + " paths, " + npts(r1) + " pts)");
ok(finiteAll(r1), "all coordinates finite");
ok(r1.paths.every((q) => q.pts.length >= 2), "every path >= 2 points");
ok(r1.paths.every((q) => Number.isInteger(q.layer) && q.layer >= 0 && q.layer <= 11), "layers are integer pens 0..11");
ok(npts(r1) < 120000, "point budget at defaults");
const tol = 0.5;
const inb = (r, W, Hh) => r.paths.every((q) => q.pts.every(([x, y]) => x >= -tol && x <= W + tol && y >= -tol && y <= Hh + tol));
ok(inb(r1, 297, 210), "in bounds on A4 wide");
ok(inb(run(p0, { W: 210, H: 297 }, fixture(210, 297)), 210, 297), "in bounds on A4 tall");

/* ---------- geometry across every mode ---------- */
const MODES = {
  "Per shape/Mix": {},
  "Per shape/Centroid": { place: "Centroid" },
  "Per shape/Random inside": { place: "Random inside" },
  "Per shape/Edge": { place: "Edge" },
  "Per shape/Outside": { place: "Outside" },
  "Shared/Nearest": { centres: "Shared" },
  "Shared/All": { centres: "Shared", assign: "All centres", spacing: 3 },
  "Mix + jitter 1 + coreGap 3": { jitter: 1, coreGap: 3 },
};
for (const [label, patch] of Object.entries(MODES)) {
  const r = run({ ...p0, ...patch });
  ok(rays(r).length > 0 && finiteAll(r), label + ": draws finite rays (" + rays(r).length + ")");
  ok(rays(r).every((q) => q.pts.length === 2), label + ": every ray is a 2-point segment");
  ok(midpointsInside(r), label + ": every ray midpoint lies inside a shape (even-odd)");
  ok(noEdgeCrossing(r), label + ": no ray crosses a shape outline (segment-segment)");
  ok(holesEmpty(r), label + ": holes stay empty");
  ok(rays(r).every((q) => Math.hypot(q.pts[1][0] - q.pts[0][0], q.pts[1][1] - q.pts[0][1]) >= p0.minLen - 1e-9), label + ": every ray >= Min length");
}

/* every group filled: each outer ring (non-hole) contains at least one ray midpoint at defaults */
{
  const mids = rays(r1).map((q) => [(q.pts[0][0] + q.pts[1][0]) / 2, (q.pts[0][1] + q.pts[1][1]) / 2]);
  const outers = RINGS.filter((q) => !q.hole);
  ok(outers.every((o) => mids.some(([x, y]) => ringContains(o.pts, x, y))), "every closed shape receives rays at defaults (" + outers.length + " shapes)");
}

/* ---------- outlines / pens ---------- */
ok(r1.paths.filter((q) => q.closed).length === RINGS.length, "Keep outlines: every closed input passes through");
ok(run({ ...p0, outlines: false }).paths.filter((q) => q.closed).length === 0, "Keep outlines off: no closed paths in output");
ok(run({ ...p0, outlines: false }).paths.some((q) => q.layer === 2), "open input strokes always pass through");
ok(rays(r1).every((q) => q.layer === 11), "rays on Fill pen (11) by default");
{
  const r = def.compute([fixture(297, 210, 3, 4)], { ...p0, inherit: true }, CTX, {});
  ok(rays(r).length > 0 && rays(r).every((q) => q.layer === 4), "Inherit shape pens: rays take the shape's pen");
}
ok(rays(run({ ...p0, layer: 7 })).every((q) => q.layer === 7), "Fill pen param live");

/* ---------- fill fraction ---------- */
ok(rays(run({ ...p0, fillFrac: 0 })).length === 0 && run({ ...p0, fillFrac: 0 }).paths.length === FIX_N, "Fill fraction 0: outlines only");
{
  const half = rays(run({ ...p0, fillFrac: 0.5 })).length, full = rays(r1).length;
  ok(half > 0 && half < full, "Fill fraction 0.5: some but not all shapes filled (" + half + " / " + full + ")");
}

/* ---------- direction / core gap / spacing ---------- */
{
  const p = { ...p0, place: "Centroid", alternate: false, jitter: 0 };
  const r = run(p);
  const cs = def.overlay(p, CTX, [FIX], {}).filter((g) => g.kind === "point");
  const near = (x, y) => { let b = Infinity; for (const c of cs) b = Math.min(b, Math.hypot(c.x - x, c.y - y)); return b; };
  ok(cs.length === RINGS.filter((q) => !q.hole).length, "overlay: one centre point per shape in Per shape mode (" + cs.length + ")");
  ok(rays(r).every((q) => near(q.pts[0][0], q.pts[0][1]) < near(q.pts[1][0], q.pts[1][1])), "Alternate off: every ray drawn from the core outward");
  const rA = run({ ...p, alternate: true });
  ok(rays(rA).some((q) => near(q.pts[0][0], q.pts[0][1]) > near(q.pts[1][0], q.pts[1][1])), "Alternate on: some rays drawn inward (zigzag)");
  const rG = run({ ...p, coreGap: 6 });
  ok(rays(rG).length > 0 && rays(rG).every((q) => near(q.pts[0][0], q.pts[0][1]) >= 6 - 1e-6), "Core gap 6: no ray point closer than 6 mm to its centre");
  const rS = run({ ...p, spacing: 6 });
  ok(rays(rS).length < rays(r).length / 2, "Spacing 6 vs 2: far fewer rays (" + rays(rS).length + " vs " + rays(r).length + ")");
  const rM = run({ ...p, minLen: 5 });
  ok(rays(rM).length < rays(r).length && rays(rM).every((q) => Math.hypot(q.pts[1][0] - q.pts[0][0], q.pts[1][1] - q.pts[0][1]) >= 5 - 1e-9), "Min length 5: slivers dropped");
}

/* ---------- shared mode specifics ---------- */
{
  const p = { ...p0, centres: "Shared" };
  const g = def.overlay(p, CTX, [FIX], {});
  ok(g.filter((q) => q.kind === "point").length === 3 && g.some((q) => q.kind === "rect"), "overlay Shared: 3 centre points + margin rect");
  const pts = g.filter((q) => q.kind === "point");
  ok(pts.every((q) => q.x >= p.margin && q.x <= 297 - p.margin && q.y >= p.margin && q.y <= 210 - p.margin), "Shared: centres inside the margin box");
  const g8 = def.overlay({ ...p, nCentres: 8 }, CTX, [FIX], {}).filter((q) => q.kind === "point");
  ok(g8.length === 8, "Centres count 8: eight centres");
  let dmin = Infinity;
  for (let i = 0; i < g8.length; i++) for (let j = i + 1; j < g8.length; j++) dmin = Math.min(dmin, Math.hypot(g8[i].x - g8[j].x, g8[i].y - g8[j].y));
  ok(dmin > 15, "Shared: best-candidate spread keeps centres apart (min " + dmin.toFixed(1) + " mm)");
  const gm = def.overlay({ ...p, margin: 40 }, CTX, [FIX], {}).filter((q) => q.kind === "point");
  ok(gm.every((q) => q.x >= 40 && q.x <= 257 && q.y >= 40 && q.y <= 170), "Margin 40: centres respect the larger margin");
  const rNear = run(p), rAll = run({ ...p, assign: "All centres" });
  ok(rays(rAll).length > rays(rNear).length * 1.5, "All centres draws far more rays than Nearest (" + rays(rAll).length + " vs " + rays(rNear).length + ")");
}

/* ---------- liveness of every parameter (against the right base) ---------- */
const J = (r) => JSON.stringify(r);
const live = (base, patch, label) => ok(J(run({ ...base, ...patch })) !== J(run(base)), "param live: " + label);
live(p0, { centres: "Shared" }, "centres");
live(p0, { place: "Centroid" }, "place");
live({ ...p0, centres: "Shared" }, { nCentres: 6 }, "nCentres (Shared)");
live({ ...p0, centres: "Shared" }, { assign: "All centres" }, "assign (Shared)");
live({ ...p0, centres: "Shared" }, { margin: 40 }, "margin (Shared)");
live(p0, { spacing: 4 }, "spacing");
live(p0, { coreGap: 4 }, "coreGap");
live(p0, { minLen: 4 }, "minLen");
live(p0, { jitter: 0.6 }, "jitter");
live(p0, { fillFrac: 0.4 }, "fillFrac");
live(p0, { alternate: false }, "alternate");
live(p0, { outlines: false }, "outlines");
live({ ...p0 }, { inherit: true }, "inherit (fixture shapes on pen 0 vs fill pen 11)");
live(p0, { seed: 77 }, "seed");
live(p0, { layer: 3 }, "layer");

/* ---------- every select option renders ---------- */
for (const pd of def.params.filter((q) => q.type === "select")) {
  for (const opt of pd.options) {
    const base = pd.key === "assign" || pd.key === "nCentres" ? { ...p0, centres: "Shared" } : p0;
    const r = run({ ...base, [pd.key]: opt });
    ok(rays(r).length > 0 && finiteAll(r), pd.key + " '" + opt + "' draws finite rays (" + rays(r).length + ")");
  }
}

/* ---------- degenerate and extreme ---------- */
{
  let threw = false, rE;
  try { rE = def.compute([undefined], p0, CTX, {}); } catch (e) { threw = true; }
  ok(!threw && rE && rE.paths.length === 0, "no input: empty output, no throw");
  try { rE = def.compute([{ paths: [{ pts: [[1, 1], [2, 2]], closed: true, layer: 0 }, { pts: [[NaN, 1], [3, 3], [4, 1]], closed: true, layer: 0 }, { pts: [[5, 5], [5, 5], [5, 5]], closed: true, layer: 0 }] }], p0, CTX, {}); } catch (e) { threw = true; }
  ok(!threw && rays(rE).length === 0 && finiteAll({ paths: rays(rE) }), "degenerate rings (2-pt, NaN, zero-area): no throw, no rays, inputs pass through untouched");
  const ext = run({ ...p0, centres: "Shared", assign: "All centres", nCentres: 12, spacing: 0.5, minLen: 0, coreGap: 0, jitter: 1 });
  ok(finiteAll(ext) && npts(ext) <= 120000, "extreme (12 centres, All, spacing 0.5): finite + budget held (" + npts(ext) + " pts)");
  const tiny = run({ ...p0, spacing: 12, minLen: 5, coreGap: 20 });
  ok(finiteAll(tiny), "sparse extreme (spacing 12, gap 20): finite");
  ok(finiteAll(run(p0, { W: 20, H: 20 }, fixture(20, 20))) , "tiny canvas: finite");
}

/* ---------- showIf ---------- */
{
  const vis = (pp) => def.params.filter((q) => typeof q.showIf !== "function" || q.showIf(pp)).map((q) => q.key);
  ok(vis(p0).includes("place") && !vis(p0).includes("nCentres") && !vis(p0).includes("assign") && !vis(p0).includes("margin"), "showIf Per shape: place visible, shared params hidden");
  const vs = vis({ ...p0, centres: "Shared" });
  ok(!vs.includes("place") && vs.includes("nCentres") && vs.includes("assign") && vs.includes("margin"), "showIf Shared: shared params visible, place hidden");
  ok(def.params.filter((q) => typeof q.showIf === "function").every((q) => p0[q.key] !== undefined), "showIf: hidden params still carry defaults");
}

/* ---------- overlay robustness ---------- */
{
  let threw = false;
  try { def.overlay(p0, { W: 4, H: 4 }, undefined, undefined); def.overlay(p0, undefined, [undefined]); def.overlay({ ...p0, centres: "Shared" }, { W: 4, H: 4 }, undefined, undefined); } catch (e) { threw = true; }
  ok(!threw, "overlay never throws on degenerate / missing input");
  const g = def.overlay(p0, CTX, [FIX], {});
  ok(Array.isArray(g) && g.length > 0 && g.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)), "overlay returns finite guides (" + g.length + ")");
}

console.log(fails === 0 ? "ALL OK" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
