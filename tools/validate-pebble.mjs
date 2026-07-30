// validate-pebble.mjs — harness per MUUSIA-NODE-API §9, real helper impls
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
const src = fs.readFileSync(new URL("../nodes-lab/pebble.plotternode.js", import.meta.url), "utf8");
const N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));

const CTX = { W: 210, H: 297 };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}) => N.compute([undefined], { ...defs(), ...over }, CTX, {});
const J = (r) => JSON.stringify(r);
const nPts = (r) => r.paths.reduce((s, p) => s + p.pts.length, 0);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails++; };

// 1) determinism both modes
ok(J(run()) === J(run()), "determinism (Spiral shells)");
ok(J(run({ mode: "Mesh" })) === J(run({ mode: "Mesh" })), "determinism (Mesh)");
ok(J(run()) !== J(run({ mode: "Mesh" })), "modes differ");

// 2) geometry sanity across modes/extremes
const cases = [
  {}, { angular: 1 }, { angular: 0 }, { irregular: 1.0, detail: 1 }, { eyes: 3, turns: 120, weave: 1, pack: 3 },
  { turns: 10, pack: 0.5 }, { size: 280 }, { size: 20 },
  { mode: "Mesh" }, { mode: "Mesh", angular: 1, density: 60 }, { mode: "Mesh", rx: 180, ry: -180, irregular: 1 },
];
for (const c of cases) for (const seed of [1, 4, 77]) {
  const r = run({ ...c, seed });
  let finite = true, inSheet = true, minPts = true;
  for (const pp of r.paths) {
    if (pp.pts.length < 2) minPts = false;
    for (const [x, y] of pp.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
      if (x < 0 || x > CTX.W || y < 0 || y > CTX.H) inSheet = false;
    }
  }
  ok(finite && inSheet && minPts && r.paths.length >= 1, `geometry ${Object.keys(c).join(",") || "def"} s${seed} (paths=${r.paths.length}, pts=${nPts(r)})`);
}

// 3) spiral structure: eyes+outline path count; spiral end lands far inside (near its eye), start on outline
const r2 = run({ eyes: 2, outline: true });
ok(r2.paths.length === 3 && r2.paths.filter((pp) => pp.closed).length === 1, `2 spirals + closed outline (${r2.paths.length})`);
ok(run({ eyes: 3, outline: false }).paths.length === 3, "eyes count = spiral count");
const outlinePath = r2.paths.find((pp) => pp.closed);
const distToRing = (ring, x, y) => { let best = 1e18; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; const dx = xj - xi, dy = yj - yi; const L2 = dx * dx + dy * dy; let t = L2 > 0 ? ((x - xi) * dx + (y - yi) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(xi + dx * t - x, yi + dy * t - y); if (d < best) best = d; } return best; };
const ringContains = (ring, x, y) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
for (const sp of r2.paths.filter((pp) => !pp.closed)) {
  const [sx, sy] = sp.pts[0], [ex2, ey2] = sp.pts[sp.pts.length - 1];
  ok(distToRing(outlinePath.pts, sx, sy) < 1.5, `spiral starts on outline (d=${distToRing(outlinePath.pts, sx, sy).toFixed(2)})`);
  ok(ringContains(outlinePath.pts, ex2, ey2) && distToRing(outlinePath.pts, ex2, ey2) > 15, "spiral ends deep inside (eye)");
}

// 4) all spiral points stay inside outline (+0.6mm tolerance)
let allIn = true;
for (const sp of r2.paths.filter((pp) => !pp.closed)) for (const [x, y] of sp.pts)
  if (!ringContains(outlinePath.pts, x, y) && distToRing(outlinePath.pts, x, y) > 0.6) allIn = false;
ok(allIn, "spirals contained in outline");

// 5) turns increase drawn length; pack & weave live
const len = (r) => r.paths.reduce((s, pp) => s + pathLength(pp.pts, pp.closed), 0);
ok(len(run({ turns: 90 })) > len(run({ turns: 20 })) * 1.8, "turns scale length");
ok(J(run({ pack: 0.6 })) !== J(run({ pack: 2.5 })), "pack liveness");
ok(J(run({ weave: 0 })) !== J(run({ weave: 1 })), "weave liveness");

