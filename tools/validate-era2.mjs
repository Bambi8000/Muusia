import truchet from "../src/defs/nodes/truchet.js";
import tiles from "../src/defs/nodes/tiles.js";
import hyp from "../src/defs/nodes/hyperbolic_truchet.js";

const die = (m) => { console.error("FAIL: " + m); process.exit(1); };
const P = (def, o) => Object.assign(Object.fromEntries(def.params.map((q) => [q.key, q.def])), o);
const CTX = { W: 300, H: 200 };
const finiteAll = (ps) => ps.paths.every((pa) => pa.pts.length >= 2 && pa.pts.every((q) => isFinite(q[0]) && isFinite(q[1])));
const segInt = (A, B, C, D) => {
  const d1x = B[0] - A[0], d1y = B[1] - A[1], d2x = D[0] - C[0], d2y = D[1] - C[1];
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-12) return false;
  const t = ((C[0] - A[0]) * d2y - (C[1] - A[1]) * d2x) / den;
  const u = ((C[0] - A[0]) * d1y - (C[1] - A[1]) * d1x) / den;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
};

{ /* truchet */
  const run = (o) => truchet.compute([undefined], P(truchet, o), CTX);
  const a = run({}), b = run({});
  if (JSON.stringify(a) !== JSON.stringify(b)) die("truchet non-deterministic");
  if (!finiteAll(a)) die("truchet invalid");
  const full = run({ tile: 20 }).paths.length;
  const half = run({ tile: 20, fill: 50 }).paths.length;
  if (!(half < full * 0.75 && half > full * 0.25)) die("tile fill has no effect (" + full + " vs " + half + ")");
  /* Separate: no two strands intersect or touch (multi-line worst case) */
  const sep = run({ tile: 30, lines: 4, spread: 100, sep: "Separate (never meet)" });
  const paz = sep.paths;
  for (let i = 0; i < paz.length; i++) for (let j = i + 1; j < paz.length; j++) {
    const A = paz[i].pts, B = paz[j].pts;
    for (let q = 1; q < A.length; q++) for (let w = 1; w < B.length; w++) {
      if (segInt(A[q - 1], A[q], B[w - 1], B[w])) die("separate mode: strands cross (paths " + i + "/" + j + ")");
    }
    let minD = Infinity;
    for (const qa of A) for (const qb of B) {
      const d = Math.hypot(qa[0] - qb[0], qa[1] - qb[1]);
      if (d < minD) minD = d;
    }
    if (minD < 0.3) die("separate mode: strands touch (gap " + minD.toFixed(3) + " mm)");
  }
  const loop = run({ mode: "Loop" });
  if (loop.paths.length !== 1 || !loop.paths[0].closed) die("loop regression");
  console.log("truchet OK (fill " + full + "->" + half + " paths, separate mode crossing-free, loop intact)");
}
{ /* tiles */
  const run = (o) => tiles.compute([undefined], P(tiles, o), CTX);
  const g = run({}), b2 = run({ layout: "Brick (offset rows)" }), hx = run({ layout: "Hex pack" });
  for (const [n2, r] of [["grid", g], ["brick", b2], ["hex", hx]]) if (!finiteAll(r)) die("tiles " + n2 + " invalid");
  if (JSON.stringify(g) === JSON.stringify(hx)) die("layout has no effect");
  if (JSON.stringify(run({})) === JSON.stringify(run({ flipAlt: true, shape: "Triangle" }))) die("flipAlt has no effect");
  /* hex pack circles at 100%: adjacent shapes touch but do not overlap */
  const hp = run({ layout: "Hex pack", shape: "Circle", sizeX: 100, rows: 5, cols: 8, rotJit: 0 });
  const cents = hp.paths.map((pa) => {
    let sx = 0, sy = 0;
    for (const q of pa.pts) { sx += q[0]; sy += q[1]; }
    return [sx / pa.pts.length, sy / pa.pts.length];
  });
  let minC = Infinity;
  for (let i = 0; i < cents.length; i++) for (let j = i + 1; j < cents.length; j++) {
    const d = Math.hypot(cents[i][0] - cents[j][0], cents[i][1] - cents[j][1]);
    if (d < minC) minC = d;
  }
  const cw = (300 - 24) / 8;
  if (minC < cw - 0.5) die("hex pack circles overlap (min center dist " + minC.toFixed(2) + " vs cell " + cw.toFixed(2) + ")");
  console.log("tiles OK (3 layouts live, flipAlt live, hex pack touch-not-overlap: " + minC.toFixed(1) + "/" + cw.toFixed(1) + " mm)");
}
{ /* hyperbolic solve */
  const run = (o) => hyp.compute([undefined], P(hyp, o), CTX);
  const a = run({ solve: true, solvePen: 3, seed: 2026 });
  const b = run({ solve: true, solvePen: 3, seed: 2026 });
  if (JSON.stringify(a) !== JSON.stringify(b)) die("hyp non-deterministic");
  const off = run({ solve: false, solvePen: 3 });
  if (off.paths.some((pa) => pa.layer === 3)) die("solve off still marks");
  let best = 0;
  for (const seed of [2026, 7, 99, 1234]) {
    const r = run({ solve: true, solvePen: 3, seed });
    const sol = r.paths.filter((pa) => pa.layer === 3);
    if (!sol.length) die("solve marks nothing, seed " + seed);
    let rMin = Infinity, rMax = 0;
    for (const pa of sol) for (const [x, y] of pa.pts) {
      const d = Math.hypot(x - 150, y - 100);
      if (d < rMin) rMin = d;
      if (d > rMax) rMax = d;
    }
    const span = (rMax - rMin) / (Math.min(300, 200) * 0.45);
    if (span > best) best = span;
  }
  if (best < 0.85) die("no seed yields a center-to-rim strand (best span " + (best * 100).toFixed(0) + "%)");
  console.log("hyperbolic OK (solve strand spans " + (best * 100).toFixed(0) + "% of the disc radius)");
}
console.log("era 2 valid");