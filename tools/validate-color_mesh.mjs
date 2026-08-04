// tools/validate-color_mesh.mjs — Color Mesh validation harness.
// Prefers baked src/defs/nodes/color_mesh.js; falls back to the lab file.
// Run from repo root: node tools/validate-color_mesh.mjs
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const roots = [path.join(here, ".."), here, process.cwd()];

const Pin = (t, l) => ({ type: t, label: l });
const EMPTY = { paths: [] };
const PENS = Array.from({ length: 12 }, (_, i) => ({ name: "P" + i, c: "#000" }));
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, y, seed) { let h = seed + x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise2(x, y, seed) { const xi = Math.floor(x), yi = Math.floor(y); const xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed); const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; }
const resample = (pts, closed, step) => { if (pts.length < 2) return pts.map((p) => p.slice()); const src = closed ? [...pts, pts[0]] : pts; const out = [src[0].slice()]; let acc = 0; for (let i = 1; i < src.length; i++) { let [x0, y0] = src[i - 1]; const [x1, y1] = src[i]; let seg = Math.hypot(x1 - x0, y1 - y0); while (acc + seg >= step) { const t = (step - acc) / seg; const nx = x0 + (x1 - x0) * t, ny = y0 + (y1 - y0) * t; out.push([nx, ny]); x0 = nx; y0 = ny; seg = Math.hypot(x1 - x0, y1 - y0); acc = 0; } acc += seg; } if (!closed) out.push(src[src.length - 1].slice()); return out; };
const pathLength = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };
const applyStyle = (ps) => ps;
const signedArea = () => 0;
const HELPERS = { Pin, EMPTY, PENS, mulberry32, hash2, noise2, resample, pathLength, applyStyle, signedArea, isStyle: () => false, parseSVG: () => [], SFONT: {}, fontStrokes: () => [] };

async function loadNode() {
  for (const r of roots) {
    const baked = path.join(r, "src", "defs", "nodes", "color_mesh.js");
    if (fs.existsSync(baked)) {
      console.log("using BAKED node:", baked);
      return (await import(url.pathToFileURL(baked).href)).default;
    }
  }
  for (const r of roots) {
    for (const rel of [["nodes-lab", "color_mesh.plotternode.js"], ["color_mesh.plotternode.js"]]) {
      const lab = path.join(r, ...rel);
      if (fs.existsSync(lab)) {
        console.log("using LAB node:", lab);
        const src = fs.readFileSync(lab, "utf8");
        return new Function(...Object.keys(HELPERS), '"use strict"; return (' + src + ");")(...Object.values(HELPERS));
      }
    }
  }
  throw new Error("color_mesh not found (baked or lab)");
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

// --- 1. defaults: nonempty, finite, on-sheet within margin, open 2-pt segments ---
{
  const r = run();
  const pts = r.paths.reduce((a, q) => a + q.pts.length, 0);
  check("produces paths at defaults", r.paths.length > 500, r.paths.length + " paths, " + pts + " pts");
  check("point budget", pts < 120000, pts + " pts");
  const m = defaults().margin;
  let finite = true, inb = true, open2 = true;
  for (const path of r.paths) {
    if (path.closed || path.pts.length !== 2) open2 = false;
    for (const [x, y] of path.pts) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
      if (x < m - 1e-6 || y < m - 1e-6 || x > CTX.W - m + 1e-6 || y > CTX.H - m + 1e-6) inb = false;
    }
  }
  check("all points finite", finite);
  check("all points inside margin box", inb);
  check("all paths are open 2-pt segments (no outline)", open2);
}

// --- 2. determinism + seed ---
check("deterministic", JSON.stringify(run()) === JSON.stringify(run()));
check("seed changes output", JSON.stringify(run({ seed: 7 })) !== JSON.stringify(run({ seed: 8 })));

