// validate-parallel-lines.mjs — harness per MUUSIA-NODE-API §9, real helper impls
import fs from "fs";

const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, y, seed) { let h = seed + x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise2(x, y, seed) { const xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; }
function pathLength(pts, closed) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return L; }
function resample(pts, closed, step) { if (pts.length < 2) return pts.slice(); const src = closed ? [...pts, pts[0]] : pts; const out = [src[0].slice()]; let carry = 0; for (let i = 1; i < src.length; i++) { let [X0, Y0] = src[i - 1], [X1, Y1] = src[i]; let seg = Math.hypot(X1 - X0, Y1 - Y0); if (seg === 0) continue; let t = (step - carry) / seg; while (t <= 1) { out.push([X0 + (X1 - X0) * t, Y0 + (Y1 - Y0) * t]); t += step / seg; } carry = (carry + seg) % step; } if (!closed) { const last = src[src.length - 1], ol = out[out.length - 1]; if (Math.hypot(last[0] - ol[0], last[1] - ol[1]) > 0.01) out.push(last.slice()); } return out; }
const applyStyle = (ps) => ps, signedArea = () => 0;

const H = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea };
const src = fs.readFileSync(new URL("../nodes-lab/parallel_lines.plotternode.js", import.meta.url), "utf8");
const N = new Function(...Object.keys(H), '"use strict"; return (' + src + ");")(...Object.values(H));

const CTX = { W: 210, H: 297 };
const defs = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, ctx = CTX) => N.compute([undefined], { ...defs(), ...over }, ctx, {});
const J = (r) => JSON.stringify(r);
const nPts = (r) => r.paths.reduce((s, p) => s + p.pts.length, 0);
const totLen = (r) => r.paths.reduce((s, p) => s + pathLength(p.pts, p.closed), 0);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails++; };

// 1) determinism
for (const mode of ["Grass", "Shoulder", "Cascade"])
  ok(J(run({ mode })) === J(run({ mode })), `determinism (${mode})`);

// 2) geometry sanity across modes, seeds, extremes
const geoCases = [];
for (const mode of ["Grass", "Shoulder", "Cascade"])
  for (const seed of [1, 7, 999])
    for (const over of [{}, { fall: 1, mess: 1, wobble: 1, relief: 1 }, { fall: 0, levels: 1 }, { levels: 8, plateau: 8 }, { spacing: 0.4 }, { margin: 0 }])
      geoCases.push({ mode, seed, ...over });
for (const c of geoCases) {
  const r = run(c);
  let finite = true, inSheet = true, minPts = true;
  for (const p of r.paths) {
    if (p.pts.length < 2) minPts = false;
    for (const [x, y] of p.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
      if (x < 0 || x > CTX.W || y < 0 || y > CTX.H) inSheet = false;
    }
  }
  const label = `${c.mode} s${c.seed} ${Object.keys(c).filter(k => k !== "mode" && k !== "seed").join(",") || "def"}`;
  ok(finite && inSheet && minPts && r.paths.length > 10, `geometry ${label} (paths=${r.paths.length}, pts=${nPts(r)})`);
}

// 3) point budget at worst case (A2, min spacing, max tails)
const big = N.compute([undefined], { ...defs(), spacing: 0.4, fall: 1, wobble: 1, mode: "Cascade" }, { W: 420, H: 594 }, {});
ok(nPts(big) <= 120000, `point budget A2 worst case (${nPts(big)} pts)`);

// 4) seed liveness
ok(J(run({ seed: 1 })) !== J(run({ seed: 2 })), "seed changes output");

// 5) spacing → line count (one path per line, monotone)
const n1 = run({ spacing: 1 }).paths.length, n2 = run({ spacing: 2 }).paths.length;
ok(Math.abs(n1 - 2 * n2) <= 2 && n1 > n2, `spacing controls line count (${n1} vs ${n2})`);

// 6) levels quantization: distinct vertical-run top heights ≤ levels (+ liveness)
const topsOf = (r) => {
  const set = new Set();
  for (const p of r.paths) {
    // vertical run starts at the bottom; find where |dx| first exceeds wobble scale → top of run
    // with wobble=0 the run is exactly x-constant, so use min y of x==pts[0][0] chain
    let i = 1;
    while (i < p.pts.length && Math.abs(p.pts[i][0] - p.pts[0][0]) < 0.01) i++;
    set.add(Math.round(p.pts[i - 1][1] * 10) / 10);
  }
  return set;
};
for (const L of [1, 3, 8]) {
  const t = topsOf(run({ levels: L, wobble: 0, mode: "Grass", plateau: 20 }));
  ok(t.size <= L, `levels=${L} → ${t.size} distinct terrace heights`);
}
ok(J(run({ levels: 1 })) !== J(run({ levels: 6 })), "levels liveness");

// 7) fall (tail length) increases drawn length in every mode
for (const mode of ["Grass", "Shoulder", "Cascade"])
  ok(totLen(run({ mode, fall: 1 })) > totLen(run({ mode, fall: 0.05 })), `fall liveness (${mode})`);

// 8) modes actually differ
ok(J(run({ mode: "Grass" })) !== J(run({ mode: "Shoulder" })) && J(run({ mode: "Shoulder" })) !== J(run({ mode: "Cascade" })), "modes differ");

// 9) remaining param liveness
for (const [k, v] of [["plateau", 120], ["relief", 0.1], ["mess", 1], ["wobble", 0.8], ["margin", 25], ["layer", 5]])
  ok(J(run({ [k]: v })) !== J(run()), `${k} liveness`);

// 10) pen direction: every path starts at the bottom margin (bottom → top travel)
const rd = run({ wobble: 0 });
ok(rd.paths.every((p) => Math.abs(p.pts[0][1] - (CTX.H - defs().margin)) < 0.01), "pen direction bottom→top");

// 11) style pass-through shape + unwired ins guard already exercised (ins[0]=undefined everywhere)
ok(Array.isArray(rd.paths) && rd.paths.every((p) => typeof p.closed === "boolean" && Number.isInteger(p.layer)), "path-set shape");

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
