// validate-roundcanvas.mjs — harness per MUUSIA-NODE-API §9
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
const src = fs.readFileSync(new URL("../nodes-lab/roundcanvas.plotternode.js", import.meta.url), "utf8");
const N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));

const CTX = { W: 210, H: 297 };
// test scene: grid of horizontal+vertical lines covering the sheet + one closed small square near center
const scene = { paths: [] };
for (let y = 10; y < 290; y += 8) scene.paths.push({ pts: [[5, y], [205, y]], closed: false, layer: 1 });
for (let x = 10; x < 205; x += 8) scene.paths.push({ pts: [[x, 5], [x, 292]], closed: false, layer: 2 });
scene.paths.push({ pts: [[100, 143], [110, 143], [110, 153], [100, 153]], closed: true, layer: 3 });

const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, s = scene) => N.compute([s], { ...defs(), ...over }, CTX, {});
const J = (r) => JSON.stringify(r);
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails++; };

ok(J(run()) === J(run()), "determinism");
ok(J(run({ seed: 1, distort: 0.5 })) !== J(run({ seed: 2, distort: 0.5 })), "seed liveness");
ok(N.compute([undefined], defs(), CTX, {}).paths.length <= 1, "unwired input safe (edge only)");

// rim geometry: with distort 0 the edge is a circle of radius R around center+offset
const edgeOf = (r) => r.paths[r.paths.length - 1];
const e0 = edgeOf(run({ distort: 0, radius: 80, ox: 10, oy: -20 }));
let rMin = 1e9, rMax = 0;
for (const [x, y] of e0.pts) { const d = Math.hypot(x - 115, y - 128.5); rMin = Math.min(rMin, d); rMax = Math.max(rMax, d); }
ok(e0.closed && Math.abs(rMin - 80) < 0.1 && Math.abs(rMax - 80) < 0.1, `distort=0 → exact circle at offset (r ${rMin.toFixed(2)}–${rMax.toFixed(2)})`);

// distorted rim varies
const e1 = edgeOf(run({ distort: 0.8, radius: 80 }));
let dMin = 1e9, dMax = 0;
for (const [x, y] of e1.pts) { const d = Math.hypot(x - 105, y - 148.5); dMin = Math.min(dMin, d); dMax = Math.max(dMax, d); }
ok(dMax - dMin > 10, `distort deforms rim (r range ${(dMax - dMin).toFixed(1)} mm)`);

// crop correctness: every clipped content point is inside the rim (radius test via same node's edge)
const rc = run({ distort: 0.6, radius: 70, gap: 0, edge: false });
const rimPts = edgeOf(run({ distort: 0.6, radius: 70, edge: true })).pts;
const ringContains = (ring, x, y) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
const distToRing = (ring, x, y) => { let best = 1e18; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; const dx = xj - xi, dy = yj - yi; const L2 = dx * dx + dy * dy; let t = L2 > 0 ? ((x - xi) * dx + (y - yi) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(xi + dx * t - x, yi + dy * t - y); if (d < best) best = d; } return best; };
let allIn = true;
for (const pp of rc.paths) for (const [x, y] of pp.pts)
  if (!ringContains(rimPts, x, y) && distToRing(rimPts, x, y) > 0.8) allIn = false;
ok(allIn && rc.paths.length > 20, `content clipped inside rim (${rc.paths.length} paths)`);

// invert keeps outside
const ri = run({ invert: true, radius: 70, edge: false, distort: 0.6 });
let allOut = true;
for (const pp of ri.paths) for (const [x, y] of pp.pts)
  if (ringContains(rimPts, x, y) && distToRing(rimPts, x, y) > 0.8) allOut = false;
ok(allOut && ri.paths.length > 20, "invert keeps outside");

// gap: min distance from clipped content to rim >= gap - tol
const rg = run({ gap: 6, radius: 70, distort: 0.4, edge: false });
const rim2 = edgeOf(run({ gap: 6, radius: 70, distort: 0.4, edge: true })).pts;
let minGap = 1e9;
for (const pp of rg.paths) for (const [x, y] of pp.pts) minGap = Math.min(minGap, distToRing(rim2, x, y));
ok(minGap >= 5.2, `edge gap honored (min ${minGap.toFixed(1)} ≥ 5.2 of 6)`);

// fully-inside closed path stays closed
ok(run({ radius: 90 }).paths.some((pp) => pp.closed && pp.pts.length === 4), "inner closed path stays closed");

// edge toggle & pen
ok(run({ edge: false }).paths.every((pp) => !(pp.closed && pp.pts.length === 360)), "edge removable");
ok(edgeOf(run({ layer: 7 })).layer === 7, "edge pen");

for (const [k, v] of [["radius", 50], ["distort", 0.9], ["lobes", 8], ["ox", 30], ["oy", -30], ["gap", 5], ["invert", true], ["edge", false], ["layer", 4]])
  ok(J(run({ [k]: v, distort: k === "lobes" ? 0.5 : (k === "distort" ? v : 0.3) })) !== J(run({ distort: k === "lobes" ? 0.5 : 0.3 })), `${k} liveness`);

ok(run().paths.every((pp) => pp.pts.length >= 2 && typeof pp.closed === "boolean"), "path-set shape");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