// --- 3. single-facet exact oracle: cuts 0, angle 0, spread 0, cross off ---
function singleFacetYs(over) {
  const r = run({ cuts: 0, angle: 0, spread: 0, cross: false, pensn: 1, ...over });
  let horiz = true;
  const rows = r.paths.map((p) => {
    if (Math.abs(p.pts[0][1] - p.pts[1][1]) > 1e-9) horiz = false;
    return p;
  });
  return { horiz, rows };
}
{
  const { horiz, rows } = singleFacetYs({ contrast: 0 });
  check("cuts 0 + angle 0 -> all lines horizontal", horiz, rows.length + " lines");
  const ys = rows.map((p) => p.pts[0][1]).sort((a, b) => a - b);
  const gaps = ys.slice(1).map((y, i) => y - ys[i]);
  const uniform = gaps.every((g) => Math.abs(g - gaps[0]) < 1e-6);
  check("contrast 0 -> uniform spacing", uniform, "gap " + gaps[0].toFixed(4) + " mm, spread " + (Math.max(...gaps) - Math.min(...gaps)).toExponential(1));
  const sp = defaults().spacing;
  check("uniform gap equals Spacing param", Math.abs(gaps[0] - sp) < 1e-6, gaps[0].toFixed(4) + " vs " + sp);
}
{
  const { rows } = singleFacetYs({ contrast: 1 });
  const ys = rows.map((p) => p.pts[0][1]).sort((a, b) => a - b);
  const gaps = ys.slice(1).map((y, i) => y - ys[i]);
  const inc = gaps.every((g, i) => i === 0 || g > gaps[i - 1] - 1e-9);
  const dec = gaps.every((g, i) => i === 0 || g < gaps[i - 1] + 1e-9);
  check("contrast 1 -> strictly monotonic gap gradient", inc || dec, gaps[0].toFixed(3) + " ... " + gaps[gaps.length - 1].toFixed(3));
  check("gradient range matches s0..s1 model", Math.min(...gaps) < defaults().spacing * 0.5 && Math.max(...gaps) > defaults().spacing * 2, Math.min(...gaps).toFixed(3) + " / " + Math.max(...gaps).toFixed(3));
}

// --- 4. light angle flips the gradient orientation ---
{
  const ysA = singleFacetYs({ contrast: 1, light: 90 }).rows.map((p) => p.pts[0][1]).sort((a, b) => a - b);
  const ysB = singleFacetYs({ contrast: 1, light: 270 }).rows.map((p) => p.pts[0][1]).sort((a, b) => a - b);
  const gA = ysA.slice(1).map((y, i) => y - ysA[i]);
  const gB = ysB.slice(1).map((y, i) => y - ysB[i]);
  const incA = gA[gA.length - 1] > gA[0];
  const incB = gB[gB.length - 1] > gB[0];
  check("light 90 vs 270 flips gradient direction", incA !== incB, "A inc=" + incA + " B inc=" + incB);
}

// --- 5. boustrophedon: consecutive lines alternate direction ---
{
  const { rows } = singleFacetYs({ contrast: 0 });
  const sorted = rows.slice().sort((a, b) => a.pts[0][1] - b.pts[0][1]);
  let alt = true;
  for (let i = 1; i < sorted.length; i++) {
    const d0 = Math.sign(sorted[i - 1].pts[1][0] - sorted[i - 1].pts[0][0]);
    const d1 = Math.sign(sorted[i].pts[1][0] - sorted[i].pts[0][0]);
    if (d0 === d1) alt = false;
  }
  check("boustrophedon: consecutive lines alternate", alt);
}

// --- 6. cross hatch adds the perpendicular family ---
{
  const r = run({ cuts: 0, angle: 0, spread: 0, cross: true, contrast: 0 });
  const horiz = r.paths.filter((p) => Math.abs(p.pts[0][1] - p.pts[1][1]) < 1e-9).length;
  const vert = r.paths.filter((p) => Math.abs(p.pts[0][0] - p.pts[1][0]) < 1e-9).length;
  check("cross hatch -> both families present", horiz > 50 && vert > 50, horiz + " H + " + vert + " V");
  check("cross ~doubles line count", Math.abs(r.paths.length - horiz - vert) === 0);
}

