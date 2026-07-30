// validate-patternfill.mjs — harness per MUUSIA-NODE-API §9, real helper impls
import fs from "fs";

const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, y, seed) { let h = seed + x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise2(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; }
function pathLength(pts, closed) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return L; }
const resample = (p) => p, applyStyle = (ps) => ps, signedArea = () => 0;

const H = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea };
const src = fs.readFileSync(new URL("../nodes-lab/patternfill.plotternode.js", import.meta.url), "utf8");
const N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));

// test scene: square with a circular hole, a separate triangle, an open zigzag
const circle = (cx, cy, r, n = 48) => Array.from({ length: n }, (_, k) => [cx + Math.cos((k / n) * 2 * Math.PI) * r, cy + Math.sin((k / n) * 2 * Math.PI) * r]);
const SQ = { pts: [[40, 40], [170, 40], [170, 170], [40, 170]], closed: true, layer: 2 };
const HOLE = { pts: circle(105, 105, 25), closed: true, layer: 2 };
const TRI = { pts: [[30, 200], [180, 210], [100, 280]], closed: true, layer: 7 };
const OPENP = { pts: [[10, 10], [30, 25], [10, 40], [30, 55]], closed: false, layer: 4 };
const SCENE = { paths: [SQ, HOLE, TRI, OPENP] };

const CTX = { W: 210, H: 297 };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, scene = SCENE) => N.compute([scene], { ...defs(), ...over }, CTX, {});
const J = (r) => JSON.stringify(r);
const nPts = (r) => r.paths.reduce((s, p) => s + p.pts.length, 0);
const ringContains = (ring, x, y) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
const distToRing = (ring, x, y) => { let best = 1e18; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; const dx = xj - xi, dy = yj - yi; const L2 = dx * dx + dy * dy; let t = L2 > 0 ? ((x - xi) * dx + (y - yi) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(xi + dx * t - x, yi + dy * t - y); if (d < best) best = d; } return best; };
// fill paths = anything not identical to an input path
const fillsOf = (r) => r.paths.filter((pp) => ![SQ, HOLE, TRI, OPENP].some((s) => J(s.pts) === J(pp.pts)));

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails++; };

// 1) determinism
ok(J(run()) === J(run()), "determinism");
ok(J(run()) !== J(run({ seed: 12 })), "seed liveness");

// 2) unwired input → EMPTY-ish, no crash
ok(N.compute([undefined], defs(), CTX, {}).paths.length === 0, "unwired input safe");

// 3) passthrough: open path always kept; outlines toggle
ok(run().paths.some((pp) => J(pp.pts) === J(OPENP.pts)), "open path passes through");
ok(run().paths.some((pp) => J(pp.pts) === J(SQ.pts)), "outlines kept by default");
ok(!run({ outlines: false }).paths.some((pp) => J(pp.pts) === J(SQ.pts)), "outlines removable");
ok(run({ outlines: false }).paths.some((pp) => J(pp.pts) === J(OPENP.pts)), "open path survives outlines=false");

// 4) containment: every fill point inside square-minus-hole or triangle, never in the hole
for (const pat of ["Hatch", "Cross-hatch", "Scribble", "Stipple", "Circles", "Chevron", "Dashes", "Crosses", "Sprinkles"]) {
  const fills = fillsOf(run({ pattern: pat, inset: 1.5, hand: 0.3 }));
  let inside = true, inHole = false, minD = 1e9, finite = true;
  for (const pp of fills) for (const [x, y] of pp.pts) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
    const inSq = ringContains(SQ.pts, x, y), inTri = ringContains(TRI.pts, x, y), inHo = ringContains(HOLE.pts, x, y);
    if (inHo) inHole = true;
    if (!inSq && !inTri) inside = false;
    const d = Math.min(distToRing(SQ.pts, x, y), distToRing(HOLE.pts, x, y), distToRing(TRI.pts, x, y));
    if (d < minD) minD = d;
  }
  ok(finite && inside && !inHole && fills.length > 3, `${pat}: fills stay in shapes, hole empty (${fills.length} paths)`);
  ok(minD >= 0.9, `${pat}: inset respected (min edge dist ${minD.toFixed(2)} ≥ 0.9 of 1.5)`);
}

