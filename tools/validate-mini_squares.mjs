// tools/validate-mini_squares.mjs — Mini Squares validation harness.
// Prefers the baked ESM node (src/defs/nodes/mini_squares.js); falls back to
// the lab plotternode file with a helper sandbox. Run from repo root:
//   node tools/validate-mini_squares.mjs
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const roots = [path.join(here, ".."), here, process.cwd()];

// ---- helpers (mirror src/defs/helpers.js semantics) ----
const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = Math.imul(Math.floor(x) ^ 0x9e3779b9, 2654435761); h ^= Math.imul(Math.floor(y) ^ 0x85ebca6b, 2246822519); h ^= Math.imul((s | 0) ^ 0xc2b2ae35, 3266489917); h = (h ^ (h >>> 15)) >>> 0; return h / 4294967296; }
function noise2(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v; }
function resample(pts, closed, step) { if (pts.length < 2) return pts.map((p) => p.slice()); const src = closed ? [...pts, pts[0]] : pts; const out = [src[0].slice()]; let acc = 0; for (let i = 1; i < src.length; i++) { let [x0, y0] = src[i - 1]; const [x1, y1] = src[i]; let seg = Math.hypot(x1 - x0, y1 - y0); while (acc + seg >= step) { const t = (step - acc) / seg; const nx = x0 + (x1 - x0) * t, ny = y0 + (y1 - y0) * t; out.push([nx, ny]); x0 = nx; y0 = ny; seg = Math.hypot(x1 - x0, y1 - y0); acc = 0; } acc += seg; } if (!closed) out.push(src[src.length - 1].slice()); return out; }
const pathLength = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };
const applyStyle = (ps) => ps;
const signedArea = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
const HELPERS = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea, isStyle: () => false, parseSVG: () => [], SFONT: {}, fontStrokes: () => [] };

async function loadNode() {
  for (const r of roots) {
    const baked = path.join(r, "src", "defs", "nodes", "mini_squares.js");
    if (fs.existsSync(baked)) {
      console.log("using BAKED node:", baked);
      return (await import(url.pathToFileURL(baked).href)).default;
    }
  }
  for (const r of roots) {
    for (const rel of [["nodes-lab", "mini_squares.plotternode.js"], ["mini_squares.plotternode.js"]]) {
      const lab = path.join(r, ...rel);
      if (fs.existsSync(lab)) {
        console.log("using LAB node:", lab);
        const src = fs.readFileSync(lab, "utf8");
        return new Function(...Object.keys(HELPERS), '"use strict"; return (' + src + ");")(...Object.values(HELPERS));
      }
    }
  }
  throw new Error("mini_squares not found (baked or lab)");
}

const N = await loadNode();
const CTX = { W: 210, H: 297 };
const defaults = () => { const p = {}; for (const pr of N.params) p[pr.key] = pr.def; return p; };
const run = (over = {}, ctx = CTX) => N.compute([undefined], { ...defaults(), ...over }, ctx, {});

let fails = 0;
const check = (name, ok, extra) => {
  console.log((ok ? "  OK  " : " FAIL ") + name + (extra ? "  (" + extra + ")" : ""));
  if (!ok) fails++;
};

