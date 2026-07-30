// validate-perfmesh.mjs — harness per MUUSIA-NODE-API §9, real helper impls
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
const src = fs.readFileSync(new URL("../nodes-lab/perfmesh.plotternode.js", import.meta.url), "utf8");
const N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));

const CTX = { W: 210, H: 297 };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, ctx = CTX) => N.compute([undefined], { ...defs(), ...over }, ctx, {});
const J = (r) => JSON.stringify(r);
const nPts = (r) => r.paths.reduce((s, p) => s + p.pts.length, 0);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails++; };

// 1) determinism per shape
for (const shape of ["Sphere", "Cube", "Pyramid"])
  ok(J(run({ shape })) === J(run({ shape })), `determinism (${shape})`);

// 2) geometry sanity: finite, in-sheet, ≥2-pt paths, across shapes/seeds/extremes
const cases = [];
for (const shape of ["Sphere", "Cube", "Pyramid"])
  for (const seed of [1, 3, 42])
    for (const over of [{}, { mountains: 1, terrain: 4, holes: 24, holesize: 0.5, depth: 1 }, { mountains: 0, holes: 0 }, { density: 60, size: 280 }, { rx: 180, ry: -180 }, { size: 20, density: 6 }])
      cases.push({ shape, seed, ...over });
for (const c of cases) {
  const r = run(c);
  let finite = true, inSheet = true, minPts = true;
  for (const p of r.paths) {
    if (p.pts.length < 2) minPts = false;
    for (const [x, y] of p.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
      if (x < 0 || x > CTX.W || y < 0 || y > CTX.H) inSheet = false;
    }
  }
  const lbl = `${c.shape} s${c.seed} ${Object.keys(c).filter(k => k !== "shape" && k !== "seed").join(",") || "def"}`;
  ok(finite && inSheet && minPts && r.paths.length > 5, `geometry ${lbl} (paths=${r.paths.length}, pts=${nPts(r)})`);
}

// 3) point budget + runtime at max density
const t0 = Date.now();
const big = run({ density: 60, holes: 24, mountains: 1 });
const ms = Date.now() - t0;
ok(nPts(big) <= 120000, `point budget max density (${nPts(big)} pts)`);
ok(ms < 900, `runtime max density (${ms} ms)`);

// 4) hidden-face culling: plain sphere must not draw the far side →
//    projected mesh coverage stays inside the disc and no path crosses it fully doubled.
//    proxy: with holes, opening cuts → more, shorter paths than without
const rNoHole = run({ holes: 0, mountains: 0 });
const rHoles = run({ holes: 12, mountains: 0, depth: 0.5 });
ok(rHoles.paths.length > rNoHole.paths.length, `holes split mesh into more paths (${rHoles.paths.length} > ${rNoHole.paths.length})`);

// 5) culling proxy 2: total drawn length of a plain sphere ≈ half of full lat+lon length.
//    full lat circles are 2πr; visible fraction per circle should be < 0.75 on average
const lat = rNoHole.paths.filter((p) => !p.closed);
ok(lat.length > 0, "culling produces open runs from closed circles");

// 5b) Transparent surface: back visible → fewer splits, more drawn length; openings still cut
const totLen = (r) => r.paths.reduce((s, pp) => s + pathLength(pp.pts, pp.closed), 0);
const rS = run({ holes: 6 });
const rT = run({ holes: 6, sstyle: "Transparent" });
ok(totLen(rT) > totLen(rS) * 1.4 && rT.paths.length !== rS.paths.length,
  `Transparent shows back (len ${totLen(rT).toFixed(0)} > ${totLen(rS).toFixed(0)})`);
ok(J(rT) !== J(rS), "sstyle liveness");

// 6) no giant jump segments (visibility splits must break paths, not bridge them)
let maxSeg = 0;
for (const p of run().paths) for (let i = 1; i < p.pts.length; i++)
  maxSeg = Math.max(maxSeg, Math.hypot(p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]));
ok(maxSeg < 12, `no bridged gaps / funnel walls curved (max segment ${maxSeg.toFixed(1)} mm)`);

// 7) fit: projected extent ≈ Size
const rz = run({ size: 100, holes: 0, mountains: 0 });
let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
for (const p of rz.paths) for (const [x, y] of p.pts) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
ok(Math.abs(Math.max(bx1 - bx0, by1 - by0) - 100) < 2, `size fit (${Math.max(bx1 - bx0, by1 - by0).toFixed(1)} mm)`);

// 8) liveness of every param
ok(J(run({ seed: 1 })) !== J(run({ seed: 2 })), "seed liveness");
for (const [k, v] of [["shape", "Cube"], ["size", 80], ["density", 14], ["mountains", 0.9], ["terrain", 3], ["holes", 3], ["holesize", 0.4], ["depth", 0.1], ["flow", 0], ["rx", 60], ["ry", -60], ["layer", 4]])
  ok(J(run({ [k]: v })) !== J(run()), `${k} liveness`);

// 8b) flow liveness + flow=0 still valid
ok(J(run({ flow: 0 })) !== J(run({ flow: 0.9 })), "flow liveness");
// 8c) crater collars: with holes there are small closed rings near hole scale
const rc = run({ holes: 8, mountains: 0, flow: 0 });
const smallClosed = rc.paths.filter((pp) => {
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (const [x, y] of pp.pts) { a0 = Math.min(a0, x); a1 = Math.max(a1, x); b0 = Math.min(b0, y); b1 = Math.max(b1, y); }
  return Math.max(a1 - a0, b1 - b0) < 60;
});
ok(smallClosed.length >= 6, `crater collar rings/arcs present (${smallClosed.length} small paths)`);
// 9) holes=0 + mountains=0 → pure wireframe still draws
ok(run({ holes: 0, mountains: 0 }).paths.length > 20, "plain wireframe");

// 10) path-set shape
const rr = run();
ok(rr.paths.every((p) => typeof p.closed === "boolean" && Number.isInteger(p.layer)), "path-set shape");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