// 5) patterns distinct + Mix per-shape variety
const sigs = ["Hatch", "Stipple", "Circles", "Chevron", "Dashes", "Crosses", "Sprinkles", "Scribble"].map((pat) => J(run({ pattern: pat })));
ok(new Set(sigs).size === sigs.length, "patterns render distinctly");
ok(J(run({ pattern: "Mix" })) !== J(run({ pattern: "Hatch" })), "Mix differs from single pattern");

// 6) gradient: dark side (against light angle) gets more ink than light side
const rg = run({ pattern: "Hatch", grad: 0.9, gdir: 0, vary: 0 }); // light from +x → dark left
const ink = (r, half) => fillsOf(r).reduce((s, pp) => {
  const cx = pp.pts.reduce((a, q) => a + q[0], 0) / pp.pts.length;
  const inSq = cx >= 40 && cx <= 170 && pp.pts[0][1] < 180;
  if (!inSq) return s;
  return s + ((half === "L" ? cx < 105 : cx >= 105) ? pathLength(pp.pts, pp.closed) : 0);
}, 0);
ok(ink(rg, "L") > ink(rg, "R") * 1.5, `gradient shades toward dark side (${ink(rg, "L").toFixed(0)} > ${ink(rg, "R").toFixed(0)} mm)`);

// 7) pens: spread and inherit
const rp = run({ pens: 5, layer: 3, outlines: false });
const lay = new Set(fillsOf(rp).map((pp) => pp.layer));
ok(lay.size > 1 && [...lay].every((l) => Number.isInteger(l) && l >= 0 && l < 12), `pens spread (${[...lay].sort((a, b) => a - b).join(",")})`);
const ri = run({ inherit: true, outlines: false, pattern: "Hatch", vary: 0 });
const triFillLayers = new Set(fillsOf(ri).filter((pp) => pp.pts[0][1] > 185).map((pp) => pp.layer));
ok(triFillLayers.size === 1 && triFillLayers.has(7), `inherit uses shape pen (${[...triFillLayers].join(",")})`);

// 8) budget at dense spacing on a full-canvas square
const BIG = { paths: [{ pts: [[5, 5], [205, 5], [205, 292], [5, 292]], closed: true, layer: 0 }] };
const rb = run({ pattern: "Cross-hatch", spacing: 0.6, inset: 0 }, BIG);
ok(nPts(rb) <= 120000, `budget dense cross-hatch (${nPts(rb)} pts)`);

// 9) param liveness
for (const [k, v] of [["spacing", 5], ["angle", 100], ["inset", 4], ["hand", 0.9], ["grad", 0.7], ["vary", 1], ["pens", 6], ["layer", 9]])
  ok(J(run({ [k]: v })) !== J(run()), `${k} liveness`);
ok(J(run({ grad: 0.5, gdir: 90 })) !== J(run({ grad: 0.5, gdir: 270 })), "gdir liveness (with gradient active)");


// 11) negative offset: fill bleeds outside the shape but never past |offset|+tol; hole gets invaded near its rim
const rn = run({ pattern: "Hatch", inset: -3, vary: 0, hand: 0, grad: 0, outlines: false });
let outside = 0, tooFar = false, inHoleNear = 0, inHoleDeep = false;
for (const pp of fillsOf(rn)) for (const [x, y] of pp.pts) {
  if (y > 185) continue; // only judge the square+hole group
  const inSq = ringContains(SQ.pts, x, y), inHo = ringContains(HOLE.pts, x, y);
  const d = Math.min(distToRing(SQ.pts, x, y), distToRing(HOLE.pts, x, y));
  if (!inSq) { outside++; if (d > 3.4) tooFar = true; }
  if (inHo) { inHoleNear++; if (d > 3.4) inHoleDeep = true; }
}
ok(outside > 20 && !tooFar, `negative offset bleeds outward, bounded (${outside} pts outside, none past 3.4mm)`);
ok(inHoleNear > 5 && !inHoleDeep, `negative offset invades hole rim only (${inHoleNear} pts)`);
ok(J(run({ inset: -3 })) !== J(run({ inset: 3 })), "inset sign liveness");
// 10) shape sanity
ok(run().paths.every((pp) => pp.pts.length >= 2 && typeof pp.closed === "boolean" && Number.isInteger(Math.round(pp.layer))), "path-set shape");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