// 6) angular: at 1 the outline is polygonal — few dominant edge directions; at 0 smooth — many
const dirCount = (r) => {
  const o = r.paths.find((pp) => pp.closed).pts;
  const set = new Set();
  for (let i = 1; i < o.length; i++) set.add(Math.round(Math.atan2(o[i][1] - o[i - 1][1], o[i][0] - o[i - 1][0]) * 12));
  return set.size;
};
ok(dirCount(run({ angular: 1 })) < dirCount(run({ angular: 0 })) * 0.6, `angular=1 gives polygonal outline (${dirCount(run({ angular: 1 }))} vs ${dirCount(run({ angular: 0 }))} directions)`);

// 7) mesh: fit to size; backface culling splits lines
const rm = run({ mode: "Mesh", size: 120 });
let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
for (const pp of rm.paths) for (const [x, y] of pp.pts) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
ok(Math.abs(Math.max(bx1 - bx0, by1 - by0) - 120) < 2, `mesh size fit (${Math.max(bx1 - bx0, by1 - by0).toFixed(1)} mm)`);
ok(rm.paths.length > 60, `mesh culling produces split runs (${rm.paths.length})`);

// 7b) Transparent surface: no culling splits — path count equals the exact grid line count, ~2x drawn length
const rmS = run({ mode: "Mesh" });
const rmT = run({ mode: "Mesh", sstyle: "Transparent" });
const mGrid = Math.max(3, Math.round(28 * 0.5)); // density 28 default
ok(rmT.paths.length === 6 * 2 * (mGrid + 1) && len(rmT) > len(rmS) * 1.4,
  `Transparent shows back (${rmT.paths.length} = full line count, len ${len(rmT).toFixed(0)} > ${len(rmS).toFixed(0)})`);
ok(J(rmT) !== J(rmS), "sstyle liveness");

// 7c) rx/ry act in Spiral mode too: ry spins, rx tilts (height shrinks)
ok(J(run({ ry: 45 })) !== J(run()), "spiral ry (spin) liveness");
const hgt = (r) => { let a = 1e9, b = -1e9; for (const pp of r.paths) for (const [, y] of pp.pts) { a = Math.min(a, y); b = Math.max(b, y); } return b - a; };
ok(hgt(run({ rx: 70 })) < hgt(run({ rx: 0 })) * 0.6, `spiral rx tilts flat (${hgt(run({ rx: 70 })).toFixed(0)} < ${hgt(run({ rx: 0 })).toFixed(0)} mm)`);
// spin must not break containment: spiral pts still inside spun outline
const rSpin = run({ ry: 60, eyes: 2 });
const oSpin = rSpin.paths.find((pp) => pp.closed);
let allIn2 = true;
for (const sp of rSpin.paths.filter((pp) => !pp.closed)) for (const [x, y] of sp.pts)
  if (!ringContains(oSpin.pts, x, y) && distToRing(oSpin.pts, x, y) > 0.6) allIn2 = false;
ok(allIn2, "spun spirals contained in spun outline");

// 8) budgets
ok(nPts(run({ eyes: 3, turns: 120 })) <= 120000, `spiral budget (${nPts(run({ eyes: 3, turns: 120 }))} pts)`);
ok(nPts(run({ mode: "Mesh", density: 60 })) <= 120000, `mesh budget (${nPts(run({ mode: "Mesh", density: 60 }))} pts)`);
ok(nPts(run({ mode: "Mesh", density: 60, sstyle: "Transparent" })) <= 120000, `mesh budget transparent (${nPts(run({ mode: "Mesh", density: 60, sstyle: "Transparent" }))} pts)`);

// 9) param liveness
ok(J(run({ seed: 1 })) !== J(run({ seed: 2 })), "seed liveness (spiral)");
ok(J(run({ mode: "Mesh", seed: 1 })) !== J(run({ mode: "Mesh", seed: 2 })), "seed liveness (mesh)");
for (const [k, v] of [["size", 100], ["angular", 0.9], ["irregular", 1], ["facets", 16], ["detail", 0.8], ["eyes", 1], ["turns", 70], ["outline", false], ["layer", 6]])
  ok(J(run({ [k]: v })) !== J(run()), `${k} liveness`);
for (const [k, v] of [["density", 12], ["rx", 90], ["ry", -90], ["angular", 0.9], ["facets", 18], ["detail", 0.8]])
  ok(J(run({ mode: "Mesh", [k]: v })) !== J(run({ mode: "Mesh" })), `mesh ${k} liveness`);

// 10) path-set shape
ok(run().paths.every((pp) => typeof pp.closed === "boolean" && Number.isInteger(pp.layer)), "path-set shape");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