// --- 7. pens: layers restricted to [pen, pen+pensn), pensn live ---
{
  const r = run({ pen: 2, pensn: 3, cuts: 30 });
  const layers = new Set(r.paths.map((p) => p.layer));
  const okRange = [...layers].every((l) => l === 2 || l === 3 || l === 4);
  check("layers within First pen + Pens used", okRange, [...layers].sort().join(","));
  check("multiple pens actually used", layers.size >= 2, layers.size + " pens");
  const r1 = run({ pensn: 1, pen: 5 });
  check("pensn 1 -> single layer", new Set(r1.paths.map((p) => p.layer)).size === 1);
}

// --- 8. spacing monotone, param liveness ---
{
  const a = run({ spacing: 0.5 }).paths.length, b = run({ spacing: 1.5 }).paths.length;
  check("smaller spacing -> more lines", a > b * 1.8, a + " vs " + b);
}
check("angle is live", JSON.stringify(run({ angle: 0 })) !== JSON.stringify(run({ angle: 60 })));
check("spread is live", JSON.stringify(run({ spread: 0 })) !== JSON.stringify(run({ spread: 80 })));
check("light is live (with shading)", JSON.stringify(run({ light: 0 })) !== JSON.stringify(run({ light: 180 })));
check("patch is live", JSON.stringify(run({ patch: 25, pensn: 4 })) !== JSON.stringify(run({ patch: 140, pensn: 4 })));
check("contrast is live", JSON.stringify(run({ contrast: 0.1 })) !== JSON.stringify(run({ contrast: 0.9 })));
{
  const f4 = run({ cuts: 4 }), f40 = run({ cuts: 40 });
  check("cuts is live", JSON.stringify(f4) !== JSON.stringify(f40));
}

// --- 9. outline adds closed facet polygons ---
{
  const r = run({ outline: true, cuts: 10 });
  const closed = r.paths.filter((p) => p.closed);
  check("outline -> closed polygons appear", closed.length >= 8, closed.length + " outlines");
  const okPoly = closed.every((p) => p.pts.length >= 3);
  check("outlines are >=3-pt polygons", okPoly);
}

// --- 10. margin respected at other values ---
{
  const r = run({ margin: 30 });
  const ok = r.paths.every((p) => p.pts.every(([x, y]) => x >= 30 - 1e-6 && y >= 30 - 1e-6 && x <= CTX.W - 30 + 1e-6 && y <= CTX.H - 30 + 1e-6));
  check("margin 30 respected", ok);
}

// --- 11. extremes stay sane ---
for (const over of [{ spacing: 0.05 }, { spacing: 8 }, { cuts: 200 }, { contrast: 4 }, { spread: 300 }, { margin: 150 }, { pensn: 40 }, { patch: 1 }, { light: 800 }]) {
  const r = run(over);
  const pts = r.paths.reduce((a, q) => a + q.pts.length, 0);
  const ok = pts < 130000 && r.paths.every((p) => p.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= -1e-6 && y >= -1e-6 && x <= CTX.W + 1e-6 && y <= CTX.H + 1e-6));
  check("extreme " + JSON.stringify(over) + " sane", ok, r.paths.length + " paths, " + pts + " pts");
}

// --- 12. small canvas ---
{
  const r = run({}, { W: 60, H: 60 });
  check("60x60 canvas works", r.paths.length > 0 && r.paths.every((p) => p.pts.every(([x, y]) => x >= -1e-6 && y >= -1e-6 && x <= 60 + 1e-6 && y <= 60 + 1e-6)));
}

// --- 13. overlay margin rect ---
{
  const g = N.overlay({ ...defaults(), margin: 20 }, CTX);
  check("overlay returns margin rect", g.length === 1 && g[0].kind === "rect" && g[0].x === 20 && g[0].w === CTX.W - 40);
}