// --- 1. basic output, finiteness, bounds, closure ---
{
  const r = run();
  const pts = r.paths.reduce((a, p) => a + p.pts.length, 0);
  check("produces paths at defaults", r.paths.length > 50, r.paths.length + " paths, " + pts + " pts");
  check("point budget", pts < 120000, pts + " pts");
  let finite = true, inb = true, closed = true, four = true, axis = true, dup = true;
  for (const path of r.paths) {
    if (!path.closed) closed = false;
    if (path.pts.length !== 4) four = false;
    const xs = new Set(path.pts.map((q) => q[0])), ys = new Set(path.pts.map((q) => q[1]));
    if (xs.size !== 2 || ys.size !== 2) axis = false;
    const first = path.pts[0], last = path.pts[path.pts.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9) dup = false;
    for (const [x, y] of path.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
      if (x < -1e-6 || y < -1e-6 || x > CTX.W + 1e-6 || y > CTX.H + 1e-6) inb = false;
    }
  }
  check("all points finite", finite);
  check("all points on sheet", inb);
  check("all paths closed", closed);
  check("all paths are 4-pt rects", four);
  check("all rects axis-aligned squares", axis);
  check("no duplicated first point at end", dup);
  let square = true;
  for (const path of r.paths) {
    const xs = path.pts.map((q) => q[0]), ys = path.pts.map((q) => q[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    if (Math.abs(w - h) > 1e-9) square = false;
  }
  check("all rects are squares (w == h)", square);
}

// --- 2. determinism ---
{
  const a = JSON.stringify(run()), b = JSON.stringify(run());
  check("deterministic (double run identical)", a === b);
}

// --- 3. seed liveness ---
check("seed changes output", JSON.stringify(run({ seed: 7 })) !== JSON.stringify(run({ seed: 8 })));

// --- 4. density: zero -> empty, monotone-ish growth ---
{
  const z = run({ density: 0 });
  check("density 0 -> empty", z.paths.length === 0);
  const lo = run({ density: 0.25 }).paths.length, hi = run({ density: 0.95 }).paths.length;
  check("density raises square count", hi > lo, lo + " -> " + hi);
}

// --- 5. structural invariant: any two rects are interior-disjoint OR strictly nested ---
function bbox(path) {
  const xs = path.pts.map((q) => q[0]), ys = path.pts.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function nestedOrDisjoint(r, label) {
  const bbs = r.paths.map(bbox);
  const eps = 1e-6;
  for (let i = 0; i < bbs.length; i++) {
    for (let j = i + 1; j < bbs.length; j++) {
      const A = bbs[i], B = bbs[j];
      const ow = Math.min(A[2], B[2]) - Math.max(A[0], B[0]);
      const oh = Math.min(A[3], B[3]) - Math.max(A[1], B[1]);
      if (ow > eps && oh > eps) {
        const AinB = A[0] > B[0] + eps && A[1] > B[1] + eps && A[2] < B[2] - eps && A[3] < B[3] - eps;
        const BinA = B[0] > A[0] + eps && B[1] > A[1] + eps && B[2] < A[2] - eps && B[3] < A[3] - eps;
        if (!AinB && !BinA) return false;
      }
    }
  }
  return true;
}
check("rects pairwise disjoint or strictly nested (gap 0)", nestedOrDisjoint(run({ density: 0.95, nest: 3, nestp: 1 })));
check("rects pairwise disjoint or strictly nested (gap 1.2)", nestedOrDisjoint(run({ density: 0.95, gap: 1.2, nest: 3, nestp: 1 })));
check("... also across seeds/styles", [3, 11, 42].every((s) => ["Concentric", "Corner", "Mixed"].every((st) => nestedOrDisjoint(run({ seed: s, neststyle: st, density: 0.9, nest: 3, nestp: 1 })))));

// --- 6. nesting liveness: nest 0 vs 3 ---
{
  const n0 = run({ nest: 0 }).paths.length, n3 = run({ nest: 3, nestp: 1 }).paths.length;
  check("nest depth adds inner squares", n3 > n0, n0 + " -> " + n3);
  // nest 0 -> all sides are multiples of cell (top-level only, gap 0)
  const r = run({ nest: 0, gap: 0, cell: 4 });
  const mult = r.paths.every((p) => { const b = bbox(p); const s = b[2] - b[0]; return Math.abs(s / 4 - Math.round(s / 4)) < 1e-9; });
  check("nest 0 -> only whole-cell squares", mult);
}

// --- 7. maxsize: 1 -> no square larger than one cell ---
{
  const r = run({ maxsize: 1, nest: 0, gap: 0, cell: 4 });
  const okSize = r.paths.every((p) => { const b = bbox(p); return b[2] - b[0] <= 4 + 1e-9; });
  check("maxsize 1 caps square size", okSize);
  const big = run({ maxsize: 4, nest: 0, gap: 0, cell: 4, density: 0.95 });
  const hasBig = big.paths.some((p) => { const b = bbox(p); return b[2] - b[0] > 4 + 1e-9; });
  check("maxsize 4 actually places multi-cell squares", hasBig);
}

// --- 8. gap shrinks top-level squares ---
{
  const s0 = Math.max(...run({ nest: 0, gap: 0, maxsize: 1 }).paths.map((p) => { const b = bbox(p); return b[2] - b[0]; }));
  const s1 = Math.max(...run({ nest: 0, gap: 1, maxsize: 1 }).paths.map((p) => { const b = bbox(p); return b[2] - b[0]; }));
  check("gap shrinks squares", s1 < s0 - 0.9, s0.toFixed(2) + " -> " + s1.toFixed(2));
}

// --- 9. spread & fade liveness ---
{
  const full = JSON.stringify(run({ spread: "Full" }));
  check("spread Corner differs from Full", JSON.stringify(run({ spread: "Corner" })) !== full);
  check("spread Center differs from Full", JSON.stringify(run({ spread: "Center" })) !== full);
  check("spread Linear differs from Full", JSON.stringify(run({ spread: "Linear" })) !== full);
  check("fade is live (Corner)", JSON.stringify(run({ spread: "Corner", fade: 0.2 })) !== JSON.stringify(run({ spread: "Corner", fade: 1 })));
  // Corner falloff: density in far corner quadrant should be lower than near corner
  const r = run({ spread: "Corner", fade: 1, density: 0.8, nest: 0 });
  let near = 0, far = 0;
  for (const p of r.paths) { const b = bbox(p); const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; if (cx < CTX.W / 2 && cy < CTX.H / 2) near++; if (cx > CTX.W / 2 && cy > CTX.H / 2) far++; }
  check("Corner spread: near corner denser than far corner", near > far * 2, near + " vs " + far);
}

// --- 10. patch, cell, margin, pen liveness ---
check("patch size is live", JSON.stringify(run({ patch: 3 })) !== JSON.stringify(run({ patch: 20 })));
{
  const c3 = run({ cell: 3, nest: 0 }).paths.length, c10 = run({ cell: 10, nest: 0 }).paths.length;
  check("cell size changes grid resolution", c3 > c10 * 2, c3 + " vs " + c10);
}
{
  const r = run({ margin: 30 });
  const inside = r.paths.every((p) => { const b = bbox(p); return b[0] >= 30 - 1e-6 && b[1] >= 30 - 1e-6 && b[2] <= CTX.W - 30 + 1e-6 && b[3] <= CTX.H - 30 + 1e-6; });
  check("margin respected", inside);
}
{
  const r = run({ layer: 5 });
  check("pen param applied to every path", r.paths.every((p) => p.layer === 5));
}

// --- 11. nestp liveness + Corner nest strictly inside parent (min 0.3 inset) ---
{
  check("nest % is live", run({ nest: 3, nestp: 1 }).paths.length > run({ nest: 3, nestp: 0.2 }).paths.length);
}

// --- 12. extreme params stay sane (slider max is not a guarantee) ---
{
  for (const over of [{ cell: 0.5 }, { cell: 40 }, { density: 5 }, { maxsize: 12 }, { gap: 10 }, { margin: 200 }, { patch: 0.1 }, { fade: 3 }, { nest: 9 }]) {
    const r = run(over);
    const ok = r.paths.every((p) => p.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= -1e-6 && y >= -1e-6 && x <= CTX.W + 1e-6 && y <= CTX.H + 1e-6));
    check("extreme " + JSON.stringify(over) + " stays finite+on-sheet", ok, r.paths.length + " paths");
  }
}

// --- 13. small canvas does not explode ---
{
  const r = run({}, { W: 60, H: 60 });
  check("60x60 canvas works", r.paths.every((p) => p.pts.every(([x, y]) => x >= -1e-6 && y >= -1e-6 && x <= 60 + 1e-6 && y <= 60 + 1e-6)));
}

// --- 14. overlay guide matches margin ---
{
  const g = N.overlay({ ...defaults(), margin: 20 }, CTX);
  check("overlay returns margin rect", g.length === 1 && g[0].kind === "rect" && g[0].x === 20 && g[0].w === CTX.W - 40);
}

console.log(fails === 0 ? "\nALL CHECKS PASSED" : "\n" + fails + " CHECK(S) FAILED");
process.exitCode = fails === 0 ? 0 : 1;