console.log(fails === 0 ? "\nALL CHECKS PASSED" : "\n" + fails + " CHECK(S) FAILED");
process.exitCode = fails === 0 ? 0 : 1;

// ================= 3D MODE =================
console.log("--- 3D mode ---");

// --- 14. 3D basic: nonempty, finite, inside margin (fit guarantee), no z left in points ---
{
  const r = run({ mode: "3D" });
  const pts = r.paths.reduce((a, q) => a + q.pts.length, 0);
  check("3D produces paths", r.paths.length > 500, r.paths.length + " paths, " + pts + " pts");
  check("3D point budget", pts < 120000, pts + " pts");
  const m = defaults().margin;
  let finite = true, inb = true, only2 = true;
  for (const path of r.paths) {
    for (const q of path.pts) {
      if (q.length !== 2) only2 = false;
      const [x, y] = q;
      if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
      if (x < m - 1e-6 || y < m - 1e-6 || x > CTX.W - m + 1e-6 || y > CTX.H - m + 1e-6) inb = false;
    }
  }
  check("3D all points finite", finite);
  check("3D all points inside margin box (refit)", inb);
  check("3D emits NO third z component (z = plunge, must not leak)", only2);
}

// --- 15. 3D determinism + seed + mode liveness ---
check("3D deterministic", JSON.stringify(run({ mode: "3D" })) === JSON.stringify(run({ mode: "3D" })));
check("3D seed live", JSON.stringify(run({ mode: "3D", seed: 7 })) !== JSON.stringify(run({ mode: "3D", seed: 8 })));
check("mode is live (3D differs from Flat)", JSON.stringify(run({ mode: "3D" })) !== JSON.stringify(run()));

// --- 16. relief 0 + tilt 0 -> straight lines, same line count as Flat (lambert normalized) ---
function maxChordDeviation(r) {
  let dev = 0;
  for (const path of r.paths) {
    if (path.closed) continue;
    const a = path.pts[0], b = path.pts[path.pts.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    for (const [x, y] of path.pts) {
      const d = Math.abs((x - a[0]) * dy - (y - a[1]) * dx) / L;
      if (d > dev) dev = d;
    }
  }
  return dev;
}
{
  const flat = run({ outline: false });
  const r0 = run({ mode: "3D", relief: 0, tilt: 0, outline: false });
  check("3D relief 0 -> all lines straight (collinear samples)", maxChordDeviation(r0) < 1e-6, "max dev " + maxChordDeviation(r0).toExponential(2));
  check("3D relief 0 -> same line count as Flat (lambert normalized)", r0.paths.length === flat.paths.length, r0.paths.length + " vs " + flat.paths.length);
  const endsMatch = r0.paths.every((p3, i) => {
    const pf = flat.paths[i];
    const a = Math.hypot(p3.pts[0][0] - pf.pts[0][0], p3.pts[0][1] - pf.pts[0][1]);
    const b = Math.hypot(p3.pts[p3.pts.length - 1][0] - pf.pts[1][0], p3.pts[p3.pts.length - 1][1] - pf.pts[1][1]);
    return a < 0.05 && b < 0.05;
  });
  check("3D relief 0 -> line endpoints coincide with Flat", endsMatch);
}

// --- 17. relief bends lines: chord deviation grows with relief ---
{
  const d5 = maxChordDeviation(run({ mode: "3D", relief: 5, tilt: 35 }));
  const d30 = maxChordDeviation(run({ mode: "3D", relief: 30, tilt: 35 }));
  check("relief bends hatch lines (>1mm at 30)", d30 > 1, "dev " + d30.toFixed(2) + " mm");
  check("more relief -> more bend", d30 > d5 * 1.5, d5.toFixed(2) + " -> " + d30.toFixed(2));
}

// --- 18. tilt is live; tilt foreshortens (pre-fit bbox flatter -> refit changes x-span usage) ---
check("tilt is live", JSON.stringify(run({ mode: "3D", tilt: 0 })) !== JSON.stringify(run({ mode: "3D", tilt: 60 })));
check("relief is live", JSON.stringify(run({ mode: "3D", relief: 4 })) !== JSON.stringify(run({ mode: "3D", relief: 28 })));

// --- 19. lambert exact oracle on a SMALL single facet (large facet barely tilts -> use 60x60, margin 5, relief 40) ---
{
  const SCTX = { W: 60, H: 60 };
  const base = { cuts: 0, angle: 0, spread: 0, cross: false, contrast: 0, outline: false, pensn: 1, tilt: 0, margin: 5 };
  const gapsAt = (relief, seed) => {
    const r = run({ mode: "3D", relief, seed, ...base }, SCTX);
    const ys = r.paths.map((p) => p.pts[0][1]).sort((a, b) => a - b);
    return ys.slice(1).map((y, i) => y - ys[i]);
  };
  const sp = defaults().spacing;
  let hits = 0, mSeen = [], uniformAll = true, inBand = true;
  for (const s of [7, 11, 23, 42]) {
    const g = gapsAt(40, s);
    const uniform = g.every((x) => Math.abs(x - g[0]) < 1e-6);
    if (!uniform) uniformAll = false;
    const m = g[0] / sp;
    mSeen.push(m.toFixed(3));
    if (m < 0.4 - 1e-6 || m > 2.2 + 1e-6) inBand = false;
    if (Math.abs(m - 1) > 0.05) hits++;
  }
  check("lambert: relief tilts small-facet normal -> gap = Spacing*m, m != 1 (>=3/4 seeds)", hits >= 3, "m: " + mSeen.join(", "));
  check("lambert: modulated spacing stays uniform within facet", uniformAll);
  check("lambert: m within clamp band [0.4, 2.2]", inBand);
  const g0 = gapsAt(0, 7);
  check("lambert: relief 0 -> m exactly 1", Math.abs(g0[0] - sp) < 1e-6, g0[0].toFixed(4) + " vs " + sp);
}

// --- 20. 3D outline: closed, folded (non-collinear edges when relief high) ---
{
  const r = run({ mode: "3D", relief: 25, tilt: 40, outline: true, cuts: 12 });
  const closed = r.paths.filter((p) => p.closed);
  check("3D outlines present + resampled (many pts)", closed.length >= 8 && closed.every((p) => p.pts.length > 6), closed.length + " outlines");
}

// --- 21. 3D extremes sane ---
for (const over of [{ mode: "3D", relief: 80 }, { mode: "3D", tilt: 85 }, { mode: "3D", spacing: 0.3, cuts: 40 }, { mode: "3D", relief: 40, tilt: 75, cuts: 60, spacing: 0.35 }]) {
  const r = run(over);
  const pts = r.paths.reduce((a, q) => a + q.pts.length, 0);
  const m = defaults().margin;
  const ok = pts < 125000 && r.paths.every((p) => p.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= m - 1e-6 && y >= m - 1e-6 && x <= CTX.W - m + 1e-6 && y <= CTX.H - m + 1e-6));
  check("3D extreme " + JSON.stringify(over) + " sane", ok, r.paths.length + " paths, " + pts + " pts");
}

// --- 22. 3D small canvas ---
{
  const r = run({ mode: "3D" }, { W: 60, H: 60 });
  check("3D 60x60 canvas works", r.paths.length > 0 && r.paths.every((p) => p.pts.every(([x, y]) => x >= -1e-6 && y >= -1e-6 && x <= 60 + 1e-6 && y <= 60 + 1e-6)));
}

console.log(fails === 0 ? "\n3D SECTION: ALL PASSED" : "\n3D SECTION: " + fails + " TOTAL FAILURES");
process.exitCode = fails === 0 ? 0 : 1;
